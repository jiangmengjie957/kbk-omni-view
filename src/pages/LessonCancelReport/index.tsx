import { useState } from 'react';
import { Typography, Button, Upload, Table, Modal, Checkbox, Alert, List, Tag, message, Tooltip } from 'antd';
import type { UploadProps, TableColumnsType } from 'antd';
import { DownloadOutlined, InboxOutlined, TableOutlined, HistoryOutlined, CloudUploadOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import {
  validateRows,
  extractMonths,
  buildCancelMatrix,
  formatLessonCount,
  type RawCell,
  type ValidRow,
  type ValidationError,
  type YearMonth,
  type CancelMatrix,
  type MatrixRow,
  REQUIRED_HEADERS,
} from '../../utils/lessonCancel';
import {
  addHistoryRecord,
  getLatestHistoryByType,
  updateHistoryRecord,
  isLessonCancelPayload,
} from '../../utils/historyDb';
import {
  upsertMonthlyRecord,
  findExistingMonthlyUnit,
} from '../../utils/persistentLessonDb';
import { formatYearMonth } from '../../utils/lessonHourStats';
import type {
  HistoryRecord,
  LessonCancelPayload,
  LessonMonthlyRecord,
  StudentMonthlyEntry,
} from '../../db';
import HistoryDrawer from '../../components/HistoryDrawer';
import styles from './LessonCancelReport.module.scss';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const SHEET_NAME = '取值';

interface PreviewRow {
  _rowKey: number;
  [header: string]: string | number;
}

interface MonthOption extends YearMonth {
  label: string;
}

function fmtMonth(m: YearMonth): string {
  return `${m.year}年${m.month}月`;
}

function fmtMonthShort(m: YearMonth): string {
  return `${m.year}-${String(m.month).padStart(2, '0')}`;
}

export default function LessonCancelReport() {
  const [messageApi, contextHolder] = message.useMessage();
  // 用 Modal.useModal() hook 模式，避免命令式 Modal.confirm 被其他元素遮挡
  const [modal, modalContextHolder] = Modal.useModal();
  const [rawRows, setRawRows] = useState<PreviewRow[]>([]);
  const [previewColumns, setPreviewColumns] = useState<TableColumnsType<PreviewRow>>([]);
  const [validRows, setValidRows] = useState<ValidRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<ValidationError[]>([]);
  const [parsed, setParsed] = useState(false);
  const [monthModalOpen, setMonthModalOpen] = useState(false);
  const [monthOptions, setMonthOptions] = useState<MonthOption[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // 多月矩阵：一次生成多个月的矩阵，按月份分段展示
  const [matrices, setMatrices] = useState<Array<{ month: YearMonth; matrix: CancelMatrix }>>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  // 已保存到长期存储的月份集合（yearMonth 字符串）
  const [savedMonths, setSavedMonths] = useState<Set<string>>(new Set());

  // ── Excel 解析 ──────────────────────────────────────────────
  function parseFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result as ArrayBuffer, { type: 'array' });
        // 优先取名为"取值"的 sheet，否则取第一个
        const sheetName =
          workbook.SheetNames.includes(SHEET_NAME)
            ? SHEET_NAME
            : workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRowsArr = XLSX.utils.sheet_to_json<RawCell[]>(sheet, {
          header: 1,
          defval: null,
        });

        if (rawRowsArr.length < 2) {
          void messageApi.warning('文件内容为空或格式不符，请使用模版填写后上传');
          return;
        }

        // 第 0 行为表头
        const headers = (rawRowsArr[0] as (string | null)[])
          .map(h => (h == null ? '' : String(h).trim()))
          .filter(Boolean) as string[];

        // 必需列校验
        const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h));
        if (missing.length > 0) {
          void messageApi.error(`缺少必需列：${missing.join('、')}`);
          return;
        }

        const dataRows = rawRowsArr
          .slice(1)
          .filter(row => (row as RawCell[]).some(c => c !== null && c !== '')) as RawCell[][];

        if (dataRows.length === 0) {
          void messageApi.warning('数据区域为空，请填写数据后上传');
          return;
        }

        // 校验
        const { validRows: vr, invalidRows: ir } = validateRows(headers, dataRows);

        // 原始数据预览
        const cols: TableColumnsType<PreviewRow> = headers.map((header) => ({
          title: header,
          dataIndex: header,
          key: header,
          ellipsis: true,
          width: header === '日期' || header === '时段' ? 140 : 100,
        }));
        const preview: PreviewRow[] = dataRows.map((rawRow, i) => {
          const row = rawRow as RawCell[];
          const obj: PreviewRow = { _rowKey: i };
          headers.forEach((header, colIdx) => {
            const cell = row[colIdx];
            obj[header] = cell != null ? String(cell) : '';
          });
          return obj;
        });

        setPreviewColumns(cols);
        setRawRows(preview);
        setValidRows(vr);
        setInvalidRows(ir);
        setParsed(true);
        setMatrices([]);
        setSavedMonths(new Set());
        const okCount = vr.length;
        const warnCount = ir.length;
        if (warnCount > 0) {
          void messageApi.warning(
            `解析完成：${okCount} 条有效，${warnCount} 条异常已跳过`,
          );
        } else {
          void messageApi.success(`解析成功，共 ${okCount} 条记录`);
        }

        // 写入历史记录（此时矩阵尚未生成，payload.matrix 与 targetMonth 均为 null）
        try {
          const fileBuffer = (e.target?.result as ArrayBuffer).slice(0);
          const payload: LessonCancelPayload = {
            rawRows: preview,
            validRows: vr,
            invalidRows: ir,
            matrix: null,
            targetMonth: null,
          };
          void addHistoryRecord({
            createdAt: Date.now(),
            type: 'lesson-cancel',
            fileName: file.name,
            fileSize: file.size,
            fileBinary: fileBuffer,
            validCount: vr.length,
            invalidCount: ir.length,
            targetMonth: null,
            payload,
          });
        } catch (err) {
          console.warn('[history] 写入失败:', err);
        }
      } catch {
        void messageApi.error('文件解析失败，请检查文件格式');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.xlsx,.xls',
    showUploadList: false,
    beforeUpload(file) {
      const isExcel =
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel' ||
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls');
      if (!isExcel) {
        void messageApi.error('仅支持 .xlsx / .xls 格式');
        return Upload.LIST_IGNORE;
      }
      parseFile(file);
      return false;
    },
  };

  // ── 生成消课表 ──────────────────────────────────────────────
  function handleGenerate() {
    if (validRows.length === 0) {
      void messageApi.warning('没有有效数据，无法生成消课表');
      return;
    }
    const months = extractMonths(validRows);
    if (months.length === 0) {
      void messageApi.warning('没有有效日期，无法生成消课表');
      return;
    }
    if (months.length === 1) {
      generateForMonths([months[0]]);
      return;
    }
    // 多月：弹窗（多选，默认全选）
    const opts: MonthOption[] = months.map(m => ({ ...m, label: fmtMonth(m) }));
    setMonthOptions(opts);
    setSelectedMonths(opts.map(o => fmtMonthShort(o))); // 默认全选
    setMonthModalOpen(true);
  }

  function generateForMonths(months: YearMonth[]) {
    const newMatrices = months.map(m => ({
      month: m,
      matrix: buildCancelMatrix(validRows, m.year, m.month),
    }));
    setMatrices(newMatrices);
    setSavedMonths(new Set()); // 重新生成后重置保存状态
    void messageApi.success(
      `已生成 ${months.length} 个月消课表（${months.map(m => fmtMonth(m)).join('、')}）`,
    );
    // 更新最近一条 lesson-cancel 历史记录（兼容单月场景：取第一个月份）
    if (newMatrices.length > 0) {
      const first = newMatrices[0];
      void (async () => {
        try {
          const latest = await getLatestHistoryByType('lesson-cancel');
          if (!latest || !latest.id) return;
          if (!isLessonCancelPayload(latest.payload)) return;
          const updatedPayload: LessonCancelPayload = {
            ...latest.payload,
            matrix: first.matrix,
            targetMonth: first.month,
          };
          await updateHistoryRecord(latest.id, {
            payload: updatedPayload,
            targetMonth: first.month,
          });
        } catch (err) {
          console.warn('[history] 更新矩阵失败:', err);
        }
      })();
    }
  }

  function handleMonthConfirm() {
    const opts = monthOptions.filter(o => selectedMonths.includes(fmtMonthShort(o)));
    if (opts.length === 0) {
      void messageApi.warning('请至少选择一个月份');
      return;
    }
    setMonthModalOpen(false);
    generateForMonths(opts);
  }

  // ── 从历史记录回填 ─────────────────────────────────────────
  function handleHistorySelect(record: HistoryRecord) {
    if (!isLessonCancelPayload(record.payload)) {
      void messageApi.error('历史记录数据格式异常');
      return;
    }
    const p = record.payload;
    // rawRows 是按 header 映射的对象数组；需要重建 previewColumns
    if (p.rawRows.length > 0) {
      const firstRow = p.rawRows[0] as Record<string, string | number>;
      const headers = Object.keys(firstRow).filter(k => k !== '_rowKey');
      const cols: TableColumnsType<PreviewRow> = headers.map((header) => ({
        title: header,
        dataIndex: header,
        key: header,
        ellipsis: true,
        width: header === '日期' || header === '时段' ? 140 : 100,
      }));
      setPreviewColumns(cols);
    } else {
      setPreviewColumns([]);
    }
    setRawRows(p.rawRows as PreviewRow[]);
    setValidRows(p.validRows as ValidRow[]);
    setInvalidRows(p.invalidRows as ValidationError[]);
    // 历史记录回填：单矩阵包装成单元素数组，复用多月展示逻辑
    const restoredMatrix = (p.matrix as CancelMatrix) ?? null;
    const restoredMonth = (p.targetMonth as YearMonth) ?? null;
    if (restoredMatrix && restoredMonth) {
      setMatrices([{ month: restoredMonth, matrix: restoredMatrix }]);
    } else {
      setMatrices([]);
    }
    setParsed(true);
    setSavedMonths(new Set());
    void messageApi.success(`已回填历史记录：${record.fileName}`);
  }

  // ── 导出指定月份 Excel ─────────────────────────────────────
  function handleExportMonth(m: YearMonth, mat: CancelMatrix) {
    exportCancelMatrix(mat, m);
  }

  // ── 保存单个月到长期存储 ──────────────────────────────────
  async function handleSaveMonthToPersistent(m: YearMonth, mat: CancelMatrix) {
    const yearMonth = formatYearMonth(m.year, m.month);
    const now = Date.now();

    // 把该月矩阵打包成一条月度单元
    const students: StudentMonthlyEntry[] = mat.rows.map(r => {
      const dayMap: Record<number, number> = {};
      r.dayMap.forEach((v, day) => {
        if (v != null && v !== 0) dayMap[day] = v;
      });
      return {
        studentName: r.student,
        banXing: r.banXing,
        dayMap,
        total: r.total,
      };
    });

    const record: LessonMonthlyRecord = {
      yearMonth,
      students,
      total: students.reduce((sum, s) => sum + s.total, 0),
      savedAt: now,
    };

    try {
      const existing = await findExistingMonthlyUnit(yearMonth);

      const doSave = async () => {
        await upsertMonthlyRecord(record);
        setSavedMonths(prev => new Set(prev).add(yearMonth));
        void messageApi.success(
          `已保存 ${yearMonth} 月度记录（${students.length} 位学生，共 ${record.total} 节）`,
        );
      };

      if (!existing) {
        await doSave();
        return;
      }

      modal.confirm({
        title: '覆盖确认',
        content: `${yearMonth} 已存在长期消课单元（${existing.students.length} 位学生），是否覆盖？`,
        okText: '覆盖',
        okType: 'danger',
        cancelText: '取消',
        onOk: doSave,
      });
    } catch (err) {
      console.error('[persistent] 保存失败:', err);
      void messageApi.error(`保存失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── 保存所有未保存月份到长期存储 ──────────────────────────
  async function handleSaveAllToPersistent() {
    if (matrices.length === 0) {
      void messageApi.warning('请先生成消课表');
      return;
    }
    const unsaved = matrices.filter(
      ({ month }) => !savedMonths.has(formatYearMonth(month.year, month.month)),
    );
    if (unsaved.length === 0) {
      void messageApi.info('所有月份已保存到长期存储');
      return;
    }
    // 逐月保存（每条 upsertMonthlyRecord 内部会检测覆盖，这里简化为直接覆盖不弹确认）
    let savedCount = 0;
    for (const { month, matrix: mat } of unsaved) {
      const yearMonth = formatYearMonth(month.year, month.month);
      const existing = await findExistingMonthlyUnit(yearMonth);
      if (existing) {
        // 有已存在的月份，整体走覆盖确认流程
        modal.confirm({
          title: '覆盖确认',
          content: `${unsaved.length} 个月度单元中，部分月份已存在长期记录（如 ${yearMonth}），是否全部覆盖？`,
          okText: '全部覆盖',
          okType: 'danger',
          cancelText: '取消',
          onOk: async () => {
            for (const { month: m, matrix: mm } of unsaved) {
              await handleSaveMonthToPersistent(m, mm);
            }
          },
        });
        return;
      }
      // 全新保存
      await handleSaveMonthToPersistent(month, mat);
      savedCount++;
    }
    if (savedCount > 0) {
      void messageApi.success(`已保存 ${savedCount} 个月度单元`);
    }
  }

  function exportCancelMatrix(mat: CancelMatrix, m: YearMonth) {
    const { rows, daysInMonth } = mat;
    // Row 0: 标题
    const titleRow = [`${m.month}月课时汇总`];
    // Row 1: 表头
    const headerRow = ['序号', '学生姓名', '班型', ...Array.from({ length: daysInMonth }, (_, i) => i + 1), '汇总'];
    // Row 2+: 数据行
    const dataRowsArr = rows.map((r, i) => {
      const dayArr = Array.from({ length: daysInMonth }, (_, d) => {
        const v = r.dayMap.get(d + 1);
        return v == null ? null : v;
      });
      return [i + 1, r.student, r.banXing, ...dayArr, r.total];
    });

    const aoa: (string | number | null)[][] = [titleRow, headerRow, ...dataRowsArr];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // 标题行合并：A1 到最后一列
    const lastCol = headerRow.length - 1; // 0-indexed
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }];

    // 列宽
    const colsWidth = [
      { wch: 8 },   // 序号
      { wch: 16 },  // 学生姓名
      { wch: 10 },  // 班型
      ...Array.from({ length: daysInMonth }, () => ({ wch: 6 })),
      { wch: 10 },  // 汇总
    ];
    ws['!cols'] = colsWidth;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '消课时汇总表');
    XLSX.writeFile(wb, `消课表_${m.year}年${m.month}月.xlsx`);
  }

  // ── 矩阵列构造（按天数动态生成，每月独立）─────────────────
  function buildMatrixColumns(days: number): TableColumnsType<MatrixRow & { _seq: number }> {
    return [
      { title: '序号', dataIndex: '_seq', key: '_seq', width: 56, fixed: 'left', align: 'center' },
      { title: '学生姓名', dataIndex: 'student', key: 'student', width: 100, fixed: 'left' },
      { title: '班型', dataIndex: 'banXing', key: 'banXing', width: 70, fixed: 'left' },
      ...Array.from({ length: days }, (_, i) => {
        const day = i + 1;
        return {
          title: String(day),
          dataIndex: `day_${day}`,
          key: `day_${day}`,
          width: 48,
          align: 'center' as const,
          render: (_: unknown, record: MatrixRow) => {
            const v = record.dayMap.get(day);
            if (v == null) return '';
            const cls = Number.isInteger(v) ? '' : styles.fraction;
            return <span className={cls}>{formatLessonCount(v)}</span>;
          },
        };
      }),
      {
        title: '汇总',
        dataIndex: 'total',
        key: 'total',
        width: 90,
        fixed: 'right',
        align: 'right',
        render: (v: number) => <strong>{formatLessonCount(v)}</strong>,
      },
    ];
  }

  function buildMatrixDataSource(mat: CancelMatrix) {
    return mat.rows.map((r, i) => ({ ...r, _seq: i + 1 }));
  }

  return (
    <div className={styles.page}>
      {contextHolder}
      {modalContextHolder}

      {/* 页头 */}
      <div className={styles.pageHeader}>
        <Title level={4} className={styles.title}>消课表</Title>
        <div className={styles.toolbar}>
          <Button
            type="primary"
            icon={<TableOutlined />}
            onClick={handleGenerate}
            disabled={!parsed || validRows.length === 0}
          >
            生成消课表
          </Button>
          <Tooltip title={matrices.length === 0 ? '请先生成消课表' : ''}>
            <Button
              icon={<CloudUploadOutlined />}
              onClick={handleSaveAllToPersistent}
              disabled={matrices.length === 0 || savedMonths.size === matrices.length}
            >
              {savedMonths.size === matrices.length && matrices.length > 0
                ? '已全部保存到长期存储'
                : '保存全部到长期存储'}
            </Button>
          </Tooltip>
          <Button
            icon={<HistoryOutlined />}
            onClick={() => setHistoryOpen(true)}
          >
            历史记录
          </Button>
          <Button
            type="text"
            icon={<QuestionCircleOutlined />}
            onClick={() => setHelpOpen(true)}
          >
            使用说明
          </Button>
        </div>
      </div>

      {/* 上传区 */}
      <div className={styles.uploadSection}>
        <div className={styles.uploadSectionTitle}>上传"取值"sheet</div>
        <Dragger {...uploadProps} className={styles.dragger}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或将 Excel 文件拖拽到此区域上传</p>
          <p className={styles.uploadHint}>
            支持 .xlsx / .xls 格式，优先解析名为"取值"的 sheet，需第 1 行为表头（日期/时段/科目/老师/次数/学员姓名/年级/班型/学生人数）
          </p>
        </Dragger>
      </div>

      {/* 异常告警面板 */}
      {parsed && invalidRows.length > 0 && (
        <Alert
          type="warning"
          showIcon
          className={styles.alertBox}
          message={`共 ${invalidRows.length} 项异常已跳过统计`}
          description={
            <List
              size="small"
              dataSource={invalidRows}
              className={styles.errorList}
              renderItem={(err) => (
                <List.Item className={styles.errorItem}>
                  <Tag color="error">第 {err.row} 行</Tag>
                  {err.field && <Tag color="warning">{err.field}</Tag>}
                  <span className={styles.errorReason}>{err.reason}</span>
                  {err.value && <Text type="secondary" className={styles.errorValue}>（原始值：{err.value}）</Text>}
                </List.Item>
              )}
            />
          }
        />
      )}

      {/* 消课矩阵（按月份分段展示，支持多月）*/}
      {matrices.map(({ month, matrix: mat }) => {
        const yearMonth = formatYearMonth(month.year, month.month);
        const monthSaved = savedMonths.has(yearMonth);
        return (
          <div className={styles.matrixSection} key={yearMonth}>
            <div className={styles.matrixHeader}>
              <span className={styles.matrixTitle}>
                消课表 · {fmtMonth(month)}
              </span>
              <div className={styles.toolbar}>
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => handleExportMonth(month, mat)}
                >
                  导出 Excel
                </Button>
                <Tooltip title={monthSaved ? '本月度已保存到长期存储' : ''}>
                  <Button
                    size="small"
                    icon={<CloudUploadOutlined />}
                    onClick={() => handleSaveMonthToPersistent(month, mat)}
                    disabled={monthSaved}
                  >
                    {monthSaved ? '已保存' : '保存到长期存储'}
                  </Button>
                </Tooltip>
                <Text className={styles.rowCount}>共 {mat.rows.length} 位学生</Text>
              </div>
            </div>
            <Table
              className={styles.matrixTable}
              columns={buildMatrixColumns(mat.daysInMonth)}
              dataSource={buildMatrixDataSource(mat)}
              rowKey="key"
              size="small"
              scroll={{ x: 'max-content' }}
              tableLayout="fixed"
              pagination={false}
            />
          </div>
        );
      })}

      {/* 原始数据预览 */}
      {parsed && (
        <div className={styles.previewSection}>
          <div className={styles.previewHeader}>
            <span className={styles.previewTitle}>原始数据预览</span>
            <Text className={styles.rowCount}>
              共 {rawRows.length} 条记录（{validRows.length} 条有效 / {invalidRows.length} 条异常）
            </Text>
          </div>
          <Table
            columns={previewColumns}
            dataSource={rawRows}
            rowKey="_rowKey"
            size="middle"
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 20, showSizeChanger: true, showQuickJumper: true }}
          />
        </div>
      )}

      {/* 月份选择弹窗（多选）*/}
      <Modal
        open={monthModalOpen}
        title="选择生成消课表的月份（可多选）"
        onCancel={() => setMonthModalOpen(false)}
        onOk={handleMonthConfirm}
        okText="生成"
        cancelText="取消"
      >
        <p style={{ marginBottom: 12, color: '#666' }}>
          导入数据涉及多个月，请勾选要生成消课表的月份（已默认全选）：
        </p>
        <Checkbox.Group
          value={selectedMonths}
          onChange={(checkedValues) => setSelectedMonths(checkedValues as string[])}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {monthOptions.map(o => (
            <Checkbox key={fmtMonthShort(o)} value={fmtMonthShort(o)}>
              {o.label}
            </Checkbox>
          ))}
        </Checkbox.Group>
      </Modal>

      {/* 历史记录抽屉 */}
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        type="lesson-cancel"
        onSelect={handleHistorySelect}
      />

      {/* 使用说明 */}
      <Modal
        open={helpOpen}
        title="消课表使用说明"
        onCancel={() => setHelpOpen(false)}
        footer={null}
        width={640}
      >
        <div style={{ lineHeight: 1.8, fontSize: 14 }}>
          <h3>1. 上传 Excel</h3>
          <ul style={{ paddingLeft: 20 }}>
            <li>支持 <code>.xlsx</code> / <code>.xls</code> 格式</li>
            <li>优先解析名为 <strong>"取值"</strong> 的 sheet，否则取第一个 sheet</li>
            <li>第 1 行为表头，必需列：<strong>日期、时段、次数、学员姓名、班型</strong></li>
            <li>可选列：科目、老师、年级、学生人数</li>
            <li>班型支持归一化：1V1/1v1/一对一 → 1v1；1V3/1v3/一对三 → 1v3，以此类推</li>
          </ul>

          <h3>2. 生成消课表</h3>
          <ul style={{ paddingLeft: 20 }}>
            <li>点击"生成消课表"按钮</li>
            <li>数据涉及多个月时，弹窗<strong>可多选</strong>月份（默认全选）</li>
            <li>生成后按月份分段展示，每个月一个矩阵</li>
            <li>矩阵行 = 学生 × 班型，列 = 1 号至当月最后一天，单元格 = 当日节数</li>
            <li>次数为 0.5 等小数会保留并橙色显示</li>
          </ul>

          <h3>3. 导出 Excel</h3>
          <ul style={{ paddingLeft: 20 }}>
            <li>每个月份区块有独立的"导出 Excel"按钮</li>
            <li>导出文件名格式：<code>消课表_YYYY年M月.xlsx</code></li>
          </ul>

          <h3>4. 保存到长期存储</h3>
          <ul style={{ paddingLeft: 20 }}>
            <li>点击"保存全部到长期存储"可一次性保存所有月份</li>
            <li>也可点击每个月份区块的"保存到长期存储"单独保存</li>
            <li>长期存储<strong>不过期</strong>，是"课时统计"页面的数据源</li>
            <li>同月份已存在时会弹覆盖确认（覆盖 / 取消）</li>
            <li>保存成功后按钮变"已保存"，重新生成矩阵后恢复可保存</li>
          </ul>

          <h3>5. 历史记录</h3>
          <ul style={{ paddingLeft: 20 }}>
            <li>点击"历史记录"打开抽屉，含两个 Tab：</li>
            <li><strong>上传历史</strong>：每次上传的文件记录，1 年后自动清理，可下载原始文件</li>
            <li><strong>长期消课单元</strong>：保存到长期存储的月度记录，不过期，按月份展示</li>
            <li>两个 Tab 独立勾选删除，互不影响</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
}
