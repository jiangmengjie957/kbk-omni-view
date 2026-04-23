## ADDED Requirements

### Requirement: Dexie 数据库初始化
系统 SHALL 在 `src/db/index.js` 中创建并导出一个 Dexie 实例，定义数据库名称和初始版本号，供全局使用。

#### Scenario: 数据库首次初始化
- **WHEN** 应用首次在浏览器中加载
- **THEN** Dexie 在 IndexedDB 中创建名为 `kbkDB` 的数据库（版本 1），无报错

#### Scenario: 多次导入同一实例
- **WHEN** 多个模块 import `src/db/index.js`
- **THEN** 所有模块共享同一个 Dexie 实例，不重复创建数据库连接

### Requirement: 版本管理结构
系统 SHALL 在 Dexie 初始化中预留版本升级结构，后续业务表通过追加 `.version(n).stores({...})` 扩展，不破坏现有数据。

#### Scenario: 后续业务表扩展
- **WHEN** 开发者在 `src/db/index.js` 追加新的 `.version(2).stores({ newTable: '++id, field1' })`
- **THEN** Dexie 自动迁移现有数据库到新版本，不丢失已有数据

### Requirement: 浏览器兼容性
系统 SHALL 兼容支持 IndexedDB 的所有现代浏览器（Chrome 90+、Firefox 88+、Safari 14+、Edge 90+），不支持 IE。

#### Scenario: 现代浏览器正常访问
- **WHEN** 用户使用 Chrome 90+ 或 Firefox 88+ 访问系统
- **THEN** IndexedDB 正常初始化，无 polyfill 错误
