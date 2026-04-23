## ADDED Requirements

### Requirement: Excel 文件上传
系统 SHALL 提供拖拽和点击两种方式上传 `.xlsx` 或 `.xls` 文件，上传后在前端解析，不发送到服务器。

#### Scenario: 拖拽上传合法文件
- **WHEN** 用户将 `.xlsx` 或 `.xls` 文件拖入上传区域
- **THEN** 系统接收文件，开始解析，上传区显示加载状态

#### Scenario: 点击选择文件
- **WHEN** 用户点击上传区域并在文件选择对话框中选择 `.xlsx` 文件
- **THEN** 系统接收文件，开始解析

#### Scenario: 上传非 Excel 文件
- **WHEN** 用户尝试上传非 `.xlsx`/`.xls` 格式文件
- **THEN** 系统拒绝文件并显示"仅支持 .xlsx / .xls 格式"错误提示

### Requirement: Excel 解析与数据预览
系统 SHALL 在浏览器端使用 SheetJS 解析上传的 Excel 文件第一个 Sheet，将数据转为 JSON 并在表格中动态展示。

#### Scenario: 解析成功并展示数据
- **WHEN** Excel 文件解析成功
- **THEN** 系统根据第一行（表头）动态生成表格列，并渲染所有数据行；表格显示行数统计

#### Scenario: 解析失败
- **WHEN** Excel 文件损坏或格式不支持导致解析失败
- **THEN** 系统显示错误提示"文件解析失败，请检查文件格式"，表格不展示

#### Scenario: 重新上传替换数据
- **WHEN** 用户在已有数据的情况下再次上传新文件
- **THEN** 表格数据被新文件内容替换，旧数据清空
