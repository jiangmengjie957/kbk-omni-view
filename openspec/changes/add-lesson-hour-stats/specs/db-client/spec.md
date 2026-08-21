## ADDED Requirements

### Requirement: 持久化存储表（Dexie v3）
系统 SHALL 将 Dexie schema 升级到 version 3，在保留 version 2 `historyRecords` 表与 1 年清理策略不变的前提下，新增 `lessonMonthlyRecords` 与 `studentQuotas` 两张表。两张新表 SHALL 不参与 `cleanupExpiredHistory` 清理。

#### Scenario: 从 v2 迁移到 v3
- **WHEN** 用户浏览器中已存在 v2 的 `kbkDB`，应用加载到 v3 schema
- **THEN** Dexie 自动迁移，`historyRecords` 表与现有数据完整保留，新增 `lessonMonthlyRecords` 与 `studentQuotas` 两张空表

#### Scenario: 全新用户首次加载
- **WHEN** 全新用户首次访问应用，IndexedDB 中无 `kbkDB`
- **THEN** Dexie 直接创建 v3 schema，三张表（`historyRecords`、`lessonMonthlyRecords`、`studentQuotas`）一并初始化

#### Scenario: 持久化表不过期
- **WHEN** 应用启动调用 `cleanupExpiredHistory()`
- **THEN** `historyRecords` 表照常清理 1 年前记录；`lessonMonthlyRecords` 与 `studentQuotas` 表的记录不被删除

### Requirement: lessonMonthlyRecords 表索引
系统 SHALL 为 `lessonMonthlyRecords` 表定义复合 keyPath `[studentName+yearMonth+banXing]` 作为主键，并附加单字段索引 `studentName` 与 `yearMonth`。

#### Scenario: 复合键 upsert
- **WHEN** 写入一条 (张三, 2026-05, 1v1) 单元，该键已存在
- **THEN** Dexie `put()` 用新记录覆盖旧记录，主键不变

#### Scenario: 按学生索引查询
- **WHEN** 调用 `where('studentName').equals('张三')`
- **THEN** 返回张三在所有年月所有班型的月度单元

#### Scenario: 按年月索引查询
- **WHEN** 调用 `where('yearMonth').equals('2026-05')`
- **THEN** 返回 2026 年 5 月所有学生所有班型的月度单元

### Requirement: studentQuotas 表索引
系统 SHALL 为 `studentQuotas` 表定义 `studentName` 为 keyPath，无附加索引。

#### Scenario: 同名覆盖
- **WHEN** 写入一条 studentName="张三" 的配额，该键已存在
- **THEN** Dexie `put()` 用新配额覆盖旧配额

#### Scenario: 按学生查询
- **WHEN** 调用 `where('studentName').equals('张三')`
- **THEN** 返回张三的配额记录（最多一条）
