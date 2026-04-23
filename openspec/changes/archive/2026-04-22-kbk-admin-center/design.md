## Context

本项目是一个纯前端后台管理系统框架（kbk后台管理中心），基于 React 19 + Rsbuild 构建。当前项目仅有基础入口文件，无路由、无认证、无状态管理。需要从零构建登录层和主体布局层，并为后续业务页面提供可扩展的承载结构。

所有数据在前端存储，无后端依赖。认证状态存 localStorage，业务数据存 IndexedDB（Dexie）。

## Goals / Non-Goals

**Goals:**
- 实现登录页面，含表单校验、写死凭据验证、localStorage 会话持久化（300 天）
- 实现主体布局：侧边栏菜单（支持折叠）、顶部 Header、内容区 Outlet
- 实现路由守卫（未登录跳转登录页）
- 引入 Ant Design、Framer Motion、Dexie、React Router v6
- 建立 `src/db/` 目录作为 Dexie 初始化入口，供后续业务使用
- 兼容 Chrome 90+、Firefox 88+、Safari 14+、Edge 90+
- 页面设计符合 Ant Design Pro 设计规范风格

**Non-Goals:**
- 注册、忘记密码、修改密码功能
- 后端 API 接入
- 实际业务页面（菜单下的子页面内容待后续迭代）
- 服务端渲染（SSR）
- 多语言国际化（暂不引入）
- 移动端适配（响应式以桌面端为主）

## Decisions

### D1: UI 组件库 — Ant Design v5

选择 Ant Design v5（最新稳定版），理由：
- 内置完整的后台管理组件（Layout、Menu、Form、Table 等）
- 与 React 19 兼容
- 中文生态完善，API 文档齐全

替代方案：MUI（英文为主，风格更 Material）、Arco Design（字节，生态较小）。

### D2: 动画库 — Framer Motion

选择 Framer Motion v11，理由：
- React 原生友好，API 声明式，与 Ant Design 无冲突
- 支持路由切换过渡动画、侧边栏展开收起动画
- 包体积合理（~50KB gzip）

替代方案：react-spring（API 复杂度高）、GSAP（非 React 原生，授权复杂）。

### D3: 路由 — React Router v6

选择 React Router v6 `<BrowserRouter>` + Outlet 模式：
- 支持嵌套路由，便于在 AdminLayout 中通过 `<Outlet>` 渲染子页面
- v6 hooks API（useNavigate、useLocation）与 React 19 兼容

### D4: 认证持久化 — localStorage + 时间戳

登录成功后在 localStorage 写入 `kbk_auth` JSON：
```json
{ "loggedIn": true, "expireAt": <timestamp> }
```
expireAt = 当前时间 + 300 × 24 × 3600 × 1000 毫秒。  
路由守卫读取此值，过期则视为未登录。不使用 cookie（避免跨域和 SameSite 复杂性）。

### D5: IndexedDB 封装 — Dexie v4

在 `src/db/index.js` 中初始化 Dexie 实例并导出，后续业务表在此文件统一定义版本和 schema。当前版本仅建库，不定义具体业务表。

### D6: 写死凭据存储位置

账号密码以常量形式写在 `src/config/auth.js`（不提交实际生产凭据，此为纯演示场景）。

## Risks / Trade-offs

- **LocalStorage 安全性** → 凭据本身未存储，仅存会话状态；写死密码在源码中，适合内网/演示场景，生产环境需替换为后端验证。
- **IndexedDB 兼容性** → Safari 14 以下有 IndexedDB 限制，Dexie 4 已处理主流兼容问题；项目明确不支持 IE。
- **Ant Design 包体积** → 使用按需加载（Rsbuild 默认支持 tree-shaking），无需额外配置 babel-plugin-import。
- **React Router BrowserRouter vs HashRouter** → 选 BrowserRouter，部署时需配置 Nginx fallback（或使用 HashRouter 规避）。当前为本地开发，Rsbuild dev server 已处理。
