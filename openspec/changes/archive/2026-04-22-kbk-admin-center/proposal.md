## Why

项目当前缺少一个统一的后台管理入口，需要构建一个具备完整身份认证、响应式布局和可扩展菜单结构的前端管理中心，作为后续业务功能页面的载体框架。由于目前无后端服务，需要在纯前端实现认证持久化和业务数据存储。

## What Changes

- 新增登录页面，包含账号密码表单，认证信息持久化到 localStorage（有效期 300 天）
- 账号密码写死在前端代码中，无注册/找回密码功能
- 新增主体布局页面，包含侧边栏菜单、顶部导航栏和内容区域
- 引入 Ant Design 作为 UI 组件库
- 引入 Framer Motion 作为 React 动画库
- 引入 Dexie.js 封装 IndexedDB，用于后续业务数据持久化
- 引入 React Router v6 实现前端路由
- 整体设计遵循业内优秀后台管理系统设计规范（参考 Ant Design Pro 设计语言）
- 兼容所有现代浏览器（Chrome、Firefox、Safari、Edge），不支持 IE

## Capabilities

### New Capabilities

- `auth`: 前端身份认证模块，含登录表单、localStorage 会话持久化（300 天）、路由守卫
- `admin-layout`: 主体布局框架，含侧边栏菜单、顶部 Header、内容区域占位，支持菜单折叠
- `db-client`: Dexie 封装的 IndexedDB 客户端，提供统一的数据库初始化和版本管理入口

### Modified Capabilities

## Impact

- 新增依赖：`antd`、`framer-motion`、`dexie`、`react-router-dom`
- 新增源文件目录：`src/pages/`、`src/layouts/`、`src/components/`、`src/hooks/`、`src/db/`、`src/router/`
- 修改 `src/App.jsx` 以挂载路由系统
- 无后端 API 依赖，无 BREAKING 变更
