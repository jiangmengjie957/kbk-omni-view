## Why

绩效统计与消课表当前每次上传解析后，结果只存在 React state 里，刷新即丢。用户经常需要回看上周/上月导入的数据与生成的报表，重新上传同一份文件既费时又容易拿不到原始文件。把每次上传的解析结果与原始文件持久化到浏览器 IndexedDB，可解决"回看历史"与"重新下载原始文件"两个场景，同时自动清理超期记录避免存储膨胀。

## What Changes

- 升级 Dexie schema 到 version 2，新增 `historyRecords` 表，索引 `createdAt`、`type`、`targetMonth`
- 每次上传解析成功后写入一条历史记录，包含：上传时间、文件名、文件大小、类型（perf-stats / lesson-cancel）、有效/异常行数、解析出的完整数据（原始行 + 校验结果 + 矩阵或费用汇总）、原始 Excel 文件二进制（用于重新下载）
- 应用启动时扫描 `historyRecords`，删除 `createdAt` 早于一年前的记录（保留策略）
- 绩效统计页面新增"历史记录"抽屉/面板：列表展示（上传时间、文件名、行数、类型），支持点击单条回填到页面查看、下载原始文件、批量勾选删除、清空全部
- 消课表页面新增同款"历史记录"面板，复用同一套组件
- 历史记录按钮置于两个页面的工具栏

## Capabilities

### New Capabilities

- `history-records`: 历史记录的存储、保留策略（1 年自动清理）、批量删除、单条查看与下载，作为 perf-stats 与 lesson-cancel 共用的底层能力

### Modified Capabilities

- `db-client`: Dexie schema 升级到 version 2，新增 `historyRecords` 表与索引
- `perf-stats-page`: 工具栏新增"历史记录"按钮，支持查看/下载/删除历史
- `lesson-cancel-report-page`: 工具栏新增"历史记录"按钮，支持查看/下载/删除历史

## Impact

- 修改 `src/db/index.ts`：升级 Dexie schema，新增 `historyRecords` store
- 新增 `src/utils/historyDb.ts`：CRUD + 保留策略清理 + 类型化记录接口
- 新增 `src/components/HistoryDrawer/`：共享抽屉组件（列表 + 批量选择 + 下载 + 删除），两个页面复用
- 修改 `src/pages/PerfStats/index.tsx`：上传成功后写入历史；工具栏加"历史记录"按钮；点击历史记录回填状态
- 修改 `src/pages/LessonCancelReport/index.tsx`：同上
- 修改 `src/App.tsx` 或入口处：应用启动时调用清理函数
- 依赖：`dexie` 已在 package.json；无新增依赖
- 存储估算：单条记录含原始文件二进制约 50-300KB，一年若累计 500 条约 150MB，处于 IndexedDB 配额内（浏览器通常给数百 MB 至数 GB）
