## ADDED Requirements

### Requirement: 侧边栏菜单
系统 SHALL 在主体布局左侧渲染一个垂直导航菜单，支持收起/展开切换，展示系统名称和菜单项列表。菜单项 SHALL 包含"首页"和"绩效统计"两个入口。

#### Scenario: 菜单展开状态
- **WHEN** 侧边栏处于展开状态
- **THEN** 系统显示菜单项图标和文字标签，宽度为 220px

#### Scenario: 菜单收起状态
- **WHEN** 用户点击折叠按钮
- **THEN** 侧边栏收起至仅显示图标（宽度 64px），菜单文字隐藏，tooltip 在 hover 时显示

#### Scenario: 菜单折叠动画
- **WHEN** 菜单在展开与收起之间切换
- **THEN** 系统通过 Framer Motion 动画平滑过渡（duration 约 0.25s）

#### Scenario: 绩效统计菜单项可见
- **WHEN** 用户查看侧边栏菜单
- **THEN** 菜单中显示"绩效统计"条目，图标为 BarChartOutlined，点击导航至 `/admin/perf-stats`

### Requirement: 顶部 Header
系统 SHALL 在主体布局顶部渲染固定高度（64px）的 Header 栏，包含当前登录用户名和退出登录入口。

#### Scenario: Header 显示用户信息
- **WHEN** 用户已登录进入主体页面
- **THEN** Header 右侧显示用户名（或默认"管理员"）和下拉菜单图标

#### Scenario: Header 退出登录
- **WHEN** 用户点击 Header 中的退出按钮
- **THEN** 系统触发退出登录流程（清除会话并跳转登录页）

### Requirement: 内容区域
系统 SHALL 在侧边栏右侧、Header 下方渲染内容区域，通过 React Router `<Outlet>` 展示当前路由对应的子页面。

#### Scenario: 空内容区占位
- **WHEN** 系统暂无子页面配置
- **THEN** 内容区显示一个简洁的空状态占位（如欢迎文字或空视图）

#### Scenario: 子页面渲染
- **WHEN** 路由匹配到某个子页面组件
- **THEN** 该组件渲染在内容区域内，内容区具备垂直滚动能力

### Requirement: 路由切换过渡动画
系统 SHALL 在内容区子页面切换时，通过 Framer Motion 提供淡入动画效果，提升视觉流畅度。

#### Scenario: 页面切换淡入
- **WHEN** 用户点击菜单切换到另一个子页面
- **THEN** 新页面以 opacity 0→1、轻微 y 偏移的动画进入（duration 约 0.2s）

### Requirement: 响应式布局
系统 SHALL 在主流桌面分辨率（≥1280px 宽）下正常显示，侧边栏固定，内容区自适应剩余宽度。

#### Scenario: 宽屏显示
- **WHEN** 浏览器视口宽度 ≥ 1280px
- **THEN** 侧边栏与内容区并排显示，布局稳定无错位
