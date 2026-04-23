## 1. 依赖安装与项目基础配置

- [x] 1.1 安装依赖：`antd`、`@ant-design/icons`、`react-router-dom`、`framer-motion`、`dexie`
- [x] 1.2 在 `src/config/auth.ts` 中定义写死的账号密码常量
- [x] 1.3 在 `src/db/index.ts` 中初始化 Dexie 实例（数据库名 `kbkDB`，版本 1，暂无业务表）
- [x] 1.4 配置 Ant Design 全局主题（ConfigProvider），设置中文语言包

## 2. 路由与认证基础

- [x] 2.1 创建 `src/router/index.tsx`，配置 BrowserRouter 路由结构（`/login`、`/admin/*`）
- [x] 2.2 创建 `src/hooks/useAuth.ts`，实现读写 `kbk_auth` localStorage 的 hook（含过期校验逻辑）
- [x] 2.3 创建 `src/router/PrivateRoute.tsx`，实现路由守卫：未认证跳转 `/login`，已认证访问 `/login` 跳转 `/admin`
- [x] 2.4 修改 `src/App.tsx`，挂载路由系统

## 3. 登录页面

- [x] 3.1 创建 `src/pages/Login/index.tsx`，使用 Ant Design Form、Input、Button 实现登录表单
- [x] 3.2 实现表单非空校验（账号、密码必填）
- [x] 3.3 实现凭据比对逻辑：匹配则写入 localStorage 会话（300 天），跳转 `/admin`；不匹配则显示错误 message
- [x] 3.4 使用 Framer Motion 为登录卡片添加进入动画（opacity + scale，duration 0.4s）
- [x] 3.5 登录页视觉设计：居中卡片布局，背景使用渐变色或浅色图案，符合 Ant Design Pro 设计规范

## 4. 主体布局

- [x] 4.1 创建 `src/layouts/AdminLayout/index.tsx`，使用 Ant Design Layout（Sider + Header + Content）构建整体框架
- [x] 4.2 实现侧边栏菜单（Sider + Menu），展开宽度 220px，收起宽度 64px，支持折叠切换
- [x] 4.3 使用 Framer Motion 为侧边栏折叠动画添加平滑过渡（width 动画，duration 0.25s）
- [x] 4.4 实现顶部 Header（高度 64px），右侧显示"管理员"用户名和退出登录 Dropdown
- [x] 4.5 实现退出登录：清除 `kbk_auth` localStorage 记录并跳转 `/login`
- [x] 4.6 内容区使用 `<Outlet>` 渲染子路由，配置最小高度和内边距，支持垂直滚动
- [x] 4.7 在 `/admin` 默认路由渲染欢迎占位页（简单文字或 Ant Design Empty 组件）

## 5. 路由切换动画

- [x] 5.1 创建 `src/components/PageTransition/index.tsx`，使用 Framer Motion `AnimatePresence` + `motion.div` 实现 opacity 0→1、y 偏移淡入动画（duration 0.2s）
- [x] 5.2 在 AdminLayout 内容区将 `<Outlet>` 包裹在 `PageTransition` 中，并以 `location.pathname` 作为 key 触发动画

## 6. 兼容性验证

- [x] 6.1 确认 `rsbuild.config.js` 中 browserslist 目标覆盖 Chrome 90+、Firefox 88+、Safari 14+、Edge 90+
- [x] 6.2 验证 Dexie 在 Safari 14 下 IndexedDB 正常初始化（Dexie v4 已内置处理）
- [x] 6.3 验证登录、布局、动画在 Chrome / Firefox / Safari / Edge 下均无视觉异常
