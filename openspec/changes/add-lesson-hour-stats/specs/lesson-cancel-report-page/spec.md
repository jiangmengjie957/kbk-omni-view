## ADDED Requirements

### Requirement: 保存到长期存储
系统 SHALL 在消课表矩阵生成后，于矩阵工具栏新增"保存到长期存储"按钮（与"导出 Excel"按钮并列）。点击后系统 SHALL 把当前矩阵的每一行作为一个月度单元写入 `lessonMonthlyRecords` 表，单元粒度为"学生 × 年月 × 班型"。

#### Scenario: 矩阵未生成时按钮禁用
- **WHEN** 用户尚未生成消课矩阵
- **THEN** "保存到长期存储"按钮 disabled，点击无响应

#### Scenario: 全新月份保存
- **WHEN** 用户生成 2026-05 月矩阵后点击"保存到长期存储"，且 2026-05 在持久化存储中无任何记录
- **THEN** 系统把矩阵每一行（学生×班型）写入 `lessonMonthlyRecords`，每条含 studentName/banXing/yearMonth="2026-05"/dayMap/total/savedAt；message.success 提示"已保存 N 条月度记录"

#### Scenario: 部分单元已存在
- **WHEN** 用户保存 2026-05 月矩阵，其中 (张三, 1v1) 已存在
- **THEN** 系统弹窗 Modal.confirm 列出已存在的单元，提供三个选项："覆盖全部"、"跳过已存在"、"取消"

#### Scenario: 覆盖全部
- **WHEN** 用户在覆盖确认弹窗中选择"覆盖全部"
- **THEN** 系统对已存在单元执行 `put()` 覆盖，对不存在单元执行新增，全部完成后 message.success 提示"已保存 N 条（覆盖 M 条）"

#### Scenario: 跳过已存在
- **WHEN** 用户在覆盖确认弹窗中选择"跳过已存在"
- **THEN** 系统只写入不存在的单元，已存在的保持不变，完成后 message.success 提示"已保存 N 条（跳过 M 条）"

#### Scenario: 取消保存
- **WHEN** 用户在覆盖确认弹窗中选择"取消"
- **THEN** 不写入任何记录，按钮保持可点击状态

#### Scenario: 保存成功后按钮状态
- **WHEN** 保存完成
- **THEN** "保存到长期存储"按钮变为 disabled + 文案"已保存到长期存储"，直到用户重新生成矩阵或上传新文件

#### Scenario: 重新生成后恢复可保存
- **WHEN** 用户在已保存状态下重新生成矩阵（如切换月份）
- **THEN** "保存到长期存储"按钮恢复 enabled + 文案"保存到长期存储"

### Requirement: 月度单元数据结构
系统 SHALL 把矩阵行序列化为 `LessonMonthlyRecord` 结构写入 `lessonMonthlyRecords`，字段包含：`studentName`、`banXing`、`yearMonth`（"YYYY-MM" 格式）、`dayMap`（普通对象 `{ [day: number]: number }`，仅含非零日）、`total`、`savedAt`（Date.now()）。

#### Scenario: dayMap 序列化
- **WHEN** 矩阵行 (张三, 1v1, 2026-05) 的 dayMap 为 Map{7=>1, 15=>0.5, 22=>1}，total=2.5
- **THEN** 写入 `lessonMonthlyRecords` 时 dayMap 字段为 `{ "7": 1, "15": 0.5, "22": 1 }`（普通对象），total=2.5，yearMonth="2026-05"

#### Scenario: 空日不写入 dayMap
- **WHEN** 矩阵行在 5 月 1 日无课
- **THEN** dayMap 中不包含 key "1"，而非 `{ "1": 0 }`

#### Scenario: 0.5 节数保留
- **WHEN** 矩阵行某日单元格为 0.5
- **THEN** dayMap 中该日 key 的 value 为 0.5，不取整
