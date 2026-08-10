## Context

当前 `src/db/index.ts` 是 Dexie 空库（version 1，无 stores）。绩效统计（`src/pages/PerfStats/index.tsx`）和消课表（`src/pages/LessonCancelReport/index.tsx`）两个页面都把解析结果存在 React state 里，刷新即丢。两页面的数据结构不同：

- **PerfStats**：`tableData: RowData[]`（原始预览行）+ `feeSummary: TeacherSummary[]`（按老师聚合的课时费明细，含 sessions）+ `validationErrors: ValidationError[]`（校验错误）
- **LessonCancelReport**：`rawRows: PreviewRow[]`（原始预览）+ `validRows: ValidRow[]` + `invalidRows: ValidationError[]` + `matrix: CancelMatrix | null`（消课矩阵）+ `targetMonth`（用户选定的月份）

技术栈：React 19 + antd 5 + Dexie 4 + xlsx 0.18 + framer-motion，前端纯静态无后端。

## Goals / Non-Goals

**Goals:**

- 升级 Dexie schema 到 version 2，新增 `historyRecords` 表
- 每次上传解析成功后写入一条完整记录（含原始文件二进制、解析结果、校验结果、聚合结果）
- 应用启动时自动删除超一年记录
- 两个页面工具栏加"历史记录"按钮，弹出共享抽屉组件
- 抽屉支持：列表展示、点击回填页面状态、下载原始文件、批量勾选删除、清空全部
- 抽屉按当前页面类型过滤（绩效统计只看 perf-stats 记录，消课表只看 lesson-cancel 记录）

**Non-Goals:**

- 不做跨设备同步（IndexedDB 是本地存储）
- 不做导出历史记录到文件的迁移（用户可对单条下载原始文件即可）
- 不做编辑历史记录功能
- 不修改绩效统计/消课表的解析与计算逻辑（仅在解析成功后加写入钩子）
- 不做服务端备份

## Decisions

### 决策 1：单表存储 + `type` 字段区分

**选择**：一张 `historyRecords` 表，用 `type: 'perf-stats' | 'lesson-cancel'` 字段区分。索引 `createdAt`、`type`、`targetMonth`。

**理由**：两种记录结构相似（都有文件名、上传时间、原始文件二进制、解析结果），共享一张表方便统一清理与统计。具体解析结果（feeSummary/matrix）作为 `payload: any` 字段存储，TypeScript 侧用 discriminated union 类型化。

**替代**：两张表 `perfStatsHistory` + `lessonCancelHistory`——拒绝，因为清理与 UI 共用逻辑会被重复实现。

### 决策 2：完整结果 + 原始文件二进制都存

**选择**：记录包含：
- `id` (auto-increment)
- `type`: 'perf-stats' | 'lesson-cancel'
- `createdAt`: number (Date.now())
- `fileName`: string
- `fileSize`: number (bytes)
- `fileBinary`: ArrayBuffer（原始 Excel 文件）
- `validCount`: number
- `invalidCount`: number
- `targetMonth`: `{ year: number; month: number } | null`（消课表才有，perf-stats 为 null）
- `payload`: 结构化对象——perf-stats 存 `{ tableData, feeSummary, validationErrors }`，lesson-cancel 存 `{ rawRows, validRows, invalidRows, matrix, targetMonth }`

**理由**：用户要求"完整数据 + 支持下载"，原始文件二进制让用户能直接下载原 Excel，完整 payload 让用户点击历史记录就能看到当时的解析结果（无需重新上传）。

**存储估算**：单条 50-300KB（原始文件 + payload JSON），一年若累计 500 条约 150MB，IndexedDB 可承受。

### 决策 3：保留策略——应用启动时清理

**选择**：在 `src/App.tsx` 的 `useEffect` 里调用 `cleanupExpiredHistory()`，删除 `createdAt < Date.now() - 365*24*3600*1000` 的记录。

**理由**：用户选择"应用启动时扫描"。一次启动清理一次，简单可靠，无需后台。若历史记录很多（如上千条），清理在单个事务里批量删，IndexedDB 批量删除性能足够。

**边界**：1 年 = 365 天 = 31536000000 ms。用 `Date.now() - 365 * 24 * 60 * 60 * 1000` 计算 cutoff。闰年多出的 1 天忽略。

### 决策 4：共享 HistoryDrawer 组件

**选择**：新增 `src/components/HistoryDrawer/index.tsx`，props 包含 `type`（过滤记录类型）、`onSelect(record)`（回填回调）、`open`/`onClose`。组件内部负责列表、批量选择、下载、删除。

**理由**：两个页面的历史记录 UI 完全一致，仅数据类型与回填逻辑不同。共享组件避免重复实现。

**抽屉 UI**：
- 顶部：`SelectAll` 复选框 + "删除选中" + "清空全部" 按钮
- 列表：每行一个复选框 + 上传时间 + 文件名 + 行数统计 + 操作按钮（查看/下载）
- 底部：分页或滚动加载（若记录多）

### 决策 5：回填页面状态——payload 完整还原

**选择**：点击"查看"触发 `onSelect(record)`，页面把 `payload` 里的字段 set 回 state，等同于"上传成功后的状态"。

**理由**：payload 存的是解析后的完整数据，回填后用户看到的就是当时的解析结果与生成的矩阵/汇总，无需重新解析。

**实现**：两个页面分别实现 `restoreFromHistory(record)` 函数，把 payload 字段映射到 state。

### 冺策 6：下载原始文件——用 Blob + a 标签

**选择**：从 `fileBinary` (ArrayBuffer) 创建 `Blob([fileBinary], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })`，用 `URL.createObjectURL` + 临时 `<a>` 标签触发下载，文件名用记录的 `fileName`。

**理由**：标准浏览器下载方式，无依赖。

## Risks / Trade-offs

- [IndexedDB 配额超限]：浏览器通常给数百 MB 至数 GB，单条 50-300KB 不会超。若用户频繁上传大量文件，可在写入失败时捕获 `QuotaExceededError` 并提示用户清理历史
- [大文件二进制存储]：若用户上传 5MB+ 大 Excel，单条记录会大。可在写入前检查 fileSize > 2MB 时不存二进制（只存元信息），但当前需求未提此限制，先全存
- [payload 结构漂移]：未来若解析逻辑变化，老记录的 payload 可能字段缺失。`restoreFromHistory` 做字段存在性检查，缺失时降级为"无法完全还原"
- [清理时机窗口]：仅在应用启动清理，若用户长期不刷新页面，超期记录不会被清。可接受，因为刷新是常态
- [批量删除性能]：一次删几十条 IndexedDB 事务会卡顿。用单事务 `db.transaction('rw', historyRecords, () => bulkDelete(ids))` 保证原子性与性能
- [共享组件类型化]：payload 是 discriminated union，TypeScript 侧用 `as` 收窄类型，运行时不强校验
