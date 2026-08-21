## Context

当前 `src/db/index.ts` 是 Dexie v2，有一张 `historyRecords` 表（索引 `++id, createdAt, type, targetMonth, fileName`），由 `src/utils/historyDb.ts` 提供 CRUD + 1 年自动清理（`cleanupExpiredHistory`）。该表是"历史记录"功能用的，按 `createdAt` 过期，不适合做长期统计的数据源。

消课表的解析逻辑集中在 `src/utils/lessonCancel.ts`：`validateRows` 把 Excel 行校验为 `ValidRow[]`，`buildCancelMatrix(validRows, year, month)` 生成 `CancelMatrix`（行=学生×班型，列=1..daysInMonth，单元格=当日节数累加），`extractMonths` 提取涉及月份。矩阵的每一行 `MatrixRow` 已经天然是"一个学生 × 一个班型 × 一个月"的聚合单元，正好可以做长期存储的最小粒度。

技术栈：React 19 + antd 5 + Dexie 4 + xlsx 0.18 + framer-motion，前端纯静态无后端。

## Goals / Non-Goals

**Goals:**

- Dexie schema 升级到 v3，新增两张**不过期**的表：`lessonMonthlyRecords`（月度消课单元）+ `studentQuotas`（学生总课时配额）
- 消课表页面生成矩阵后，提供"保存到长期存储"动作：用户确认后把当月矩阵的每一行作为一个月度单元写入 `lessonMonthlyRecords`，已存在的同 (学生+年月+班型) 单元支持覆盖确认
- 课时统计页面：从 Excel 导入学生总课时配额 → `studentQuotas`；从 `lessonMonthlyRecords` 读取并按月/按天聚合；对照配额计算"已消耗 / 剩余"
- 侧边栏新增"课时统计"菜单项 + 路由 `/admin/lesson-hour-stats`
- 复用现有 `lessonCancel.ts` 的 `buildCancelMatrix` 与 `extractMonths`，不重复造轮子

**Non-Goals:**

- 不修改 `historyRecords` 表与 1 年清理策略，"历史记录"功能保持不变
- 不做跨设备同步（IndexedDB 是本地存储）
- 不做服务端备份或导出迁移文件
- 不做自动保存——必须用户主动点"保存到长期存储"确认
- 课时统计页面不做配额编辑功能（配额通过 Excel 导入，单条修改留待后续）
- 不引入新依赖（dexie、xlsx、antd 都已在 package.json）

## Decisions

### 决策 1：两张独立表 vs 一张混合表

**选择**：新增两张独立表 `lessonMonthlyRecords` 和 `studentQuotas`。

**理由**：两者更新频率与访问模式完全不同——月度单元是"每月追加/覆盖"，配额是"一次性导入、偶尔重导"。分开后索引设计与清理策略各自独立，类型也清晰。

**替代**：一张 `persistentStore` 表用 `kind` 字段区分——拒绝，因为两类记录的字段结构完全不同（月度单元需要 dayMap，配额只需要 totalQuota），合并后字段稀疏、类型联合复杂。

### 决策 2：月度单元的 keyPath 用复合键

**选择**：`lessonMonthlyRecords` 的 keyPath 为 `[studentName, yearMonth, banXing]` 复合键，其中 `yearMonth` 是 `"YYYY-MM"` 字符串。

**理由**：
- 用户"保存到长期存储"时，同学生同月同班型的单元应覆盖而非追加——复合键让 Dexie 的 `put()` 自动 upsert
- 课时统计页面按学生查询时走 `where('studentName').equals(name)` 索引即可，不需要扫全表
- 按"一个月一个单元"的需求，复合键天然对应存储粒度

**替代**：自增 `++id` + 应用层查重——拒绝，因为查重需要先查再写，存在并发竞态（虽然前端单线程不太会触发），且 upsert 语义更清晰。

### 决策 3：存储粒度 = MatrixRow（学生×班型×年月）

**选择**：每个 `MatrixRow` 存一条记录，包含 `studentName`、`banXing`、`yearMonth`、`dayMap`（`{1: 1.5, 7: 1, 15: 0.5}` 普通对象）、`total`。

**理由**：
- 矩阵本身就是这个粒度，存储即"把矩阵行序列化"
- 保留 dayMap 让"按天统计"成为可能（直接合并多个月的 dayMap 即可按日聚合）
- 保留 banXing 让未来按班型筛选统计有数据基础

**替代**：每个 (学生×年月) 存一条，dayMap 内不分班型——拒绝，因为消课表矩阵本身就是按班型分行，存储时拆开更自然，且未来若要"只看 1v1 课时"也能支持。

### 决策 4：dayMap 用普通对象而非 Map

**选择**：`dayMap: { [day: number]: number }` 普通对象。

**理由**：
- IndexedDB 结构化克隆算法支持 Map，但普通对象在调试、JSON.stringify、未来导出迁移时更友好
- dayMap 的 key 永远是 1..31 的整数，普通对象足够

**替代**：Map——拒绝，理由如上。

### 决策 5：Schema v3 纯加法，不动 v2

**选择**：`.version(3).stores({ historyRecords: '++id, createdAt, type, targetMonth, fileName', lessonMonthlyRecords: '[studentName+yearMonth+banXing], studentName, yearMonth', studentQuotas: 'studentName' })`。

**理由**：
- v2 的 `historyRecords` 定义保持不变，Dexie 会自动从 v2 迁移到 v3（只加表，不删表）
- 现有用户的本地数据无损失风险
- 1 年清理策略只针对 `historyRecords`，新表不参与清理

### 决策 6：复用 lessonCancel.ts 的聚合逻辑

**选择**：新增 `src/utils/lessonHourStats.ts`，复用 `lessonCancel.ts` 的 `buildCancelMatrix` 和 `extractMonths`，新增：
- `aggregateByMonth(units: LessonMonthlyRecord[])`: 把多个年月单元按月汇总，返回 `{ yearMonth, total }[]`
- `aggregateByDay(units: LessonMonthlyRecord[])`: 把 dayMap 合并，返回 `{ date: 'YYYY-MM-DD', total }[]`
- `matchQuota(consumed: number, quota: StudentQuota | undefined)`: 返回 `{ consumed, quota, remaining, status: 'ok' | 'over' | 'unknown' }`

**理由**：`buildCancelMatrix` 已经处理了"学生拆分、班型归一、日累加"逻辑，长期存储写入时直接复用，保证与页面看到的矩阵一致。

### 决策 7：配额按学生姓名匹配（不引入学生 ID）

**选择**：`studentQuotas` 表 keyPath = `studentName`（字符串），与月度单元的 `studentName` 字段直接对应。匹配规则：trim + 严格相等（区分大小写）。

**理由**：
- 当前系统没有学生 ID 体系，姓名是唯一标识
- 导入配额的 Excel 和消课表的姓名拆分规则一致（都是 `splitStudentNames`），匹配率高
- 不引入 ID 体系避免改造现有数据流

**风险与缓解**：姓名漂移（错别字、空格）会导致配额匹配失败——课时统计页面会明确列出"未匹配配额的学生"与"未消耗课时的配额"，让用户感知并人工修正。

### 决策 8："保存到长期存储"的交互——按钮 + 二次确认

**选择**：消课表矩阵生成后，在矩阵工具栏新增"保存到长期存储"按钮（与"导出 Excel"并列）。点击后：
1. 检查当月所有 (学生+年月+班型) 单元是否已存在
2. 若全部不存在 → 直接写入，message.success("已保存 N 条月度记录")
3. 若部分存在 → Modal.confirm 列出已存在的单元，让用户选择"覆盖全部"/"跳过已存在"/"取消"
4. 写入完成后按钮变为 disabled + 文案"已保存到长期存储"，直到用户重新生成矩阵

**理由**：用户明确要求"确认保存"，所以是显式按钮而非自动写入。覆盖确认避免误覆盖已保存的月度数据。

## Risks / Trade-offs

- [姓名漂移导致配额匹配失败] → 课时统计页面在表格中明确标记"无配额"的学生，并在告警面板列出"未匹配的配额"，提示用户检查姓名拼写
- [复合键 keyPath 在 Dexie 4 的查询限制] → 复合键只能用 `where('[studentName+yearMonth+banXing]').equals([...])` 精确查；按学生查需要单独的 `studentName` 索引（已在 schema 里加）。决策 2 的 schema 已包含 `studentName` 单字段索引
- [存储膨胀] → 单条月度单元约 1-2KB（dayMap 平均 10-20 个 key），一个学生一年 12 条 ≈ 24KB；100 个学生一年约 2.4MB。远低于 IndexedDB 配额。但若用户长期使用（5 年+），可考虑在课时统计页面提供"清理指定年份"功能（本期非目标）
- [dayMap 的 day 跨月歧义] → dayMap 只存 day 数字（1-31），跨月聚合时必须用外层的 `yearMonth` 字段组装完整日期。`aggregateByDay` 实现时严格遵守此约束
- [配额重复导入] → `studentQuotas` 用 `studentName` 做 keyPath，`put()` 会覆盖同名学生的配额。导入时若用户误传文件会覆盖现有配额——导入前 Modal 确认"将覆盖 N 条已有配额"
- [矩阵未生成就点保存] → 按钮 disabled，必须先生成矩阵才能保存
- [v2 → v3 迁移失败] → Dexie 加法迁移几乎不会失败；若失败，Dexie 会抛错，应用启动时捕获并提示用户清空 IndexedDB（极端情况）
