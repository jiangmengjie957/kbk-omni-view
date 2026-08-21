## Why

消课表当前只能按单月生成矩阵、查看当月消耗，无法回答"这个学生一年下来到底消耗了多少课时、还剩多少"这类跨周期问题。同时现有的 `historyRecords` 表有 1 年自动清理策略，无法作为长期统计的数据源。需要一个独立的"课时统计"页面，从持久化的月度消课单元聚合，对照学生总课时得出剩余课时。

## What Changes

- 在 IndexedDB 中新增一张**不过期**的 `lessonMonthlyRecords` 表，以"学生 × 年月 × 班型"为单元存储已确认的消课数据（一个月一个单元）
- 消课表页面在生成矩阵后，新增"保存到长期存储"确认动作：用户确认后把当月有效行 + 矩阵汇总写入 `lessonMonthlyRecords`，不受 1 年清理策略影响
- 课时统计页面新增"导入学生总课时"能力：从 Excel 导入学生姓名 + 总课时配额，写入 `studentQuotas` 表（同样不过期）
- 课时统计页面从 `lessonMonthlyRecords` 读取数据，支持按月或按天聚合，对照 `studentQuotas` 计算"已消耗 / 剩余"课时
- 侧边栏新增"课时统计"菜单项，路由 `/admin/lesson-hour-stats`

## Capabilities

### New Capabilities

- `lesson-hour-stats-page`: 课时统计页面，支持导入学生总课时配额、从持久化月度消课记录按月/按天聚合、计算剩余课时并展示
- `persistent-lesson-store`: 不过期的 IndexedDB 存储，包含月度消课单元（lessonMonthlyRecords）与学生课时配额（studentQuotas）两张表及其 CRUD

### Modified Capabilities

- `db-client`: Dexie schema 升级到 version 3，新增 `lessonMonthlyRecords` 与 `studentQuotas` 两张表，索引设计支持按学生、年月查询
- `lesson-cancel-report-page`: 矩阵生成后新增"保存到长期存储"按钮，用户确认后写入持久化存储，已保存的月份单元支持去重/覆盖
- `admin-layout`: 侧边栏菜单新增"课时统计"项，路由 `/admin/lesson-hour-stats`

## Impact

- 修改 `src/db/index.ts`: Dexie schema 升级到 v3，新增 `lessonMonthlyRecords`（keyPath 复合学生+年月+班型）和 `studentQuotas`（keyPath 学生姓名）两张表
- 新增 `src/utils/persistentLessonDb.ts`: 月度消课单元的 CRUD（按年月查、按学生查、upsert、覆盖确认）+ 学生配额 CRUD
- 新增 `src/utils/lessonHourStats.ts`: 复用 `lessonCancel.ts` 的 `buildCancelMatrix` 与 `extractMonths`，新增按月/按天聚合、剩余课时计算、配额匹配
- 新增 `src/pages/LessonHourStats/index.tsx` + 样式: 总课时导入、聚合维度切换（月/天）、学生维度表格、剩余课时高亮
- 修改 `src/pages/LessonCancelReport/index.tsx`: 生成矩阵后新增"保存到长期存储"按钮 + 确认弹窗，写入 `lessonMonthlyRecords`
- 修改 `src/layouts/AdminLayout/index.tsx`: `menuItems` 增加"课时统计"项
- 修改 `src/router/index.tsx`: 新增 `/admin/lesson-hour-stats` 子路由
- 依赖: 复用现有 `xlsx`、`dexie`、`antd`，无新增依赖
- 存储估算: 单条月度单元（一个学生一个月）约 1-2KB，一个学生一年 12 条 ≈ 24KB；学生配额表每条 < 0.5KB；总规模远低于 IndexedDB 配额
- 兼容性: 现有 `historyRecords` 表与 1 年清理策略保持不变，不影响现有"历史记录"功能
