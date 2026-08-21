## 1. Dexie schema 升级到 v3 与类型定义

- [x] 1.1 修改 `src/db/index.ts`：在保留 `version(1)` 与 `version(2)` 不变的前提下，追加 `this.version(3).stores({ historyRecords: '++id, createdAt, type, targetMonth, fileName', lessonMonthlyRecords: '[studentName+yearMonth+banXing], studentName, yearMonth', studentQuotas: 'studentName' })`
- [x] 1.2 在 `src/db/index.ts` 定义并 export `LessonMonthlyRecord` 接口（字段：`studentName: string`、`banXing: string`、`yearMonth: string`（"YYYY-MM"）、`dayMap: Record<number, number>`、`total: number`、`savedAt: number`）
- [x] 1.3 定义并 export `StudentQuota` 接口（字段：`studentName: string`、`totalQuota: number`、`importedAt: number`、`note?: string`）
- [x] 1.4 在 `KbkDB` class 中声明 `lessonMonthlyRecords!: Table<LessonMonthlyRecord, [string, string, string]>` 与 `studentQuotas!: Table<StudentQuota, string>` 字段类型
- [x] 1.5 验证：启动 `npm run dev`，浏览器 IndexedDB 面板确认 `kbkDB` 升到 v3 且包含三张表；v2 旧数据（若有）保留

## 2. 持久化存储工具 persistentLessonDb.ts

- [x] 2.1 新建 `src/utils/persistentLessonDb.ts`，import db 与类型
- [x] 2.2 实现 `upsertMonthlyRecords(rows: LessonMonthlyRecord[]): Promise<void>`，在单个 `db.transaction('rw', db.lessonMonthlyRecords, ...)` 内批量 `db.lessonMonthlyRecords.put(row)`，保证原子性
- [x] 2.3 实现 `listMonthlyRecordsByStudent(studentName: string): Promise<LessonMonthlyRecord[]>`，用 `where('studentName').equals(name)` 查询，按 yearMonth 升序返回
- [x] 2.4 实现 `listMonthlyRecordsByYearMonth(yearMonth: string): Promise<LessonMonthlyRecord[]>`，用 `where('yearMonth').equals(yearMonth)` 查询，按 studentName 升序、banXing 升序返回
- [x] 2.5 实现 `listAllMonthlyRecords(): Promise<LessonMonthlyRecord[]>`，全表查询（用于按年份聚合时一次性加载）
- [x] 2.6 实现 `findExistingMonthlyUnits(yearMonth: string, keys: Array<{studentName: string; banXing: string}>): Promise<LessonMonthlyRecord[]>`，先按 yearMonth 查全部，再在内存中过滤匹配 keys，返回已存在的单元列表
- [x] 2.7 实现 `importStudentQuotas(quotas: StudentQuota[]): Promise<{inserted: number; updated: number}>`，事务内逐条 `put()`，根据是否存在主键统计 inserted/updated（用 `db.studentQuotas.get(name)` 预查或 try-catch）
- [x] 2.8 实现 `listAllStudentQuotas(): Promise<StudentQuota[]>`，全表查询，按 studentName 升序返回
- [ ] 2.9 验证：浏览器 console 手工调用上述函数，确认 upsert/查询/覆盖/导入统计均正常

## 3. 课时统计工具 lessonHourStats.ts

- [x] 3.1 新建 `src/utils/lessonHourStats.ts`，import `LessonMonthlyRecord` 与 `StudentQuota` 类型
- [x] 3.2 实现 `aggregateByMonth(units: LessonMonthlyRecord[], year: number): Array<{studentName: string; yearMonth: string; banXing: string; total: number}>`，过滤指定年份的单元，按 (studentName, yearMonth, banXing) 分组返回月度聚合
- [x] 3.3 实现 `aggregateByDay(units: LessonMonthlyRecord[], year: number): Array<{studentName: string; date: string; banXing: string; count: number}>`，过滤指定年份，把 dayMap 展开为 `{date: "YYYY-MM-DD", count}` 行
- [x] 3.4 实现 `computeStudentConsumed(units: LessonMonthlyRecord[], year: number | 'all'): Map<string, number>`，按 studentName 聚合 total，返回 Map
- [x] 3.5 实现 `matchQuota(consumed: number | undefined, quota: StudentQuota | undefined): { consumed: number; quota: number | null; remaining: number | null; status: 'normal' | 'exhausted' | 'over' | 'no-quota' }`，按 design 决策 7 的语义实现
- [x] 3.6 实现 `extractAvailableYears(units: LessonMonthlyRecord[]): number[]`，从 yearMonth 字段提取年份去重升序
- [x] 3.7 实现 `formatYearMonth(year: number, month: number): string`，返回 "YYYY-MM"（month 补零）
- [ ] 3.8 验证：构造 mock units/quotas 数组，确认聚合、匹配、状态判定均正确

## 4. LessonCancelReport 集成"保存到长期存储"

- [x] 4.1 在 `src/pages/LessonCancelReport/index.tsx` import `upsertMonthlyRecords`、`findExistingMonthlyUnits`、`LessonMonthlyRecord` 类型
- [x] 4.2 在矩阵生成成功后（matrix state 非空），渲染工具栏新增"保存到长期存储"按钮（与"导出 Excel"并列，使用 SaveOutlined 或 CloudUploadOutlined 图标）；matrix 为空时按钮 disabled
- [x] 4.3 维护 `savedToPersistent: boolean` state，保存成功后置 true，按钮文案变为"已保存到长期存储"且 disabled；重新生成矩阵或上传新文件时重置为 false
- [x] 4.4 实现 `handleSaveToPersistent`：基于当前 matrix（CancelMatrix）与 targetMonth 组装 `LessonMonthlyRecord[]`——遍历 matrix.rows，每行 `dayMap` 从 `Map<number, number>` 转为 `Record<number, number>` 普通对象（只含非零日），yearMonth=`formatYearMonth(targetMonth.year, targetMonth.month)`
- [x] 4.5 调用 `findExistingMonthlyUnits(yearMonth, matrix.rows.map(r => ({studentName: r.student, banXing: r.banXing})))` 获取已存在单元
- [x] 4.6 已存在单元为空时：直接 `upsertMonthlyRecords(records)`，`message.success("已保存 N 条月度记录")`，`setSavedToPersistent(true)`
- [x] 4.7 已存在单元非空时：受控 `Modal` + 自定义 `footer` 3 按钮（覆盖全部/跳过已存在/取消），title="覆盖确认"
- [x] 4.8 "覆盖全部"分支：`upsertMonthlyRecords(records)`（含已存在），`message.success("已保存 N 条（覆盖 M 条）")`
- [x] 4.9 "跳过已存在"分支：过滤掉已存在单元后 `upsertMonthlyRecords(newRecords)`，`message.success("已保存 N 条（跳过 M 条）")`
- [x] 4.10 "取消"分支：`setOverwriteModal(null)`，不写入，按钮保持可点击
- [x] 4.11 异常处理：`try/catch` 包裹写入，失败时 `message.error("保存失败：X")`，按钮保持可点击
- [ ] 4.12 验证：生成 5 月矩阵→点保存→看到"已保存 N 条"→刷新页面→重新生成 5 月矩阵→点保存→弹覆盖确认→选覆盖/跳过/取消三个分支均按预期工作

## 5. 课时统计页面 LessonHourStats

- [x] 5.1 新建 `src/pages/LessonHourStats/index.tsx` 与 `LessonHourStats.module.scss`
- [x] 5.2 页面整体布局：顶部页头含标题"课时统计"+ 工具栏（导入学生总课时按钮、刷新统计按钮、聚合维度 Radio"按月/按天"）；中部筛选区（年份 Select、学生姓名 Search）；下部统计表格 Card
- [x] 5.3 定义 state：`quotas`、`units`、`loading`、`aggregation`、`selectedYear`、`studentFilter`、`importModalOpen`、`importPreview`
- [x] 5.4 `useEffect` 首次加载时并行调用 `listAllMonthlyRecords()` 与 `listAllStudentQuotas()`，set state；`selectedYear` 默认为 units 中最近年份（若无则 'all'）
- [x] 5.5 实现"导入学生总课时"按钮：打开 `importModalOpen=true`，渲染 `<Modal>` 内嵌上传区 + 预览表 + 确认按钮
- [x] 5.6 上传区使用 antd `Upload` + `xlsx` 解析：表头匹配"学生姓名"/"姓名"/"学生"任一为姓名列，"总课时"/"课时"/"总课"任一为课时列；匹配失败 `message.error` 提示缺少列
- [x] 5.7 解析后预览表显示前 50 条（学生姓名 + 总课时 + 状态），异常行（总课时非数字或空）单独标记
- [x] 5.8 用户点"确认导入"：检查 `quotas` state 中已存在的同名学生，若 > 0 弹 `Modal.confirm` 提示"将覆盖 N 条已有配额"；确认后调 `importStudentQuotas(newQuotas)`，根据返回的 inserted/updated 显示 `message.success("导入完成：新增 X 条，更新 Y 条")`
- [x] 5.9 导入成功后：`setImportModalOpen(false)`、重新 `loadData()` 刷新 quotas 与 units
- [x] 5.10 实现"刷新统计"按钮：点击后 set loading=true，重新查询 units 与 quotas，完成后 loading=false；按钮 loading 期间 disabled
- [x] 5.11 实现聚合维度 Radio：默认 'month'；切换时不重新查 IndexedDB，直接 setAggregation 触发重新渲染
- [x] 5.12 实现年份 Select：options 来自 `extractAvailableYears(units)` + "全部"选项；切换时只 set state
- [x] 5.13 实现学生姓名 Search：onChange set studentFilter，渲染表格时按 studentFilter 模糊过滤
- [x] 5.14 渲染统计表格：按 month 模式列为 [学生姓名, 年月, 班型, 已消耗, 总课时, 剩余, 进度, 状态]；按 day 模式列为 [学生姓名, 日期, 班型, 已消耗, 总课时, 剩余, 进度, 状态]
- [x] 5.15 计算 remaining 与 status：用 `matchQuota`；剩余 < 0 时进度条 100% 且整行红色高亮；无配额时总课时/剩余显示"—"，状态显示"未设配额"
- [x] 5.16 告警面板：units 中存在但 quotas 中无的学生 → warning 列出；quotas 中存在但范围内 units 无消耗的学生 → info 列出
- [x] 5.17 空状态：units 与 quotas 均为空时显示 `Empty` 引导"请先导入学生总课时配额"；只有 quotas 为空时引导"请导入配额以查看剩余课时"
- [ ] 5.18 验证：导入配额→在消课表保存几个月数据→回到课时统计→按月/按天切换→年份切换→学生筛选→剩余课时与超支高亮均正常

## 6. 路由与菜单集成

- [x] 6.1 在 `src/router/index.tsx` import `LessonHourStats` 组件
- [x] 6.2 在 `/admin` 路由的 `children` 数组中新增 `{ path: "lesson-hour-stats", element: <LessonHourStats /> }`
- [x] 6.3 在 `src/layouts/AdminLayout/index.tsx` import `PieChartOutlined` 图标
- [x] 6.4 在 `menuItems` 数组中在"消课表"项之后新增 `{ key: '/admin/lesson-hour-stats', icon: <PieChartOutlined />, label: '课时统计' }`
- [ ] 6.5 验证：点击侧边栏"课时统计"菜单→导航至 `/admin/lesson-hour-stats`→页面正常渲染；菜单选中态高亮正确

## 7. 端到端验证

- [ ] 7.1 完整链路：导入配额 → 上传消课表 → 生成 2026-05 矩阵 → 点"保存到长期存储" → 切到课时统计页面 → 点"刷新统计" → 看到 5 月已消耗与剩余课时
- [ ] 7.2 跨月累计：保存 2026-05 与 2026-06 两个月数据后，课时统计页面"已消耗"= 两月之和
- [ ] 7.3 覆盖链路：对已保存的 2026-05 月份重新生成并保存 → 选"覆盖全部" → 课时统计页面数据更新为新值
- [ ] 7.4 不过期验证：在 IndexedDB 手工插入一条 `savedAt = Date.now() - 400*24*60*60*1000`（超 1 年）的 lessonMonthlyRecord → 刷新应用 → 该记录仍在表中（不被 cleanupExpiredHistory 删除）
- [ ] 7.5 配额覆盖：重新导入含已存在学生的配额 Excel → 弹"将覆盖 N 条"确认 → 确认后 quotas 表中该学生 totalQuota 更新
- [ ] 7.6 未匹配告警：在消课表保存一个未在配额表中的学生 → 课时统计页面告警面板列出该学生
- [ ] 7.7 回归：绩效统计、消课表的解析/校验/矩阵生成/导出 Excel/历史记录功能均不受影响；1 年清理策略对 historyRecords 仍生效
- [x] 7.8 `npm run build` 通过，无 TypeScript 类型错误
