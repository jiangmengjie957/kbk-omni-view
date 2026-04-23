## 1. 依赖安装

- [x] 1.1 在 `package.json` 中添加 `xlsx` 依赖

## 2. 菜单与路由扩展

- [x] 2.1 在 `src/layouts/AdminLayout/index.tsx` 的 `menuItems` 中新增"绩效统计"条目（key: `/admin/perf-stats`，icon: `BarChartOutlined`）
- [x] 2.2 在 `src/router/index.tsx` 中为 `/admin` 子路由新增 `perf-stats` 路由，指向 `PerfStats` 页面组件

## 3. 绩效统计页面

- [x] 3.1 创建 `src/pages/PerfStats/index.tsx`，搭建页面骨架：页面标题、工具栏区域（含模版下载按钮占位）、上传区域、数据预览区域
- [x] 3.2 实现模版下载功能：用 SheetJS 在前端生成含表头（姓名、课程名称、课时数、单价（元/课时））的 `.xlsx` 文件并触发下载，文件名为 `课时费统计模版.xlsx`
- [x] 3.3 实现 Excel 上传区域（Ant Design `Upload.Dragger`），限制文件类型为 `.xlsx`/`.xls`，使用 `beforeUpload` 拦截，阻止自动 HTTP 上传
- [x] 3.4 使用 `FileReader` 读取上传文件为 `ArrayBuffer`，调用 SheetJS 解析第一个 Sheet，将数据转为 JSON 数组存入组件 state
- [x] 3.5 根据解析结果动态生成 Ant Design `Table` 的 `columns`（以第一行 key 为列名），渲染所有数据行，表格顶部显示行数统计
- [x] 3.6 处理异常：上传非 Excel 文件时提示"仅支持 .xlsx / .xls 格式"；解析失败时提示"文件解析失败，请检查文件格式"
