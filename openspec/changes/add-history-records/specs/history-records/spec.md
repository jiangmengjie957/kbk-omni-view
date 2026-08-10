## ADDED Requirements

### Requirement: 历史记录写入
系统 SHALL 在用户上传 Excel 解析成功后，将本次解析的完整结果与原始文件二进制写入 `historyRecords` 表。每条记录包含：写入时间戳、原始文件名、文件大小、文件二进制、记录类型（perf-stats/lesson-cancel）、有效行数、异常行数、目标月份（消课表）、完整解析结果 payload。

#### Scenario: 绩效统计解析成功后写入
- **WHEN** 用户在绩效统计页面上传 Excel 解析成功
- **THEN** 系统写入一条 `type='perf-stats'` 的历史记录，payload 含原始行、费用汇总、校验错误列表

#### Scenario: 消课表解析成功后写入
- **WHEN** 用户在消课表页面上传 Excel 解析成功
- **THEN** 系统写入一条 `type='lesson-cancel'` 的历史记录，payload 含原始行、有效行、异常行、矩阵（若已生成）、目标月份

#### Scenario: 解析失败不写入
- **WHEN** 用户上传的文件解析失败或数据为空
- **THEN** 系统不写入历史记录

#### Scenario: 文件格式错误不写入
- **WHEN** 用户上传非 Excel 文件或必需列缺失
- **THEN** 系统不写入历史记录

### Requirement: 保留策略——超一年自动清理
系统 SHALL 在应用启动时扫描 `historyRecords` 表，删除 `createdAt` 早于当前时间一年前的记录。

#### Scenario: 启动清理超期记录
- **WHEN** 应用启动且 `historyRecords` 中存在 `createdAt` 早于一年前的记录
- **THEN** 系统删除这些超期记录

#### Scenario: 无超期记录不清理
- **WHEN** 应用启动且所有记录 `createdAt` 均在一年内
- **THEN** 系统不执行删除

#### Scenario: 表为空不报错
- **WHEN** 应用启动时 `historyRecords` 为空
- **THEN** 系统不报错，正常完成启动

### Requirement: 历史记录列表查询
系统 SHALL 提供按类型查询历史记录的能力，返回记录列表，按 `createdAt` 降序排列（最近在前）。

#### Scenario: 按类型查询列表
- **WHEN** 绩效统计页面打开历史记录抽屉
- **THEN** 系统返回 `type='perf-stats'` 的所有记录，按上传时间降序

#### Scenario: 消课表查询列表
- **WHEN** 消课表页面打开历史记录抽屉
- **THEN** 系统返回 `type='lesson-cancel'` 的所有记录，按上传时间降序

### Requirement: 历史记录单条查看（回填页面状态）
系统 SHALL 支持点击历史记录单条将其 payload 回填到当前页面状态，等同于上传解析成功后的状态。

#### Scenario: 回填绩效统计
- **WHEN** 用户在绩效统计历史抽屉中点击某条记录的"查看"
- **THEN** 系统将 payload 的 `tableData`/`feeSummary`/`validationErrors` set 回页面 state，关闭抽屉，页面显示当时解析结果

#### Scenario: 回填消课表
- **WHEN** 用户在消课表历史抽屉中点击某条记录的"查看"
- **THEN** 系统将 payload 的 `rawRows`/`validRows`/`invalidRows`/`matrix`/`targetMonth` set 回页面 state，关闭抽屉，页面显示当时的矩阵与告警

#### Scenario: payload 字段缺失降级
- **WHEN** 历史记录的 payload 缺少某些字段（如旧版本写入的记录）
- **THEN** 系统不报错，缺失字段保持当前 state 不变，已恢复字段正常展示

### Requirement: 历史记录下载原始文件
系统 SHALL 支持点击历史记录单条下载其原始 Excel 文件二进制，文件名用记录的 `fileName`。

#### Scenario: 下载成功
- **WHEN** 用户点击某条记录的"下载"
- **THEN** 浏览器下载文件，文件名为记录的 `fileName`，内容为 `fileBinary` 还原的 Excel

#### Scenario: 文件二进制缺失
- **WHEN** 记录的 `fileBinary` 为空或缺失
- **THEN** 下载按钮禁用或点击后提示"原始文件不可用"

### Requirement: 批量选择删除
系统 SHALL 支持在历史记录列表中勾选多条记录后批量删除。

#### Scenario: 勾选多条删除
- **WHEN** 用户勾选 N 条记录后点击"删除选中"
- **THEN** 系统弹出确认弹窗，用户确认后删除这 N 条记录，列表刷新

#### Scenario: 未勾选时禁用
- **WHEN** 用户未勾选任何记录
- **THEN** "删除选中"按钮禁用

#### Scenario: 删除后列表刷新
- **WHEN** 批量删除完成
- **THEN** 列表移除已删记录，勾选状态清空

### Requirement: 清空全部
系统 SHALL 支持"清空全部"按钮，删除当前类型（perf-stats 或 lesson-cancel）的所有历史记录。

#### Scenario: 清空全部确认
- **WHEN** 用户点击"清空全部"
- **THEN** 系统弹出确认弹窗提示"将删除全部 N 条记录，不可恢复"，用户确认后删除全部该类型记录

#### Scenario: 清空后列表为空
- **WHEN** 清空完成
- **THEN** 列表显示空状态提示"暂无历史记录"

### Requirement: 历史记录抽屉 UI 布局
系统 SHALL 在两个页面工具栏新增"历史记录"按钮，点击弹出 antd `Drawer`，抽屉内从上到下依次：批量操作栏（全选复选框 + "删除选中" + "清空全部"）、记录列表、每条记录含复选框、上传时间、文件名、行数统计、查看与下载操作。

#### Scenario: 抽屉打开
- **WHEN** 用户点击工具栏"历史记录"按钮
- **THEN** 抽屉从右侧滑入，展示当前类型的记录列表

#### Scenario: 抽屉关闭
- **WHEN** 用户点击抽屉遮罩或关闭按钮
- **THEN** 抽屉滑出关闭，勾选状态清空

#### Scenario: 空状态
- **WHEN** 当前类型无历史记录
- **THEN** 抽屉显示"暂无历史记录"空状态

#### Scenario: 记录展示字段
- **WHEN** 列表渲染每条记录
- **THEN** 显示上传时间（YYYY-MM-DD HH:mm）、文件名、有效 N 条 / 异常 N 条、（消课表）目标月份
