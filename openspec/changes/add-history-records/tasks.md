## 1. Dexie schema 升级与 historyDb 工具

- [x] 1.1 修改 `src/db/index.ts`：升级 `db.version(2).stores({ historyRecords: '++id, createdAt, type, targetMonth, fileName' })`，保留 version 1 空 stores
- [x] 1.2 在 `src/db/index.ts` 定义并 export `HistoryRecord` TypeScript 接口（含 id/createdAt/type/fileName/fileSize/fileBinary/validCount/invalidCount/targetMonth/payload 字段）
- [x] 1.3 定义并 export `HistoryType = 'perf-stats' | 'lesson-cancel'` 类型，`PerfStatsPayload` 与 `LessonCancelPayload` 接口
- [x] 1.4 新建 `src/utils/historyDb.ts`，实现 `addHistoryRecord(record: Omit<HistoryRecord,'id'>): Promise<number>` 写入
- [x] 1.5 实现 `listHistoryByType(type: HistoryType): Promise<HistoryRecord[]>` 按 createdAt 降序查询
- [x] 1.6 实现 `deleteHistoryRecords(ids: number[]): Promise<void>` 单事务批量删除
- [x] 1.7 实现 `clearHistoryByType(type: HistoryType): Promise<void>` 清空某类型全部
- [x] 1.8 实现 `cleanupExpiredHistory(maxAgeMs = 365*24*60*60*1000): Promise<number>` 删除超期，返回删除条数
- [x] 1.9 实现 `getHistoryRecord(id: number): Promise<HistoryRecord | undefined>` 单条查询
- [x] 1.10 验证：手工在 console 调用 add/list/delete，确认写入与查询正常

## 2. 应用启动清理钩子

- [x] 2.1 在 `src/App.tsx` 顶部加 `useEffect(() => { void cleanupExpiredHistory(); }, [])` 调用清理函数
- [x] 2.2 验证：在 IndexedDB 手工插入一条 `createdAt = Date.now() - 400*24*60*60*1000` 的记录，刷新页面后该记录被删除

## 3. 共享 HistoryDrawer 组件

- [x] 3.1 新建 `src/components/HistoryDrawer/index.tsx` 与 `HistoryDrawer.module.scss`
- [x] 3.2 定义 props：`open: boolean`、`onClose: () => void`、`type: HistoryType`、`onSelect: (record: HistoryRecord) => void`
- [x] 3.3 实现 `useEffect` 在 `open=true` 时调用 `listHistoryByType(type)` 加载列表，存 state
- [x] 3.4 实现列表渲染：antd `List` + 每条记录 `Checkbox` + 上传时间（`dayjs` 或 `toLocaleString` 格式化）+ 文件名 + 行数统计 + "查看"/"下载"按钮
- [x] 3.5 实现顶部批量操作栏：全选 `Checkbox` + "删除选中"（disabled 当无勾选）+ "清空全部"按钮
- [x] 3.6 实现"查看"：调 `props.onSelect(record)` 后 `props.onClose()`
- [x] 3.7 实现"下载"：`new Blob([record.fileBinary], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })` + `URL.createObjectURL` + 临时 `<a>` 触发下载，文件名用 `record.fileName`；fileBinary 缺失时禁用按钮
- [x] 3.8 实现"删除选中"：antd `Modal.confirm` 确认后调 `deleteHistoryRecords(selectedIds)` + 重新加载列表 + 清空勾选
- [x] 3.9 实现"清空全部"：`Modal.confirm` 确认后调 `clearHistoryByType(type)` + 重新加载列表
- [x] 3.10 实现空状态：列表为空时 antd `Empty` 显示"暂无历史记录"
- [x] 3.11 验证：手工插入几条测试记录后打开抽屉，确认列表、勾选、下载、删除、清空全部正常

## 4. PerfStats 页面集成

- [ ] 4.1 在 `src/pages/PerfStats/index.tsx` 加 `historyOpen` state，工具栏加"历史记录"按钮（HistoryOutlined 图标）
- [ ] 4.2 在 `parseFile` 解析成功后调 `addHistoryRecord({ type: 'perf-stats', createdAt: Date.now(), fileName: file.name, fileSize: file.size, fileBinary: await file.arrayBuffer(), validCount: rows.length, invalidCount: 0, targetMonth: null, payload: { tableData: rows, feeSummary, validationErrors: errors.length > 0 ? errors : [] } })`
- [ ] 4.3 注意：当前 PerfStats 校验失败时是阻断模式（弹错误弹窗不展示数据），此场景不写入历史；仅在 `parsed=true` 成功路径写入
- [ ] 4.4 渲染 `<HistoryDrawer open={historyOpen} onClose={()=>setHistoryOpen(false)} type="perf-stats" onSelect={handleHistorySelect} />`
- [ ] 4.5 实现 `handleHistorySelect(record)`：把 `record.payload.tableData`/`feeSummary`/`validationErrors` set 回 state，`setParsed(true)`
- [ ] 4.6 验证：上传文件→打开历史抽屉→看到记录→点查看→页面回填；点下载→原文件下载；勾选删除→列表刷新

## 5. LessonCancelReport 页面集成

- [x] 5.1 在 `src/pages/LessonCancelReport/index.tsx` 加 `historyOpen` state，工具栏加"历史记录"按钮
- [x] 5.2 在 `parseFile` 解析成功后调 `addHistoryRecord({ type: 'lesson-cancel', createdAt: Date.now(), fileName: file.name, fileSize: file.size, fileBinary: await file.arrayBuffer(), validCount: vr.length, invalidCount: ir.length, targetMonth: null, payload: { rawRows: preview, validRows: vr, invalidRows: ir, matrix: null, targetMonth: null } })`（注意此时矩阵尚未生成，payload.matrix 与 targetMonth 均为 null）
- [x] 5.3 用户点击"生成消课表"生成矩阵后，更新最近一条 lesson-cancel 历史记录的 `payload.matrix` 与 `payload.targetMonth` 与 `targetMonth` 字段（用 `db.historyRecords.update(id, {...})`）；若无法定位最近记录则跳过更新
- [x] 5.4 渲染 `<HistoryDrawer ... type="lesson-cancel" onSelect={handleHistorySelect} />`
- [x] 5.5 实现 `handleHistorySelect(record)`：把 `rawRows`/`validRows`/`invalidRows`/`matrix`/`targetMonth` set 回 state，`setParsed(true)`
- [ ] 5.6 验证：上传→生成矩阵→打开历史→看到记录含矩阵与 targetMonth→点查看→页面回填矩阵；点下载→原文件下载；勾选删除→列表刷新

## 6. 端到端验证

- [ ] 6.1 PerfStats：上传合法文件→刷新页面→打开历史抽屉→看到记录→点查看→页面回填成功
- [ ] 6.2 LessonCancelReport：上传真实模版"取值"sheet→生成 5 月矩阵→刷新页面→打开历史→点查看→矩阵回填成功
- [ ] 6.3 下载原始文件：点击某条记录下载，文件内容与原文件一致
- [ ] 6.4 批量删除：勾选多条→删除→列表刷新→勾选清空
- [ ] 6.5 清空全部：点击清空→确认→列表显示空状态
- [ ] 6.6 保留策略：手工插入 createdAt=365天前+1天 的记录（边界）→刷新→应保留；插入 createdAt=366天前→刷新→应被删
- [ ] 6.7 回归：绩效统计与消课表的解析、校验、矩阵生成、导出 Excel 行为不变；菜单切换正常
