## ADDED Requirements

### Requirement: 持久化月度消课单元存储
系统 SHALL 在 Dexie 中新增 `lessonMonthlyRecords` 表，**不受 1 年清理策略影响**，以"学生 × 年月 × 班型"为最小存储单元，记录该单元的每日节数明细与当月汇总。

#### Scenario: 表结构定义
- **WHEN** Dexie 初始化到 v3
- **THEN** `lessonMonthlyRecords` 表存在，keyPath 为复合键 `[studentName+yearMonth+banXing]`，并附加单字段索引 `studentName` 与 `yearMonth`

#### Scenario: 单元字段
- **WHEN** 写入一条月度单元
- **THEN** 记录包含：`studentName`（学生姓名）、`banXing`（归一化班型如 1v1/1v3）、`yearMonth`（"YYYY-MM" 字符串）、`dayMap`（普通对象 `{ [day: number]: number }`，key 为 1..31 的日号）、`total`（当月节数总和）、`savedAt`（写入时间戳）

#### Scenario: 不过期
- **WHEN** 应用启动调用 `cleanupExpiredHistory()`
- **THEN** `lessonMonthlyRecords` 表中的记录不被删除，`historyRecords` 表照常清理超期记录

### Requirement: 月度单元 upsert
系统 SHALL 提供 `upsertMonthlyRecords(rows: LessonMonthlyRecord[])` 函数，对每条记录使用复合键 upsert——同 (studentName+yearMonth+banXing) 的记录 SHALL 覆盖旧值，不存在的记录 SHALL 新增。

#### Scenario: 全新单元写入
- **WHEN** 调用 upsert 写入一条 (张三, 2026-05, 1v1) 单元，且表中无该键
- **THEN** 该单元被新增，`savedAt` 为当前时间戳

#### Scenario: 同键单元覆盖
- **WHEN** 调用 upsert 写入一条 (张三, 2026-05, 1v1) 单元，且表中已存在该键
- **THEN** 旧记录被新记录覆盖（dayMap、total、savedAt 全部更新）

#### Scenario: 批量 upsert 原子性
- **WHEN** 调用 upsert 写入 N 条记录
- **THEN** 所有写入在单个 Dexie 事务内完成，全部成功或全部回滚

### Requirement: 学生课时配额存储
系统 SHALL 在 Dexie 中新增 `studentQuotas` 表，**不受 1 年清理策略影响**，以学生姓名为键存储该学生的总课时配额。

#### Scenario: 表结构定义
- **WHEN** Dexie 初始化到 v3
- **THEN** `studentQuotas` 表存在，keyPath 为 `studentName`

#### Scenario: 配额字段
- **WHEN** 写入一条配额记录
- **THEN** 记录包含：`studentName`（学生姓名）、`totalQuota`（总课时配额，数字）、`importedAt`（导入时间戳）、`note`（可选备注）

#### Scenario: 同名配额覆盖
- **WHEN** 导入一个已存在配额的学生（如重复导入）
- **THEN** `put()` 用新配额覆盖旧配额，`importedAt` 更新为当前时间戳

### Requirement: 按学生查询月度单元
系统 SHALL 提供 `listMonthlyRecordsByStudent(studentName: string): Promise<LessonMonthlyRecord[]>` 函数，返回该学生所有年月所有班型的月度单元。

#### Scenario: 查询存在记录的学生
- **WHEN** 调用 `listMonthlyRecordsByStudent('张三')`，且张三有 2026-05/1v1、2026-06/1v1、2026-06/1v3 三条记录
- **THEN** 返回数组长度为 3，包含全部三条记录

#### Scenario: 查询无记录的学生
- **WHEN** 调用 `listMonthlyRecordsByStudent('李四')`，且李四无任何记录
- **THEN** 返回空数组，不抛错

#### Scenario: 姓名严格匹配
- **WHEN** 调用 `listMonthlyRecordsByStudent('张三')`，但表中只有"张 三"（带空格）
- **THEN** 返回空数组（trim 在写入时已做，但查询侧不二次 trim，避免误匹配）

### Requirement: 按年月查询月度单元
系统 SHALL 提供 `listMonthlyRecordsByYearMonth(yearMonth: string): Promise<LessonMonthlyRecord[]>` 函数，返回该年月所有学生所有班型的月度单元。

#### Scenario: 查询某月全部单元
- **WHEN** 调用 `listMonthlyRecordsByYearMonth('2026-05')`
- **THEN** 返回 2026 年 5 月所有 (学生, 班型) 组合的月度单元

### Requirement: 检测已存在的月度单元
系统 SHALL 提供 `findExistingMonthlyUnits(yearMonth: string, keys: Array<{studentName: string; banXing: string}>): Promise<LessonMonthlyRecord[]>` 函数，返回指定年月下已存在的单元列表，用于"保存到长期存储"前的覆盖确认。

#### Scenario: 全部不存在
- **WHEN** 用户保存 2026-05 月矩阵，且 2026-05 在持久化存储中无任何记录
- **THEN** `findExistingMonthlyUnits` 返回空数组，前端直接 upsert 全部

#### Scenario: 部分已存在
- **WHEN** 用户保存 2026-05 月矩阵，其中 (张三, 1v1) 已存在
- **THEN** `findExistingMonthlyUnits` 返回包含 (张三, 1v1) 的数组，前端弹窗让用户选择覆盖策略

### Requirement: 配额批量导入
系统 SHALL 提供 `importStudentQuotas(quotas: Array<{studentName: string; totalQuota: number; note?: string}>): Promise<{inserted: number; updated: number}>` 函数，批量 upsert 配额记录。

#### Scenario: 首次导入
- **WHEN** 调用 `importStudentQuotas` 导入 30 个学生配额，且表中无任何记录
- **THEN** 返回 `{ inserted: 30, updated: 0 }`，所有配额写入

#### Scenario: 重复导入覆盖
- **WHEN** 调用 `importStudentQuotas` 导入 30 个学生配额，其中 5 个已存在
- **THEN** 返回 `{ inserted: 25, updated: 5 }`，5 个已存在的被新配额覆盖

### Requirement: 全量配额查询
系统 SHALL 提供 `listAllStudentQuotas(): Promise<StudentQuota[]>` 函数，返回所有学生配额，用于课时统计页面匹配。

#### Scenario: 查询全部配额
- **WHEN** 调用 `listAllStudentQuotas()`
- **THEN** 返回所有学生配额记录，按学生姓名升序排列
