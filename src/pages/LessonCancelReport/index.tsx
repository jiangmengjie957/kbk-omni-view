import { useState, useMemo } from 'react';
import { Typography, Button, Upload, Table, Modal, Radio, Alert, List, Tag, message, Tooltip } from 'antd';
import type { UploadProps, TableColumnsType } from 'antd';
import { DownloadOutlined, InboxOutlined, TableOutlined, HistoryOutlined } from '@ant-design/icons';
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
import type { HistoryRecord, LessonCancelPayload } from '../../db';
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
  const [rawRows, setRawRows] = useState<PreviewRow[]>([]);
  const [previewColumns, setPreviewColumns] = useState<TableColumnsType<PreviewRow>>([]);
  const [validRows, setValidRows] = useState<ValidRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<ValidationError[]>([]);
  const [parsed, setParsed] = useState(false);
  const [targetMonth, setTargetMonth] = useState<YearMonth | null>(null);
  const [matrix, setMatrix] = useState<CancelMatrix | null>(null);
  const [monthModalOpen, setMonthModalOpen] = useState(false);
  const [monthOptions, setMonthOptions] = useState<MonthOption[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [historyOpen, setHistoryOpen] = useState(false);

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
        setMatrix(null);
        setTargetMonth(null);
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
      generateForMonth(months[0]);
      return;
    }
    // 多月：弹窗
    const opts: MonthOption[] = months.map(m => ({ ...m, label: fmtMonth(m) }));
    setMonthOptions(opts);
    // 默认选最近月（已升序，最后一个是最近）
    setSelectedMonth(fmtMonthShort(opts[opts.length - 1]));
    setMonthModalOpen(true);
  }

  function generateForMonth(m: YearMonth) {
    const mat = buildCancelMatrix(validRows, m.year, m.month);
    setTargetMonth(m);
    setMatrix(mat);
    void messageApi.success(
      `已生成 ${fmtMonth(m)} 消课表，共 ${mat.rows.length} 位学生`,
    );
    // 更新最近一条 lesson-cancel 历史记录的 payload.matrix 与 targetMonth
    void (async () => {
      try {
        const latest = await getLatestHistoryByType('lesson-cancel');
        if (!latest || !latest.id) return;
        if (!isLessonCancelPayload(latest.payload)) return;
        const updatedPayload: LessonCancelPayload = {
          ...latest.payload,
          matrix: mat,
          targetMonth: m,
        };
        await updateHistoryRecord(latest.id, {
          payload: updatedPayload,
          targetMonth: m,
        });
      } catch (err) {
        console.warn('[history] 更新矩阵失败:', err);
      }
    })();
  }

  function handleMonthConfirm() {
    const opt = monthOptions.find(o => fmtMonthShort(o) === selectedMonth);
    if (opt) {
      setMonthModalOpen(false);
      generateForMonth(opt);
    }
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
    setMatrix((p.matrix as CancelMatrix) ?? null);
    setTargetMonth((p.targetMonth as YearMonth) ?? null);
    setParsed(true);
    void messageApi.success(`已回填历史记录：${record.fileName}`);
  }

  // ── 导出 Excel ──────────────────────────────────────────────
  function handleExport() {
    if (!matrix || !targetMonth) {
      void messageApi.warning('请先生成消课表');
      return;
    }
    exportCancelMatrix(matrix, targetMonth);
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

  // ── 矩阵列构造 ──────────────────────────────────────────────
  const matrixColumns: TableColumnsType<MatrixRow & { _seq: number }> = useMemo(() => {
    if (!matrix) return [];
    const days = matrix.daysInMonth;
    const cols: TableColumnsType<MatrixRow & { _seq: number }> = [
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
    return cols;
  }, [matrix]);

  const matrixDataSource = useMemo(() => {
    if (!matrix) return [];
    return matrix.rows.map((r, i) => ({ ...r, _seq: i + 1 }));
  }, [matrix]);

  return (
    <div className={styles.page}>
      {contextHolder}

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
          <Tooltip title={!matrix ? '请先生成消课表' : ''}>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExport}
              disabled={!matrix}
            >
              导出 Excel
            </Button>
          </Tooltip>
          <Button
            icon={<HistoryOutlined />}
            onClick={() => setHistoryOpen(true)}
          >
            历史记录
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

      {/* 消课矩阵 */}
      {matrix && targetMonth && (
        <div className={styles.matrixSection}>
          <div className={styles.matrixHeader}>
            <span className={styles.matrixTitle}>
              消课表 · {fmtMonth(targetMonth)}
            </span>
            <Text className={styles.rowCount}>共 {matrix.rows.length} 位学生</Text>
          </div>
          <Table
            className={styles.matrixTable}
            columns={matrixColumns}
            dataSource={matrixDataSource}
            rowKey="key"
            size="small"
            scroll={{ x: 'max-content' }}
            tableLayout="fixed"
            pagination={false}
          />
        </div>
      )}

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

      {/* 月份选择弹窗 */}
      <Modal
        open={monthModalOpen}
        title="选择生成消课表的月份"
        onCancel={() => setMonthModalOpen(false)}
        onOk={handleMonthConfirm}
        okText="生成"
        cancelText="取消"
      >
        <p style={{ marginBottom: 12, color: '#666' }}>
          导入数据涉及多个月，请选择要生成消课表的月份：
        </p>
        <Radio.Group
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {monthOptions.map(o => (
            <Radio key={fmtMonthShort(o)} value={fmtMonthShort(o)}>
              {o.label}
            </Radio>
          ))}
        </Radio.Group>
      </Modal>

      {/* 历史记录抽屉 */}
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        type="lesson-cancel"
        onSelect={handleHistorySelect}
      />
    </div>
  );
}
