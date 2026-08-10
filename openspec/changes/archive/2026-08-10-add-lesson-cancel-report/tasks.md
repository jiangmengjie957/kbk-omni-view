## 1. 工具函数 lessonCancel.ts

- [x] 1.1 新建 `src/utils/lessonCancel.ts`，实现 `normalizeBanXing(raw: string): string | null`：trim 后先按 `1V\d+`/`1v\d+` 抽数字归一为 `1vN`；再查中文映射表（一对一→1v1、一对二→1v2、一对三→1v3、一对四→1v4、一对六→1v6）；都不中返回 null
- [x] 1.2 实现 `parseDateCell(cell: RawCell): { year:number; month:number; day:number } | null`：number 且在 1~73050 按 Excel 1900 epoch（`Date.UTC(1899,11,30) + serial*86400*1000`）转 UTC 年月日；string 先 trim 去杂质前缀（如前导 `:`）再匹配 `(\d{4})[./\-](\d{1,2})[./\-](\d{1,2})` 解析；都不中返回 null
- [x] 1.3 实现 `parseTimeRangeHours(timeStr: string): number | null`：复用 `calcFee.ts` 的 `parseDurationHours` 逻辑，但在调用前把 `~` 替换为 `-`（或在函数内扩展分隔符为 `/[-—~]/`）；解析失败返回 null
- [x] 1.4 实现 `resolveLessonCount(row): { count: number; source: '次数列'|'时段推算' } | null`：次数列为合法正数则直接用；否则用 `parseTimeRangeHours(时段) / 2`；都失败返回 null
- [x] 1.5 实现 `validateRows(headers, dataRows)`：按消课表必需列（日期/时段/次数/学员姓名/班型）校验，返回 `{ validRows, invalidRows: ValidationError[] }`；异常原因文案与 spec 一致（日期不能为空/无法识别为有效日期/班型不能为空/班型无法归一化/学员姓名不能为空/次数与时段均无法解析）
- [x] 1.6 实现 `buildCancelMatrix(validRows, targetYear, targetMonth)`：按学生拆分（复用 `parseStudentCount` 的 split 正则）、归一化班型、按日期单元格累加节数；返回 `{ rows: MatrixRow[]; daysInMonth: number }`，`MatrixRow = { key, student, banXing, dayMap: Map<number, number>, total }`；行按 student 升序、banXing 升序

## 2. 路由与菜单注册

- [x] 2.1 在 `src/router/index.tsx` 的 `/admin` children 新增子路由 `lesson-cancel-report`，import `src/pages/LessonCancelReport/index.tsx`
- [x] 2.2 在 `src/layouts/AdminLayout/index.tsx` 的 `menuItems` 追加"消课表"项：key=`/admin/lesson-cancel-report`、icon=`<ScheduleOutlined />`、label="消课表"
- [x] 2.3 验证：登录后侧边栏出现三项（首页/绩效统计/消课表），点击"消课表"导航至新页面且高亮选中

## 3. 消课表页面骨架与上传解析

- [x] 3.1 新建 `src/pages/LessonCancelReport/index.tsx` 与 `LessonCancelReport.module.scss`，参照 PerfStats 页面结构样式 token（pageHeader/uploadSection 等）
- [x] 3.2 实现页面布局：页头（标题"消课表" + 工具栏含"生成消课表"与"导出 Excel"按钮）、上传 Dragger、原始数据预览 Table、（条件渲染）异常告警面板与消课矩阵区域
- [x] 3.3 实现上传与解析：SheetJS `XLSX.read`，优先取名为"取值"的 sheet 否则取第一个；第 0 行为表头（无标题行），数据行从第 1 行起
- [x] 3.4 必需列校验：表头须含 `日期`/`时段`/`次数`/`学员姓名`/`班型`（`科目`/`老师`/`年级`/`学生人数` 可选但不参与计算）；缺任一必需列提示"缺少列：X"不进入矩阵
- [x] 3.5 解析成功后展示原始数据预览（动态列、显示行数统计），状态管理 `rawRows`/`validRows`/`invalidRows`/`targetMonth`/`matrix`/`parsed`
- [x] 3.6 解析失败/空文件/非 Excel 文件提示与 PerfStats 一致

## 4. 异常行告警面板

- [x] 4.1 在矩阵区域上方渲染 antd `Alert`（type=warning），当 `invalidRows.length > 0` 时显示，文案"共 N 行异常已跳过统计"
- [x] 4.2 面板内嵌 antd `List` 列出每条异常：行号 Tag（error）、字段 Tag（warning）、原因文本、原始值（secondary）
- [x] 4.3 验证：用真实模版"取值"sheet 上传，确认告警面板正确识别"小班"/"初三"误填班型行、文本日期行（若不可解析）、空字段行

## 5. 月份选择逻辑

- [x] 5.1 实现 `extractMonths(validRows)`：扫描有效行日期的 `{year, month}` 集合，升序去重
- [x] 5.2 "生成消课表"按钮 onClick：调 `extractMonths`，单月直接 `setTargetMonth` 进矩阵生成；多月弹 antd `Modal` + `Radio.Group` 列出月份，默认选最大（最近）月，确认后 `setTargetMonth`
- [x] 5.3 弹窗取消时不生成矩阵，保持预览态；弹窗文案提示"导入数据涉及多个月，请选择要生成消课表的月份"
- [x] 5.4 验证：单月文件点按钮直接出矩阵；跨月文件弹窗，选择后生成对应月矩阵

## 6. 矩阵生成与表格渲染

- [x] 6.1 调用 `buildCancelMatrix(validRows, targetYear, targetMonth)`，得到 rows 与 daysInMonth
- [x] 6.2 构造 antd Table `columns`：序号（width 56 fixed left）、学生姓名（width 100 fixed left）、班型（width 70 fixed left）、1..daysInMonth（每列 width 48 align center）、汇总（width 90 fixed right align right）
- [x] 6.3 单元格 render：`dayMap.get(day)` 有值显示（整数无小数、小数保留 2 位），无值留空；汇总列同理
- [x] 6.4 设置 `scroll={{ x: 'max-content' }}` 与 `tableLayout="fixed"`，左三列 + 右汇总列固定，中间日期列横向滚动
- [x] 6.5 表格上方标题栏显示"消课表 · YYYY 年 MM 月 · 共 N 位学生"
- [x] 6.6 验证：用真实模版"取值"sheet（5 月数据）生成 5 月矩阵，对照手工计算抽查几个学生节数（如彭少棋 1v3 = 5 月 2/3/10/16/23/31 各 1 节 = 6 节）

## 7. 导出 Excel

- [x] 7.1 实现 `exportCancelMatrix(matrix, targetYear, targetMonth)`：用 `XLSX.utils.aoa_to_sheet` 生成二维数组
- [x] 7.2 Row 0：标题 `"X月课时汇总"`；设置 `ws['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:daysInMonth+3} }]` 跨列合并
- [x] 7.3 Row 1：表头 `["序号","学生姓名","班型",1,2,...,daysInMonth,"汇总"]`
- [x] 7.4 Row 2+：每个 MatrixRow 一行，序号从 1 连续递增，日期列填 dayMap 值（无值填 null），末列填 total
- [x] 7.5 设置 `ws['!cols']` 列宽（序号 8、学生姓名 16、班型 10、日期列 6、汇总 10）
- [x] 7.6 `XLSX.utils.book_append_sheet` + `XLSX.writeFile` 落盘，文件名 `消课表_${year}年${month}月.xlsx`
- [x] 7.7 "导出 Excel"按钮：未生成矩阵时 disabled + tooltip"请先生成消课表"；已生成时点击触发导出
- [x] 7.8 验证：导出文件用 Excel 打开，结构与"消课时汇总表"模版一致，标题合并、表头、数据行、序号连续

## 8. 端到端验证

- [x] 8.1 用 `/Users/jiangmengjie/Downloads/jz/消课表.xls` 的"取值"sheet 上传，生成 5 月消课表，抽查 5+ 个学生节数与手工计算一致
- [x] 8.2 验证异常告警面板：识别出"小班"/"初三"误填班型行、不可解析文本日期行（如有）、空字段行
- [x] 8.3 验证 1v多拆行：彭少棋 1v3 在 5/16 与杨韵可同上 1v3 课，两人各自 5/16 单元格各计 1
- [x] 8.4 验证次数=0.5 折算：找次数列=0.5 的行（如 9:00-10:00 短课），对应单元格 = 0.5
- [x] 8.5 验证导出文件结构与模版一致
- [x] 8.6 回归绩效统计页面：上传合法文件行为不变，侧边栏三项菜单切换正常
