## MODIFIED Requirements

### Requirement: 页面整体布局
系统 SHALL 在绩效统计页面顶部显示页面标题，页面内依次包含：操作工具栏（含模版下载按钮、历史记录按钮）、上传区域、数据预览区域。

#### Scenario: 初始空状态
- **WHEN** 用户首次进入绩效统计页面，尚未上传文件
- **THEN** 上传区域显示引导文字，数据预览区域不显示（或显示空状态提示）

#### Scenario: 历史记录按钮可见
- **WHEN** 用户查看页面工具栏
- **THEN** 工具栏显示"历史记录"按钮，点击打开历史记录抽屉，抽屉仅展示 perf-stats 类型的记录

### Requirement: Excel 解析与数据预览
系统 SHALL 在浏览器端使用 SheetJS 解析上传的 Excel 文件第一个 Sheet，将数据转为 JSON 并在表格中动态展示。解析成功后 SHALL 将完整结果与原始文件二进制写入 IndexedDB 历史记录。

#### Scenario: 解析成功并展示数据
- **WHEN** Excel 文件解析成功
- **THEN** 系统根据第一行（表头）动态生成表格列，并渲染所有数据行；表格显示行数统计；同时写入一条 perf-stats 历史记录

#### Scenario: 解析失败
- **WHEN** Excel 文件损坏或格式不支持导致解析失败
- **THEN** 系统显示错误提示"文件解析失败，请检查文件格式"，表格不展示，不写入历史记录

#### Scenario: 重新上传替换数据
- **WHEN** 用户在已有数据的情况下再次上传新文件
- **THEN** 表格数据被新文件内容替换，旧数据清空，新解析结果写入为新历史记录

#### Scenario: 从历史记录回填
- **WHEN** 用户在历史抽屉点击某条记录的"查看"
- **THEN** 系统将该记录 payload 的 `tableData`/`feeSummary`/`validationErrors` set 回页面 state，关闭抽屉，页面展示当时的解析结果
