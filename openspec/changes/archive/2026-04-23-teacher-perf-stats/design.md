## Context

绩效统计是后台管理中心的新增业务模块。本期目标定位为"数据探查阶段"——先打通 Excel 上传 → 解析 → 数据预览的完整链路，让开发者和用户看清实际 Excel 数据的列结构，为后续课时费计算逻辑奠定基础。

技术约束：纯前端实现，无后端；使用已有的 Ant Design + React Router 框架；Excel 解析必须在浏览器端完成。

## Goals / Non-Goals

**Goals:**
- 在菜单中注册"绩效统计"入口，路由 `/admin/perf-stats`
- 页面包含：上传区（Ant Design Upload Dragger）、数据预览表格、模版下载按钮
- Excel 解析：读取第一个 Sheet，将所有行转为 JSON，动态生成 Ant Design Table 列
- 模版下载：前端用 SheetJS 生成含预定义表头的 `.xlsx` 文件并触发下载

**Non-Goals:**
- 课时费计算逻辑（下一期）
- 多 Sheet 支持（本期仅处理第一个 Sheet）
- 文件存储/持久化（数据仅在内存中，页面刷新清空）
- 后端上传接口

## Decisions

### D1: Excel 库 — SheetJS (`xlsx`)

选择 `xlsx`（SheetJS Community Edition，Apache-2.0）：
- 纯浏览器端，无需 Node.js，零后端依赖
- API 成熟，支持 `.xlsx`/`.xls`/`.csv` 多格式读写
- 体积约 300KB gzip，可按需 tree-shake

替代方案：`exceljs`（Node.js 为主，浏览器支持较弱）、`papaparse`（仅 CSV）。

### D2: 上传组件 — Ant Design Upload.Dragger + 手动解析

使用 `beforeUpload` 拦截文件，返回 `false` 阻止自动 HTTP 上传，在回调中用 `FileReader` 读取 `ArrayBuffer` 后交给 SheetJS 解析。不依赖服务器。

### D3: 表格列动态生成

从解析后的第一行数据提取 key，动态生成 `columns` 数组传给 Ant Design Table。列宽默认等分，标题直接使用 Excel 表头文字。

### D4: 模版生成策略

在前端用 SheetJS `utils.aoa_to_sheet` 创建仅含表头行的 Sheet，调用 `writeFile` 触发浏览器下载。表头列在代码中以常量数组定义，便于后续扩展。

## Risks / Trade-offs

- **大文件性能** → FileReader + SheetJS 同步解析在主线程；本期场景（学校课时表，通常 < 1000 行）不构成问题，后续可考虑 Web Worker
- **列名不一致** → 用户上传的 Excel 列名可能与模版不符，本期仅展示原始数据，不做校验（下一期计算时需加入列名校验）
- **SheetJS CE 限制** → 社区版不支持加密 xlsx；学校课时表一般无加密，可接受
