## MODIFIED Requirements

### Requirement: 侧边栏菜单
系统 SHALL 在主体布局左侧渲染一个垂直导航菜单，支持收起/展开切换，展示系统名称和菜单项列表。菜单项 SHALL 包含"首页"、"绩效统计"和"消课表"三个入口。

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

#### Scenario: 消课表菜单项可见
- **WHEN** 用户查看侧边栏菜单
- **THEN** 菜单中显示"消课表"条目，图标为 ScheduleOutlined（或同类日程图标），点击导航至 `/admin/lesson-cancel-report`
