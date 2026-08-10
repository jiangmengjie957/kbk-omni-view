import { useState } from 'react';
import { Typography, Button, Upload, Table, Modal, List, Tag, message } from 'antd';
import type { UploadProps, TableColumnsType, TableProps } from 'antd';
import { DownloadOutlined, InboxOutlined, WarningOutlined, QuestionCircleOutlined, HistoryOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import {
  isValidGrade,
  parseBanXing,
  getClassType,
  getBaseFee,
  parseDurationHours,
  parseStudentCount,
  getMultiplier,
  type Grade,
} from '../../utils/calcFee';
import { addHistoryRecord } from '../../utils/historyDb';
import type { HistoryRecord, PerfStatsPayload } from '../../db';
import HistoryDrawer from '../../components/HistoryDrawer';
import CalcRulesModal from './CalcRulesModal';
import styles from './PerfStats.module.scss';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const TEMPLATE_HEADERS = ['日期', '时间', '姓名', '科目', '老师', '班型', '年级'];
const TEMPLATE_TITLE = '课时统计';

const EXCEL_DATE_MIN = 1;
const EXCEL_DATE_MAX = 73050;
const TIME_PATTERN = /^\d{1,2}[：:]\d{2}\s*[-—]\s*\d{1,2}[：:]\d{2}$/;

type RawCell = string | number | null;
type RowData = Record<string, string> & { _rowKey: number };

interface ValidationError {
  row: number;
  field: string;
  value: string;
  reason: string;
}

interface SessionDetail {
  _key: string;
  date: string;
  time: string;
  studentName: string;
  subject: string;
  grade: string;
  banXing: string;
  studentCount: number;
  durationHours: number;
  baseFee: number;       // 标准 2h 基础单价
  timeRatio: number;     // 实际时长 / 2
  multiplier: number;    // 阶梯系数
  sessionFee: number;    // 本次实际课时费
}

interface TeacherSummary {
  _key: string;
  teacher: string;
  monthlyCourseCount: number;
  multiplier: number;
  totalFee: number;
  sessions: SessionDetail[];
}

// ── 校验辅助 ─────────────────────────────────────────────────

function isValidExcelDate(cell: RawCell): boolean {
  return (
    typeof cell === 'number' &&
    Number.isInteger(cell) &&
    cell >= EXCEL_DATE_MIN &&
    cell <= EXCEL_DATE_MAX
  );
}

function isValidTime(cell: RawCell): boolean {
  if (typeof cell !== 'string' || !cell.trim()) return false;
  if (!TIME_PATTERN.test(cell.trim())) return false;
  const [startStr, endStr] = cell.replace(/[：]/g, ':').replace(/\s/g, '').split(/[-—]/);
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  return toMin(startStr) !== toMin(endStr);
}

function excelSerialToDate(serial: number): string {
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

function fmt(n: number) {
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
}

// ── 费用汇总计算（含明细）────────────────────────────────────

function buildFeeSummary(rows: RowData[]): TeacherSummary[] {
  const map = new Map<string, RowData[]>();
  rows.forEach(row => {
    const t = row['老师'] || '（未知）';
    if (!map.has(t)) map.set(t, []);
    map.get(t)!.push(row);
  });

  const result: TeacherSummary[] = [];

  map.forEach((sessions, teacher) => {
    const monthlyCourseCount = sessions.length;
    const multiplier = getMultiplier(monthlyCourseCount);
    let totalFee = 0;
    const details: SessionDetail[] = [];

    sessions.forEach((row, i) => {
      const grade = row['年级'];
      const banXing = row['班型'];
      const nameCell = row['姓名'];
      const timeCell = row['时间'];

      if (!isValidGrade(grade)) return;
      const classType = getClassType(banXing);
      if (!classType) return;

      const studentCount = parseStudentCount(nameCell);

      let durationHours = 2;
      try { durationHours = parseDurationHours(timeCell); } catch { /* already validated */ }
      const timeRatio = durationHours / 2;

      const baseFee = getBaseFee(grade as Grade, classType, studentCount);
      const sessionFee = baseFee * multiplier * timeRatio;
      totalFee += sessionFee;

      details.push({
        _key: `${teacher}-${i}`,
        date: row['日期'] ?? '',
        time: timeCell ?? '',
        studentName: nameCell ?? '',
        subject: row['科目'] ?? '',
        grade,
        banXing,
        studentCount,
        durationHours,
        timeRatio,
        baseFee,
        multiplier,
        sessionFee,
      });
    });

    result.push({ _key: teacher, teacher, monthlyCourseCount, multiplier, totalFee, sessions: details });
  });

  return result.sort((a, b) => b.totalFee - a.totalFee);
}

// ── 组件 ─────────────────────────────────────────────────────

export default function PerfStats() {
  const [messageApi, contextHolder] = message.useMessage();
  const [tableData, setTableData] = useState<RowData[]>([]);
  const [columns, setColumns] = useState<TableColumnsType<RowData>>([]);
  const [feeSummary, setFeeSummary] = useState<TeacherSummary[]>([]);
  const [parsed, setParsed] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // ── 模版下载 ────────────────────────────────────────────────
  function handleDownloadTemplate() {
    // ═══ Sheet 1: 课时统计（数据表） ═══
    const dataSheet: (string | number)[][] = [
      // 第0行：标题（7列，后6列为空以保持对齐）
      [TEMPLATE_TITLE, '', '', '', '', '', ''],
      // 第1行：表头
      TEMPLATE_HEADERS,
      // 第2-6行：示例数据
      [45907, '10:00-12:00', '张三', '数学', '王老师', '1V1', '三年级'],
      [45907, '14:00-16:00', '李四,王五', '英语', '王老师', '1V2', '六年级'],
      [45908, '8:00-10:00', '赵六 孙七 周八', '物理', '李老师', '1V3', '九年级'],
      [45908, '15:00-18:00', '吴九/郑十/冯十一/刘十二', '化学', '李老师', '1V4', '高三'],
      [45909, '18:00-19:30', '陈A', '数学', '张老师', '1V1', '高二'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(dataSheet);

    // 合并标题行（A1:G1）
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];

    // 列宽设置
    ws['!cols'] = [
      { wch: 12 },  // 日期
      { wch: 16 },  // 时间
      { wch: 28 },  // 姓名
      { wch: 10 },  // 科目
      { wch: 10 },  // 老师
      { wch: 8 },   // 班型
      { wch: 10 },  // 年级
    ];

    // 设置日期列格式（第2-6行，A列，对应数组索引2-6）
    for (let i = 2; i <= 6; i++) {
      const cellRef = `A${i + 1}`; // Excel 行号从1开始，数组索引从0开始，所以 +1
      if (ws[cellRef]) {
        ws[cellRef].t = 'n'; // 数字类型
        ws[cellRef].z = 'm/d';  // 日期格式
      }
    }

    // ═══ Sheet 2: 填写说明 ═══
    const rulesSheet: string[][] = [
      ['📋 课时费统计表 - 填写规则说明'],
      [],
      ['一、列说明'],
      ['列名', '说明', '示例'],
      ['日期', '使用 Excel 日期格式，系统会自动识别', '2024/9/7 或 9月7日'],
      ['时间', '格式：HH:MM-HH:MM，支持全角/半角冒号', '10:00-12:00 或 10：00-12：00'],
      ['姓名', '多个学生用逗号、空格、分号等分隔', '张三,李四 或 张三 李四'],
      ['科目', '课程科目名称', '数学、英语、物理'],
      ['老师', '授课老师姓名', '王老师'],
      ['班型', '格式：1V数字（不区分大小写）', '1V1、1V3、1v5'],
      ['年级', '支持的年级范围见下方', '三年级、六年级、九年级、高一、高三'],
      [],
      ['二、支持的年级'],
      ['• 三年级、四年级、五年级'],
      ['• 六年级、七年级、八年级'],
      ['• 九年级'],
      ['• 高一、高二、高三'],
      [],
      ['三、重要提示'],
      ['• 第一个 sheet（课时统计）中的示例数据可直接删除，填入真实数据后上传'],
      ['• 时长不足或超过 2 小时会自动按比例计算课时费'],
      ['• 学生人数从姓名列自动识别，无需手动填写'],
      ['• 上传前请确保日期列格式为"日期"类型（右键 → 设置单元格格式 → 日期）'],
      [],
      ['四、常见问题'],
      ['Q: 日期显示为数字（如 45907）怎么办？'],
      ['A: 选中日期列 → 右键 → 设置单元格格式 → 选择"日期"类型'],
      [],
      ['Q: 时间段可以跨午夜吗？'],
      ['A: 可以，如 22:00-01:00 会自动识别为 3 小时'],
      [],
      ['Q: 班型人数和姓名列人数不一致会怎样？'],
      ['A: 系统以姓名列实际人数为准，班型仅用于判断是 1v1 还是 1v多'],
    ];

    const wsRules = XLSX.utils.aoa_to_sheet(rulesSheet);
    wsRules['!cols'] = [{ wch: 50 }, { wch: 40 }, { wch: 30 }];

    // ═══ 创建工作簿并添加两个 sheet ═══
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '课时统计');
    XLSX.utils.book_append_sheet(wb, wsRules, '填写说明');
    XLSX.writeFile(wb, '课时费统计模版.xlsx');
  }

  // ── Excel 解析 + 校验 ────────────────────────────────────────
  function parseFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result as ArrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json<RawCell[]>(firstSheet, { header: 1, defval: null });

        if (rawRows.length < 3) {
          void messageApi.warning('文件内容为空或格式不符，请使用模版填写后上传');
          return;
        }

        const headers = (rawRows[1] as (string | null)[]).filter(Boolean) as string[];
        const dataRows = rawRows
          .slice(2)
          .filter(row => (row as RawCell[]).some(c => c !== null && c !== ''));

        if (dataRows.length === 0) {
          void messageApi.warning('数据区域为空，请填写数据后上传');
          return;
        }

        const idx = (field: string) => headers.indexOf(field);
        const errors: ValidationError[] = [];

        dataRows.forEach((rawRow, i) => {
          const row = rawRow as RawCell[];
          const rowNum = i + 1;

          const dateCell = idx('日期') !== -1 ? row[idx('日期')] : undefined;
          if (!dateCell && dateCell !== 0) {
            errors.push({ row: rowNum, field: '日期', value: '', reason: '日期不能为空' });
          } else if (!isValidExcelDate(dateCell ?? null)) {
            errors.push({ row: rowNum, field: '日期', value: String(dateCell), reason: '无法识别为有效日期，请确认单元格格式为"日期"类型' });
          }

          const timeCell = idx('时间') !== -1 ? row[idx('时间')] : undefined;
          if (!timeCell) {
            errors.push({ row: rowNum, field: '时间', value: '', reason: '时间不能为空' });
          } else if (!isValidTime(timeCell ?? null)) {
            errors.push({ row: rowNum, field: '时间', value: String(timeCell), reason: '格式应为 HH:MM-HH:MM（如 10:00-12:00），且开始与结束时间不能相同' });
          }

          const gradeCell = idx('年级') !== -1 ? row[idx('年级')] : undefined;
          if (!gradeCell) {
            errors.push({ row: rowNum, field: '年级', value: '', reason: '年级不能为空' });
          } else if (!isValidGrade(String(gradeCell))) {
            errors.push({ row: rowNum, field: '年级', value: String(gradeCell), reason: '不是支持的年级，可选：三~五年级、六~八年级、九年级、高一~高三' });
          }

          const banXingCell = idx('班型') !== -1 ? row[idx('班型')] : undefined;
          if (!banXingCell) {
            errors.push({ row: rowNum, field: '班型', value: '', reason: '班型不能为空' });
          } else if (parseBanXing(String(banXingCell)) === null) {
            errors.push({ row: rowNum, field: '班型', value: String(banXingCell), reason: '格式应为 1V1、1V2、1V3 等（不区分大小写）' });
          }
        });

        if (errors.length > 0) {
          setValidationErrors(errors);
          setErrorModalOpen(true);
          setParsed(false);
          setTableData([]);
          setColumns([]);
          setFeeSummary([]);
          return;
        }

        const cols: TableColumnsType<RowData> = headers.map((header) => ({
          title: header,
          dataIndex: header,
          key: header,
          ellipsis: true,
          width: header === '日期' || header === '时间' ? 140 : 100,
        }));

        const rows: RowData[] = dataRows.map((rawRow, i) => {
          const row = rawRow as RawCell[];
          const obj: RowData = { _rowKey: i };
          headers.forEach((header, colIdx) => {
            const cell = row[colIdx];
            obj[header] =
              header === '日期' && typeof cell === 'number'
                ? excelSerialToDate(cell)
                : cell != null ? String(cell) : '';
          });
          return obj;
        });

        setColumns(cols);
        setTableData(rows);
        const summary = buildFeeSummary(rows);
        setFeeSummary(summary);
        setParsed(true);
        void messageApi.success(`解析成功，共 ${rows.length} 条记录`);

        // 写入历史记录（复制 ArrayBuffer，避免被 XLSX 消费后引用失效）
        try {
          const fileBuffer = (e.target?.result as ArrayBuffer).slice(0);
          const payload: PerfStatsPayload = {
            tableData: rows,
            feeSummary: summary,
            validationErrors: errors,
          };
          void addHistoryRecord({
            createdAt: Date.now(),
            type: 'perf-stats',
            fileName: file.name,
            fileSize: file.size,
            fileBinary: fileBuffer,
            validCount: rows.length,
            invalidCount: errors.length,
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
      if (!isExcel) { void messageApi.error('仅支持 .xlsx / .xls 格式'); return Upload.LIST_IGNORE; }
      parseFile(file);
      return false;
    },
  };

  // ── 汇总列 ──────────────────────────────────────────────────
  const feeColumns: TableColumnsType<TeacherSummary> = [
    { title: '老师', dataIndex: 'teacher', key: 'teacher', width: 90 },
    { title: '月课次', dataIndex: 'monthlyCourseCount', key: 'monthlyCourseCount', width: 75, align: 'center' },
    { title: '阶梯系数', dataIndex: 'multiplier', key: 'multiplier', width: 85, align: 'center', render: (v: number) => `×${v}` },
    {
      title: '月课时费（元）', dataIndex: 'totalFee', key: 'totalFee', width: 130, align: 'right',
      render: (v: number) => <span className={styles.feeAmount}>{fmt(v)}</span>,
    },
  ];

  // ── 明细列 ──────────────────────────────────────────────────
  const detailColumns: TableColumnsType<SessionDetail> = [
    { title: '日期', dataIndex: 'date', key: 'date', width: 80 },
    { title: '时间', dataIndex: 'time', key: 'time', width: 130 },
    { title: '姓名', dataIndex: 'studentName', key: 'studentName', width: 100, ellipsis: true },
    { title: '科目', dataIndex: 'subject', key: 'subject', width: 70 },
    { title: '年级', dataIndex: 'grade', key: 'grade', width: 70 },
    { title: '班型', dataIndex: 'banXing', key: 'banXing', width: 70 },
    { title: '人数', dataIndex: 'studentCount', key: 'studentCount', width: 55, align: 'center' },
    {
      title: '时长(h)', dataIndex: 'durationHours', key: 'durationHours', width: 70, align: 'center',
      render: (v: number) => v.toFixed(1),
    },
    {
      title: '基础单价', dataIndex: 'baseFee', key: 'baseFee', width: 85, align: 'right',
      render: (v: number) => <span className={styles.detailBase}>{fmt(v)}</span>,
    },
    {
      title: '时长比例', dataIndex: 'timeRatio', key: 'timeRatio', width: 80, align: 'center',
      render: (v: number) => {
        const pct = Math.round(v * 100);
        return <Tag color={pct < 100 ? 'orange' : 'blue'}>{pct}%</Tag>;
      },
    },
    {
      title: '阶梯系数', dataIndex: 'multiplier', key: 'multiplier', width: 80, align: 'center',
      render: (v: number) => `×${v}`,
    },
    {
      title: '本次课时费', dataIndex: 'sessionFee', key: 'sessionFee', width: 100, align: 'right',
      render: (v: number) => <span className={styles.feeAmount}>{fmt(v)}</span>,
    },
  ];

  // ── 展开行渲染 ───────────────────────────────────────────────
  const expandedRowRender: TableProps<TeacherSummary>['expandedRowRender'] = (record) => (
    <div className={styles.detailWrapper}>
      <Table
        columns={detailColumns}
        dataSource={record.sessions}
        rowKey="_key"
        size="small"
        scroll={{ x: 'max-content' }}
        pagination={false}
        className={styles.detailTable}
        summary={(data) => {
          const total = data.reduce((s, r) => s + r.sessionFee, 0);
          return (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={8}><strong>小计</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={1} colSpan={3} />
              <Table.Summary.Cell index={2} align="right">
                <span className={styles.feeAmount}><strong>{fmt(total)}</strong></span>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          );
        }}
      />
    </div>
  );

  // ── 历史记录回填 ─────────────────────────────────────────────
  function handleHistorySelect(record: HistoryRecord) {
    try {
      const payload = record.payload as PerfStatsPayload;
      if (payload?.tableData) {
        setTableData(payload.tableData as RowData[]);
      }
      if (payload?.feeSummary) {
        setFeeSummary(payload.feeSummary as TeacherSummary[]);
      }
      if (payload?.validationErrors) {
        setValidationErrors(payload.validationErrors as ValidationError[]);
        setErrorModalOpen(payload.validationErrors.length > 0);
      }
      if (payload?.tableData) {
        // 重建列
        const cols: TableColumnsType<RowData> = Object.keys(payload.tableData[0] || {})
          .filter(k => k !== '_rowKey')
          .map((header) => ({
            title: header,
            dataIndex: header,
            key: header,
            ellipsis: true,
            width: header === '日期' || header === '时间' ? 140 : 100,
          }));
        setColumns(cols);
      }
      setParsed(true);
      void messageApi.success('已从历史记录恢复');
    } catch (err) {
      console.error('[history] 回填失败:', err);
      void messageApi.error('历史记录回填失败');
    }
  }

  return (
    <div className={styles.page}>
      {contextHolder}

      <CalcRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />

      {/* 校验错误弹窗 */}
      <Modal
        open={errorModalOpen}
        title={
          <span className={styles.errorModalTitle}>
            <WarningOutlined className={styles.errorModalIcon} />
            数据校验失败，共 {validationErrors.length} 处错误
          </span>
        }
        onOk={() => setErrorModalOpen(false)}
        onCancel={() => setErrorModalOpen(false)}
        okText="知道了"
        cancelButtonProps={{ style: { display: 'none' } }}
        width={580}
      >
        <p className={styles.errorModalDesc}>请修正以下问题后重新上传。行号从第 1 条数据起计。</p>
        <List
          size="small"
          dataSource={validationErrors}
          className={styles.errorList}
          renderItem={(err) => (
            <List.Item className={styles.errorItem}>
              <Tag color="error">第 {err.row} 行</Tag>
              <Tag color="warning">{err.field}</Tag>
              <span className={styles.errorReason}>{err.reason}</span>
              {err.value && <Text type="secondary" className={styles.errorValue}>（原始值：{err.value}）</Text>}
            </List.Item>
          )}
        />
      </Modal>

      {/* 页头 */}
      <div className={styles.pageHeader}>
        <Title level={4} className={styles.title}>绩效统计</Title>
        <div className={styles.toolbar}>
          <Button
            icon={<QuestionCircleOutlined />}
            onClick={() => setRulesOpen(true)}
          >
            计算规则
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>下载模版</Button>
          <Button icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>历史记录</Button>
        </div>
      </div>

      {/* 上传区 */}
      <div className={styles.uploadSection}>
        <div className={styles.uploadSectionTitle}>上传课时数据</div>
        <Dragger {...uploadProps} className={styles.dragger}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或将 Excel 文件拖拽到此区域上传</p>
          <p className={styles.uploadHint}>支持 .xlsx / .xls 格式，需包含标题行 + 表头行，仅解析第一个工作表</p>
        </Dragger>
      </div>

      {parsed && (
        <>
          {/* 课时费汇总 */}
          <div className={styles.feeSection}>
            <div className={styles.feeSectionHeader}>
              <span className={styles.feeSectionTitle}>课时费汇总</span>
              <Text className={styles.rowCount}>共 {feeSummary.length} 位老师 · 点击行可展开明细</Text>
            </div>
            <Table
              columns={feeColumns}
              dataSource={feeSummary}
              rowKey="_key"
              size="middle"
              scroll={{ x: 'max-content' }}
              pagination={false}
              expandable={{ expandedRowRender, rowExpandable: () => true }}
              summary={(data) => {
                const total = data.reduce((s, r) => s + r.totalFee, 0);
                return (
                  <Table.Summary.Row className={styles.feeSummaryRow}>
                    <Table.Summary.Cell index={0} colSpan={3}><strong>合计</strong></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <span className={styles.feeTotalAmount}>{fmt(total)}</span>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                );
              }}
            />
          </div>

          {/* 原始数据预览 */}
          <div className={styles.previewSection}>
            <div className={styles.previewHeader}>
              <span className={styles.previewTitle}>原始数据预览</span>
              <Text className={styles.rowCount}>共 {tableData.length} 条记录</Text>
            </div>
            <Table
              className={styles.table}
              columns={columns}
              dataSource={tableData}
              rowKey="_rowKey"
              size="middle"
              scroll={{ x: 'max-content' }}
              pagination={{ pageSize: 20, showSizeChanger: true, showQuickJumper: true }}
            />
          </div>
        </>
      )}

      {/* 历史记录抽屉 */}
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        type="perf-stats"
        onSelect={handleHistorySelect}
      />
    </div>
  );
}
