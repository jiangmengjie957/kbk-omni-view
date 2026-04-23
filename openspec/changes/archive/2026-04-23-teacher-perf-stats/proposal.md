## Why

管理后台目前缺少教学绩效管理能力。学校需要定期统计老师的课时费，当前只能靠人工计算 Excel，效率低且易出错。通过在后台新增"绩效统计"模块，支持上传课时数据 Excel、自动汇总课时费，并提供标准模版下载，可大幅降低操作成本。

## What Changes

- 在管理后台左侧菜单新增"绩效统计"菜单项，路由 `/admin/perf-stats`
- 新增绩效统计页面，包含：
  - Excel 文件上传区域（拖拽 + 点击选择）
  - 上传后解析并展示原始数据预览表格（本期目标：看清数据结构）
  - 模版下载按钮，提供预定义好列结构的 `.xlsx` 模版文件
- 引入 Excel 读写库（`xlsx` / SheetJS）处理文件解析与模版生成
- 本期**不做**课时费计算逻辑，仅完成上传 → 解析 → 预览的数据探查流程

## Capabilities

### New Capabilities

- `perf-stats-page`: 绩效统计整体页面框架，含菜单注册、路由配置、页面骨架
- `excel-upload`: Excel 文件上传与解析，将工作表数据转为 JSON 并渲染预览表格
- `excel-template`: 模版 Excel 文件生成与下载，提供标准列结构供用户填写

### Modified Capabilities

- `admin-layout`: 在菜单列表中新增"绩效统计"菜单项（路由 `/admin/perf-stats`），需同步更新 `menuItems` 配置

## Impact

- 新增依赖：`xlsx`（SheetJS，Apache-2.0 许可，纯前端，无后端依赖）
- 新增文件：`src/pages/PerfStats/index.tsx`
- 修改文件：`src/layouts/AdminLayout/index.tsx`（菜单项扩展）
- 无 BREAKING 变更
