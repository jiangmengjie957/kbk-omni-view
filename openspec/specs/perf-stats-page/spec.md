## ADDED Requirements

### Requirement: 绩效统计页面路由注册
系统 SHALL 在路由配置中注册 `/admin/perf-stats` 路由，指向绩效统计页面组件。

#### Scenario: 通过菜单导航
- **WHEN** 用户点击侧边栏"绩效统计"菜单项
- **THEN** 系统导航至 `/admin/perf-stats`，内容区渲染绩效统计页面

#### Scenario: 直接访问路由
- **WHEN** 已登录用户在浏览器地址栏输入 `/admin/perf-stats`
- **THEN** 系统正常渲染绩效统计页面，不重定向

### Requirement: 页面整体布局
系统 SHALL 在绩效统计页面顶部显示页面标题，页面内依次包含：操作工具栏（含模版下载按钮）、上传区域、数据预览区域。

#### Scenario: 初始空状态
- **WHEN** 用户首次进入绩效统计页面，尚未上传文件
- **THEN** 上传区域显示引导文字，数据预览区域不显示（或显示空状态提示）
