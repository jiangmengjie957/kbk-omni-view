## MODIFIED Requirements

### Requirement: Dexie 数据库初始化
系统 SHALL 在 `src/db/index.ts` 中创建并导出一个 Dexie 实例，数据库名为 `kbkDB`，当前版本号为 2，定义 `historyRecords` 表，供全局使用。

#### Scenario: 数据库首次初始化
- **WHEN** 应用首次在浏览器中加载
- **THEN** Dexie 在 IndexedDB 中创建名为 `kbkDB` 的数据库（版本 2），含 `historyRecords` 表，无报错

#### Scenario: 多次导入同一实例
- **WHEN** 多个模块 import `src/db/index.ts`
- **THEN** 所有模块共享同一个 Dexie 实例，不重复创建数据库连接

#### Scenario: 从空库升级
- **WHEN** 已有版本 1（空库）的浏览器加载新版本代码
- **THEN** Dexie 自动迁移到版本 2，新建 `historyRecords` 表，不报错

### Requirement: historyRecords 表结构
系统 SHALL 在 `historyRecords` 表定义以下索引：`++id`（自增主键）、`createdAt`（写入时间戳）、`type`（记录类型 perf-stats/lesson-cancel）、`targetMonth`（目标年月复合索引，可空）、`fileName`。每条记录 SHALL 包含字段：`id`、`createdAt`、`type`、`fileName`、`fileSize`、`fileBinary`（ArrayBuffer）、`validCount`、`invalidCount`、`targetMonth`（`{year,month} | null`）、`payload`（结构化解析结果）。

#### Scenario: 写入并按 createdAt 查询
- **WHEN** 写入一条记录后按 `createdAt` 升序查询
- **THEN** 返回的记录按写入时间排序

#### Scenario: 按 type 过滤
- **WHEN** 查询 `type = 'perf-stats'` 的记录
- **THEN** 返回的记录均为 perf-stats 类型，不含 lesson-cancel 类型

#### Scenario: 按 targetMonth 过滤
- **WHEN** 查询消课表某月的记录
- **THEN** 返回 `targetMonth.year` 与 `targetMonth.month` 匹配的记录
