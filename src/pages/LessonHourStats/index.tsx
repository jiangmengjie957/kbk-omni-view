import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Typography,
  Button,
  Upload,
  Table,
  Modal,
  Radio,
  Alert,
  Select,
  Input,
  Progress,
  Tag,
  Empty,
  message,
  Tooltip,
} from 'antd';
import type { UploadProps, TableColumnsType } from 'antd';
import {
  InboxOutlined,
  ReloadOutlined,
  UploadOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import {
  listAllMonthlyRecords,
  listAllStudentQuotas,
  importStudentQuotas,
} from '../../utils/persistentLessonDb';
import {
  buildDayMatrix,
  buildMonthMatrix,
  getDaysInMonth,
  computeStudentConsumed,
  matchQuota,
  extractAvailableYears,
  computeUnmatched,
  type DayMatrixRow,
  type MonthMatrixRow,
} from '../../utils/lessonHourStats';
import type { LessonMonthlyRecord, StudentQuota } from '../../db';
import styles from './LessonHourStats.module.scss';

const { Title, Text } = Typography;
const { Dragger } = Upload;

// 配额 Excel 表头别名（大小写不敏感、trim 后匹配）
const NAME_ALIASES = ['学生姓名', '姓名', '学生'];
const QUOTA_ALIASES = ['总课时', '课时', '总课'];

interface ImportRow {
  studentName: string;
  totalQuota: number;
  note?: string;
  _error?: string; // 解析失败原因
}

export default function LessonHourStats() {
  const [messageApi, contextHolder] = message.useMessage();
  const [quotas, setQuotas] = useState<StudentQuota[]>([]);
  const [units, setUnits] = useState<LessonMonthlyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [aggregation, setAggregation] = useState<'month' | 'day'>('month');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]); // 按天模式多月选择，默认最近三个月
  const [studentFilter, setStudentFilter] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportRow[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);

  // ── 初始加载 ──────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allUnits, allQuotas] = await Promise.all([
        listAllMonthlyRecords(),
        listAllStudentQuotas(),
      ]);
      setUnits(allUnits);
      setQuotas(allQuotas);
      // 默认选最近年份
      const years = extractAvailableYears(allUnits);
      if (years.length > 0) {
        setSelectedYear(years[years.length - 1]);
      } else {
        setSelectedYear('all');
      }
    } catch (err) {
      console.error('[stats] 加载失败:', err);
      void messageApi.error('数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── 年份选项 ──────────────────────────────────────────────
  const yearOptions = useMemo(() => {
    const years = extractAvailableYears(units);
    return [
      { value: 'all', label: '全部' },
      ...years.map(y => ({ value: y, label: `${y} 年` })),
    ];
  }, [units]);

  // ── 配额 Map（按 studentName 查）─────────────────────────
  const quotaMap = useMemo(() => {
    const m = new Map<string, StudentQuota>();
    quotas.forEach(q => m.set(q.studentName, q));
    return m;
  }, [quotas]);

  // ── 有效年份（'all' 时取最近可用年份，矩阵模式需要具体年份）──
  const effectiveYear = useMemo(() => {
    if (selectedYear !== 'all') return selectedYear;
    const years = extractAvailableYears(units);
    return years.length > 0 ? years[years.length - 1] : new Date().getFullYear();
  }, [selectedYear, units]);

  // ── 可用月份（该年份有数据的月份）──────────────────────────
  const availableMonths = useMemo(() => {
    const yearStr = String(effectiveYear);
    const set = new Set<number>();
    units
      .filter(u => u.yearMonth.startsWith(yearStr))
      .forEach(u => {
        const m = parseInt(u.yearMonth.slice(5, 7), 10);
        if (Number.isFinite(m) && m >= 1 && m <= 12) set.add(m);
      });
    return [...set].sort((a, b) => a - b);
  }, [units, effectiveYear]);

  // ── 月份选项（1-12 全部，标注哪些有数据）────────────────────
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: `${i + 1} 月${availableMonths.includes(i + 1) ? '' : '（无数据）'}`,
      disabled: !availableMonths.includes(i + 1),
    })),
    [availableMonths],
  );

  // ── 默认选最近三个月（availableMonths 变化时重置）──────────
  useEffect(() => {
    if (availableMonths.length === 0) {
      setSelectedMonths([]);
      return;
    }
    // 取最近三个月（不足则全部）
    const recent = availableMonths.slice(-3);
    // 检查当前 selectedMonths 是否还在 availableMonths 里
    const stillValid = selectedMonths.filter(m => availableMonths.includes(m));
    if (stillValid.length === 0 || stillValid.length !== selectedMonths.length) {
      setSelectedMonths(recent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableMonths]);

  // ── 按天模式累计消耗（所有选中月份，按学生聚合）────────────
  const cumulativeConsumedMap = useMemo(() => {
    const map = new Map<string, number>();
    selectedMonths.forEach(month => {
      const dm = buildDayMatrix(units, effectiveYear, month);
      dm.forEach(row => {
        map.set(row.studentName, (map.get(row.studentName) ?? 0) + row.monthTotal);
      });
    });
    return map;
  }, [units, effectiveYear, selectedMonths]);

  // ── 已消耗课时 Map（按有效年份聚合，用于告警面板）──────────
  const consumedMap = useMemo(() => {
    return computeStudentConsumed(units, effectiveYear);
  }, [units, effectiveYear]);

  // ── 未匹配告警 ────────────────────────────────────────────
  const unmatched = useMemo(() => {
    return computeUnmatched(consumedMap, quotas);
  }, [consumedMap, quotas]);

  // ── 按月矩阵（按月模式用）────────────────────────────────
  const monthMatrix = useMemo(() => {
    if (aggregation !== 'month') return [];
    return buildMonthMatrix(units, effectiveYear);
  }, [aggregation, units, effectiveYear]);

  // ── 统一行数据结构 ──────────────────────────────────────────
  interface MatrixStatsRow {
    _key: string;
    studentName: string;
    banXing: string;
    cellMap: Record<number, number>;
    total: number;
    quota: number | null;
    remaining: number | null;
    status: 'normal' | 'exhausted' | 'over' | 'no-quota';
  }

  // ── 按月模式：行数据 + 列（全年 1..12 月）──────────────────
  const monthStatsRows = useMemo<MatrixStatsRow[]>(() => {
    const source = monthMatrix.map(r => {
      const quota = quotaMap.get(r.studentName);
      const result = matchQuota(r.yearTotal, quota);
      return {
        _key: `${r.studentName}|${r.banXing}`,
        studentName: r.studentName,
        banXing: r.banXing,
        cellMap: r.monthTotals,
        total: r.yearTotal,
        quota: result.quota,
        remaining: result.remaining,
        status: result.status,
      };
    });
    return studentFilter.trim()
      ? source.filter(r => r.studentName.includes(studentFilter.trim()))
      : source;
  }, [monthMatrix, quotaMap, studentFilter]);

  // ── 共享：构建矩阵列（固定左 + 动态明细 + 固定右）──────────
  function buildColumns(
    cellCount: number,
    mode: 'day' | 'month',
  ): TableColumnsType<MatrixStatsRow> {
    const cols: TableColumnsType<MatrixStatsRow> = [
      { title: '学生姓名', dataIndex: 'studentName', key: 'studentName', width: 100, fixed: 'left' },
      { title: '班型', dataIndex: 'banXing', key: 'banXing', width: 70, fixed: 'left' },
    ];

    for (let i = 1; i <= cellCount; i++) {
      cols.push({
        title: mode === 'day' ? String(i) : `${i}月`,
        dataIndex: `cell_${i}`,
        key: `cell_${i}`,
        width: mode === 'day' ? 48 : 70,
        align: 'center',
        render: (_: unknown, record: MatrixStatsRow) => {
          const v = record.cellMap[i];
          if (v == null) return '';
          return (
            <span className={Number.isInteger(v) ? '' : styles.fraction}>
              {formatNumber(v)}
            </span>
          );
        },
      });
    }

    cols.push(
      {
        title: mode === 'day' ? '当月汇总' : '全年汇总',
        dataIndex: 'total',
        key: 'total',
        width: 90,
        fixed: 'right',
        align: 'right',
        render: (v: number) => <strong>{formatNumber(v)}</strong>,
      },
      {
        title: '总配额',
        dataIndex: 'quota',
        key: 'quota',
        width: 90,
        fixed: 'right',
        align: 'right',
        render: (v: number | null) =>
          v == null ? <span className={styles.dashText}>—</span> : formatNumber(v),
      },
      {
        title: '剩余',
        dataIndex: 'remaining',
        key: 'remaining',
        width: 90,
        fixed: 'right',
        align: 'right',
        render: (v: number | null) => {
          if (v == null) return <span className={styles.dashText}>—</span>;
          const color = v < 0 ? '#ff4d4f' : v === 0 ? '#fa8c16' : '#52c41a';
          return <span style={{ color, fontWeight: 600 }}>{formatNumber(v)}</span>;
        },
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 90,
        fixed: 'right',
        render: (status: MatrixStatsRow['status']) => {
          const map: Record<MatrixStatsRow['status'], { color: string; text: string }> = {
            normal: { color: 'success', text: '正常' },
            exhausted: { color: 'warning', text: '已用完' },
            over: { color: 'error', text: '超支' },
            'no-quota': { color: 'default', text: '未设配额' },
          };
          const cfg = map[status];
          return <Tag color={cfg.color}>{cfg.text}</Tag>;
        },
      },
    );
    return cols;
  }

  const monthColumns = useMemo<TableColumnsType<MatrixStatsRow>>(
    () => buildColumns(12, 'month'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── 按天模式：构建某月的列（1..N 天）──────────────────────
  function buildDayColumns(days: number): TableColumnsType<MatrixStatsRow> {
    return buildColumns(days, 'day');
  }

  // ── 按天模式：构建某月的行数据（剩余基于所有选中月份累计）──
  function buildDayRows(month: number): MatrixStatsRow[] {
    const dm = buildDayMatrix(units, effectiveYear, month);
    let source = dm.map(r => {
      const consumed = cumulativeConsumedMap.get(r.studentName) ?? 0;
      const quota = quotaMap.get(r.studentName);
      const result = matchQuota(consumed, quota);
      return {
        _key: `${month}|${r.studentName}|${r.banXing}`,
        studentName: r.studentName,
        banXing: r.banXing,
        cellMap: r.dayMap,
        total: r.monthTotal,
        quota: result.quota,
        remaining: result.remaining,
        status: result.status,
      };
    });
    if (studentFilter.trim()) {
      source = source.filter(r => r.studentName.includes(studentFilter.trim()));
    }
    return source;
  }

  // ── 导入配额 ──────────────────────────────────────────────
  const importUploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.xlsx,.xls',
    showUploadList: false,
    beforeUpload(file) {
      const isExcel =
        file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (!isExcel) {
        void messageApi.error('仅支持 .xlsx / .xls 格式');
        return Upload.LIST_IGNORE;
      }
      parseQuotaFile(file);
      return false;
    },
  };

  function parseQuotaFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result as ArrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rowsArr = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          defval: null,
        });

        if (rowsArr.length < 2) {
          void messageApi.warning('文件内容为空或格式不符');
          return;
        }

        const headerRow = (rowsArr[0] as (string | null)[]).map(h =>
          h == null ? '' : String(h).trim(),
        );

        // 匹配姓名列与课时列
        const nameIdx = headerRow.findIndex(h =>
          NAME_ALIASES.some(a => h.toLowerCase() === a.toLowerCase()),
        );
        const quotaIdx = headerRow.findIndex(h =>
          QUOTA_ALIASES.some(a => h.toLowerCase() === a.toLowerCase()),
        );

        if (nameIdx === -1 || quotaIdx === -1) {
          const missing: string[] = [];
          if (nameIdx === -1) missing.push('学生姓名（或姓名/学生）');
          if (quotaIdx === -1) missing.push('总课时（或课时/总课）');
          void messageApi.error(`缺少必需列：${missing.join('、')}`);
          return;
        }

        const dataRows = rowsArr.slice(1).filter(r =>
          (r as unknown[]).some(c => c !== null && c !== ''),
        ) as unknown[][];

        const preview: ImportRow[] = dataRows.map((row) => {
          const nameCell = row[nameIdx];
          const quotaCell = row[quotaIdx];
          const name = nameCell == null ? '' : String(nameCell).trim();
          const quotaNum =
            typeof quotaCell === 'number'
              ? quotaCell
              : parseFloat(String(quotaCell ?? '').trim());

          if (!name) {
            return { studentName: '', totalQuota: 0, _error: '姓名为空' };
          }
          if (!Number.isFinite(quotaNum) || quotaNum < 0) {
            return { studentName: name, totalQuota: 0, _error: '总课时非数字或为空' };
          }
          return { studentName: name, totalQuota: quotaNum };
        });

        setImportPreview(preview);
        const validCount = preview.filter(p => !p._error).length;
        const errCount = preview.length - validCount;
        if (errCount > 0) {
          void messageApi.warning(`解析完成：${validCount} 条有效，${errCount} 条异常已跳过`);
        } else {
          void messageApi.success(`解析成功，共 ${validCount} 条配额`);
        }
      } catch {
        void messageApi.error('文件解析失败，请检查文件格式');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleConfirmImport() {
    const validRows = importPreview.filter(p => !p._error);
    if (validRows.length === 0) {
      void messageApi.warning('没有可导入的有效配额');
      return;
    }

    // 检查已存在的同名配额
    const existingNames = new Set(quotas.map(q => q.studentName));
    const overlapCount = validRows.filter(r => existingNames.has(r.studentName)).length;

    const doImport = async () => {
      try {
        const now = Date.now();
        const quotasToImport: StudentQuota[] = validRows.map(r => ({
          studentName: r.studentName,
          totalQuota: r.totalQuota,
          importedAt: now,
        }));
        const result = await importStudentQuotas(quotasToImport);
        void messageApi.success(
          `导入完成：新增 ${result.inserted} 条，更新 ${result.updated} 条`,
        );
        setImportModalOpen(false);
        setImportPreview([]);
        await loadData();
      } catch (err) {
        console.error('[stats] 导入失败:', err);
        void messageApi.error(
          `导入失败：${err instanceof Error ? err.message : String(err)}`,
        );
      }
    };

    if (overlapCount > 0) {
      Modal.confirm({
        title: '覆盖确认',
        content: `将覆盖 ${overlapCount} 条已有配额，是否继续？`,
        okText: '确认覆盖',
        cancelText: '取消',
        onOk: doImport,
      });
    } else {
      await doImport();
    }
  }

  // ── 数字格式化 ─────────────────────────────────────────────
  function formatNumber(v: number): string {
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(2).replace(/\.?0+$/, '') || '0';
  }

  // ── 行样式（超支/已用完高亮）────────────────────────────────
  function rowClassName(record: MatrixStatsRow): string {
    if (record.status === 'over') return 'row-over';
    if (record.status === 'exhausted') return 'row-exhausted';
    return '';
  }

  return (
    <div className={styles.page}>
      {contextHolder}

      {/* 页头 */}
      <div className={styles.pageHeader}>
        <Title level={4} className={styles.title}>课时统计</Title>
        <div className={styles.toolbar}>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => setImportModalOpen(true)}
          >
            导入学生总课时
          </Button>
          <Tooltip title="重新从本地存储读取数据">
            <Button
              icon={<ReloadOutlined />}
              onClick={loadData}
              loading={loading}
            >
              刷新统计
            </Button>
          </Tooltip>
          <Button
            type="text"
            icon={<QuestionCircleOutlined />}
            onClick={() => setHelpOpen(true)}
          >
            使用说明
          </Button>
          <span className={styles.toolbarDivider} />
          <Radio.Group
            value={aggregation}
            onChange={(e) => setAggregation(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="month">按月</Radio.Button>
            <Radio.Button value="day">按天</Radio.Button>
          </Radio.Group>
        </div>
      </div>

      {/* 筛选区 */}
      <div className={styles.filterSection}>
        <div className={styles.filterItem}>
          <span className={styles.filterLabel}>年份：</span>
          <Select
            value={selectedYear}
            onChange={(v) => setSelectedYear(v)}
            options={yearOptions}
            style={{ width: 120 }}
          />
        </div>
        {aggregation === 'day' && (
          <div className={styles.filterItem}>
            <span className={styles.filterLabel}>月份范围：</span>
            <Select
              mode="multiple"
              value={selectedMonths}
              onChange={(v) => setSelectedMonths(v as number[])}
              options={monthOptions}
              placeholder="选择月份（默认最近三月）"
              style={{ minWidth: 220, maxWidth: 360 }}
              maxTagCount={3}
            />
          </div>
        )}
        <div className={styles.filterItem}>
          <span className={styles.filterLabel}>学生姓名：</span>
          <Input.Search
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
            placeholder="模糊匹配"
            allowClear
            style={{ width: 200 }}
          />
        </div>
      </div>

      {/* 未匹配告警 */}
      {unmatched.noQuotaStudents.length > 0 && (
        <Alert
          type="warning"
          showIcon
          className={styles.alertBox}
          message={`以下 ${unmatched.noQuotaStudents.length} 位学生未设置总课时配额`}
          description={
            <div className={styles.unmatchedList}>
              {unmatched.noQuotaStudents.join('、')}
            </div>
          }
        />
      )}
      {unmatched.noConsumptionStudents.length > 0 && (
        <Alert
          type="info"
          showIcon
          className={styles.alertBox}
          message={`以下 ${unmatched.noConsumptionStudents.length} 位学生本范围无消课记录`}
          description={
            <div className={styles.unmatchedList}>
              {unmatched.noConsumptionStudents.join('、')}
            </div>
          }
        />
      )}

      {/* 统计表格 or 空状态 */}
      {quotas.length === 0 && units.length === 0 ? (
        <div className={styles.emptySection}>
          <Empty
            description="暂无数据，请先导入学生总课时配额，并在消课表页面保存月度记录"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      ) : quotas.length === 0 ? (
        <div className={styles.emptySection}>
          <Empty
            description="已检测到消课记录，但尚未导入学生总课时配额，请先导入配额以查看剩余课时"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setImportModalOpen(true)}
            >
              导入学生总课时
            </Button>
          </Empty>
        </div>
      ) : aggregation === 'day' ? (
        // 按天模式：map 多个月份，每个月一个矩阵区块
        selectedMonths.length === 0 ? (
          <div className={styles.emptySection}>
            <Empty description="请选择至少一个月份" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ) : (
          [...selectedMonths].sort((a, b) => a - b).map(month => {
            const days = getDaysInMonth(effectiveYear, month);
            const rows = buildDayRows(month);
            return (
              <div className={styles.statsSection} key={month}>
                <div className={styles.statsHeader}>
                  <span className={styles.statsTitle}>
                    {effectiveYear} 年 {month} 月（按天明细）
                  </span>
                  <Text className={styles.rowCount}>共 {rows.length} 行</Text>
                </div>
                <Table
                  className={styles.statsTable}
                  columns={buildDayColumns(days)}
                  dataSource={rows}
                  rowKey="_key"
                  size="small"
                  scroll={{ x: 'max-content' }}
                  tableLayout="fixed"
                  pagination={{ pageSize: 50, showSizeChanger: true, showQuickJumper: true }}
                  rowClassName={rowClassName}
                />
              </div>
            );
          })
        )
      ) : (
        // 按月模式：单矩阵
        <div className={styles.statsSection}>
          <div className={styles.statsHeader}>
            <span className={styles.statsTitle}>
              课时统计 · {effectiveYear} 年（按月明细）
            </span>
            <Text className={styles.rowCount}>共 {monthStatsRows.length} 行</Text>
          </div>
          <Table
            className={styles.statsTable}
            columns={monthColumns}
            dataSource={monthStatsRows}
            rowKey="_key"
            size="small"
            scroll={{ x: 'max-content' }}
            tableLayout="fixed"
            pagination={{ pageSize: 50, showSizeChanger: true, showQuickJumper: true }}
            rowClassName={rowClassName}
          />
        </div>
      )}

      {/* 导入配额弹窗 */}
      <Modal
        open={importModalOpen}
        title="导入学生总课时配额"
        onCancel={() => {
          setImportModalOpen(false);
          setImportPreview([]);
        }}
        onOk={handleConfirmImport}
        okText="确认导入"
        cancelText="取消"
        okButtonProps={{ disabled: importPreview.filter(p => !p._error).length === 0 }}
        width={640}
      >
        <Dragger {...importUploadProps}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或拖拽 Excel 文件到此上传</p>
          <p className={styles.importHint}>
            支持 .xlsx / .xls；表头需含"学生姓名"（或姓名/学生）与"总课时"（或课时/总课）两列
          </p>
        </Dragger>

        {importPreview.length > 0 && (
          <div className={styles.importPreview}>
            <Table
              size="small"
              pagination={false}
              rowKey={(r, i) => `${r.studentName}-${i}`}
              dataSource={importPreview.slice(0, 50)}
              columns={[
                {
                  title: '学生姓名',
                  dataIndex: 'studentName',
                  key: 'studentName',
                  render: (v: string, r: ImportRow) =>
                    r._error ? <span style={{ color: '#ff4d4f' }}>{v || '(空)'}</span> : v,
                },
                {
                  title: '总课时',
                  dataIndex: 'totalQuota',
                  key: 'totalQuota',
                  render: (v: number, r: ImportRow) =>
                    r._error ? <span style={{ color: '#ff4d4f' }}>—</span> : v,
                },
                {
                  title: '状态',
                  dataIndex: '_error',
                  key: '_error',
                  render: (err?: string) =>
                    err ? <Tag color="error">{err}</Tag> : <Tag color="success">有效</Tag>,
                },
              ]}
            />
            {importPreview.length > 50 && (
              <p className={styles.importHint}>仅显示前 50 条预览，共 {importPreview.length} 条</p>
            )}
          </div>
        )}
      </Modal>

      {/* 使用说明 */}
      <Modal
        open={helpOpen}
        title="课时统计使用说明"
        onCancel={() => setHelpOpen(false)}
        footer={null}
        width={640}
      >
        <div style={{ lineHeight: 1.8, fontSize: 14 }}>
          <h3>1. 导入学生总课时</h3>
          <ul style={{ paddingLeft: 20 }}>
            <li>点击"导入学生总课时"，上传 Excel（<code>.xlsx</code> / <code>.xls</code>）</li>
            <li>表头需含 <strong>学生姓名</strong>（或 姓名/学生）与 <strong>总课时</strong>（或 课时/总课）两列</li>
            <li>导入时如遇已存在学生，会提示覆盖数量，确认后覆盖旧配额</li>
            <li>配额存储<strong>不过期</strong>，重复导入同名学生会覆盖</li>
          </ul>

          <h3>2. 数据来源</h3>
          <ul style={{ paddingLeft: 20 }}>
            <li>消课数据来自<strong>消课表页面</strong>的"保存到长期存储"——在消课表生成矩阵后保存</li>
            <li>点击"刷新统计"可重新从本地存储读取最新数据</li>
          </ul>

          <h3>3. 按月 / 按天切换</h3>
          <ul style={{ paddingLeft: 20 }}>
            <li><strong>按月</strong>：每年一个矩阵，1-12 月为列，单元格 = 该月节数</li>
            <li><strong>按天</strong>：选择月份范围（<strong>默认最近三个月</strong>，可多选），每个月份一个矩阵，1-N 日为列</li>
            <li>按天模式下可多选月份，会分段展示每个月的每日明细</li>
            <li>小数节数（如 0.5）橙色显示</li>
          </ul>

          <h3>4. 筛选</h3>
          <ul style={{ paddingLeft: 20 }}>
            <li><strong>年份</strong>：默认选有数据的最近年份，可选"全部"</li>
            <li><strong>月份范围</strong>（仅按天）：默认最近三个月，无数据的月份标灰不可选</li>
            <li><strong>学生姓名</strong>：模糊匹配，实时过滤</li>
          </ul>

          <h3>5. 剩余课时与状态</h3>
          <ul style={{ paddingLeft: 20 }}>
            <li><strong>剩余</strong> = 总配额 − 所选范围累计消耗</li>
            <li>按天模式：剩余 = 配额 − 所有选中月份的累计消耗（各月份区块剩余值一致）</li>
            <li><strong>正常</strong>（绿）：剩余 {'>'} 0</li>
            <li><strong>已用完</strong>（黄）：剩余 = 0</li>
            <li><strong>超支</strong>（红）：剩余 {'<'} 0，整行红色高亮</li>
            <li><strong>未设配额</strong>（灰）：该学生有消课记录但未导入配额</li>
          </ul>

          <h3>6. 告警面板</h3>
          <ul style={{ paddingLeft: 20 }}>
            <li>黄色告警：有消课记录但未设置配额的学生</li>
            <li>蓝色告警：有配额但所选范围无消课记录的学生</li>
            <li>出现告警时请检查学生姓名是否与配额表一致</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
}
