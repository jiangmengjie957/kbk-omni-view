## Why

机构需要一份"消课表"以学生维度核对每月消课节数（用于对家长对账、确认约定课时是否消完）。机构已有一套标准 Excel 模版：`取值` sheet 为原始课时记录（9 列：日期/时段/科目/老师/次数/学员姓名/年级/班型/学生人数，第 0 行即表头无标题行），`消课时汇总表` sheet 为目标产出（行=学生×班型，列=1~31 号 + 汇总，单元格=该日该学生该班型的消课节数）。本变更即把这套手工流程产品化：上传"取值"sheet，自动生成"消课时汇总表"。

绩效统计页面（`src/pages/PerfStats`）已实现 SheetJS 上传、行级校验、按老师聚合的链路，可复用其上传组件、行级校验框架与 `parseStudentCount`/`parseDurationHours` 等工具；但其导入表列结构（7 列 + 标题行）、班型格式（仅 `1V\d+`）、节数来源（时段÷2）与消课表模版不同，需要为消课表独立实现解析与聚合。

## What Changes

- 新增侧边栏菜单项"消课表"，路由 `/admin/lesson-cancel-report`
- 新增页面组件 `LessonCancelReport`，按消课表模版结构解析"取值"sheet：9 列、无标题行、第 0 行为表头
- 节数取值：**优先取"次数"列**（E 列，值为 1/0.5 等数字）；次数列缺失或非法时**回退到"时段"列时长 ÷ 2**（2 小时 = 1 节）
- 班型归一化：将"1V1/1v1/一对一"统一为 `1v1`，"1V3/1v3/一对三"统一为 `1v3`，"1V6/一对六"统一为 `1v6`；"小班"、"初三"等非标准班型作为异常行跳过
- 时段分隔符兼容 `-`/`—`/`~` 与全角/半角冒号（沿用 `parseDurationHours` 并扩展支持 `~`）
- 日期解析：优先按 Excel 序列号；混入的文本日期（如 `"2026.5.13"`、`":2026/5/30"`）若可解析则用，不可解析作为异常行
- 行级校验与异常处理：日期/时段/次数（或时段可解析）/班型合法性四项校验，异常行**跳过统计**，结果区置顶告警面板列出每行异常字段/原始值/原因
- 月份选择：数据涉及多个月时弹窗单选目标月份（默认数据中最近月），单月直接生成
- 消课矩阵：行=学生×归一化班型，列=1~当月天数，单元格=该日该学生该班型节数累加（1v多课拆到每个学生各计该行次数，可累加小数如 1.5）
- 序号自动连续生成（不沿用源表任何序号），汇总列为该行所有日期列之和
- 一键导出为 `.xlsx`，结构与"消课时汇总表"模版一致（含标题行"X月课时汇总"跨列合并）

## Capabilities

### New Capabilities

- `lesson-cancel-report-page`: 消课表页面，包含路由注册、菜单项、"取值"sheet 上传解析、行级校验+异常跳过告警、月份选择、消课矩阵生成与导出

### Modified Capabilities

- `admin-layout`: 侧边栏菜单新增"消课表"入口（图标 + 路由跳转至 `/admin/lesson-cancel-report`）

## Impact

- 新增目录 `src/pages/LessonCancelReport/`（页面组件 + 样式 + 月份选择弹窗）
- 新增 `src/utils/lessonCancel.ts`：班型归一化 `normalizeBanXing`、文本日期解析 `parseTextDate`、消课矩阵构建 `buildCancelMatrix` 等纯函数
- 修改 `src/layouts/AdminLayout/index.tsx`：`menuItems` 数组追加"消课表"项
- 修改 `src/router/index.tsx`：注册 `/admin/lesson-cancel-report` 路由
- 复用 `src/utils/calcFee.ts` 中的 `parseStudentCount`（姓名拆分）、`parseDurationHours`（时段→小时数，需扩展支持 `~` 分隔符）；不抽取 PerfStats 内联校验函数（消课表校验项与 PerfStats 不同，独立实现更清晰）
- 不涉及后端调用，全部前端完成；不修改 Dexie schema
- 依赖：`xlsx`、`antd`、`@ant-design/icons` 均已在 package.json 中，无新增依赖
