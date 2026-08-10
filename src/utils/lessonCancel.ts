// 消课表工具函数：班型归一化、日期/时段解析、节数解析、行级校验、矩阵构建
// 复用 calcFee.ts 的 parseStudentCount 姓名拆分逻辑

export type RawCell = string | number | null;

// ── 班型归一化 ─────────────────────────────────────────────────
/**
 * 将班型列原始值归一化为标准形式：
 *   1V1/1v1/一对一 → 1v1
 *   1V3/1v3/一对三 → 1v3
 *   1V2/1v2/一对二 → 1v2
 *   1V4/1v4/一对四 → 1v4
 *   1V6/一对六     → 1v6
 * 无法归一化的（小班、初三误填等）返回 null
 */
const CHINESE_BANXING_MAP: Record<string, string> = {
  一对一: '1v1',
  一对二: '1v2',
  一对三: '1v3',
  一对四: '1v4',
  一对六: '1v6',
};

export function normalizeBanXing(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  // 先按 1V数字 格式匹配（不区分大小写）
  const m = /^1V(\d+)$/i.exec(t.replace(/\s/g, ''));
  if (m) return `1v${m[1]}`;
  // 再查中文映射
  if (CHINESE_BANXING_MAP[t]) return CHINESE_BANXING_MAP[t];
  return null;
}

// ── 日期解析 ───────────────────────────────────────────────────
export interface ParsedDate {
  year: number;
  month: number;
  day: number;
}

const EXCEL_DATE_MIN = 1;
const EXCEL_DATE_MAX = 73050;

/**
 * 解析日期单元格：
 *   number 在 [1, 73050] → Excel 1900 epoch 转 UTC 年月日
 *   string → 去杂质前缀后匹配 (\d{4})[./\-](\d{1,2})[./\-](\d{1,2})
 *   其他 → null
 */
export function parseDateCell(cell: RawCell): ParsedDate | null {
  if (cell == null) return null;
  if (typeof cell === 'number') {
    if (!Number.isFinite(cell) || cell < EXCEL_DATE_MIN || cell > EXCEL_DATE_MAX) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + cell * 86400 * 1000);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  }
  if (typeof cell === 'string') {
    const s = cell.trim().replace(/^[^\d]+/, ''); // 去前导非数字（如 ":2026/5/30" 的冒号）
    const m = /^(\d{4})[./\-](\d{1,2})[./\-](\d{1,2})$/.exec(s);
    if (m) {
      const y = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10);
      const d = parseInt(m[3], 10);
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return { year: y, month: mo, day: d };
    }
  }
  return null;
}

// ── 时段解析（兼容 ~ 分隔符）──────────────────────────────────
/**
 * 解析时段 → 实际小时数（精确到分钟，跨午夜自动 +24h）。
 * 兼容分隔符 - / — / ~，全角/半角冒号。
 * 解析失败返回 null。
 */
export function parseTimeRangeHours(timeStr: string): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  // 统一全角冒号 → 半角，去空格，把 ~ 替换为 - 以复用现有分隔符处理
  const s = timeStr.replace(/[：]/g, ':').replace(/\s/g, '').replace(/~/g, '-');
  const parts = s.split(/[-—]/);
  if (parts.length !== 2) return null;

  const toMinutes = (t: string): number | null => {
    const [hStr, mStr] = t.split(':');
    if (!hStr || !mStr) return null;
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  };

  const start = toMinutes(parts[0]);
  const end = toMinutes(parts[1]);
  if (start == null || end == null) return null;

  let e = end;
  if (e <= start) e += 24 * 60; // 跨午夜
  return (e - start) / 60;
}

// ── 节数取值（次数列优先，时段回退）─────────────────────────
export interface LessonCountResult {
  count: number;
  source: '次数列' | '时段推算';
}

/**
 * 解析消课节数：
 *   次数列为合法正数（1/0.5 等）→ 直接用
 *   否则用 parseTimeRangeHours(时段) / 2
 *   两者都失败返回 null
 */
export function resolveLessonCount(
  countCell: RawCell,
  timeStr: string,
): LessonCountResult | null {
  if (typeof countCell === 'number' && Number.isFinite(countCell) && countCell > 0) {
    return { count: countCell, source: '次数列' };
  }
  const hours = parseTimeRangeHours(timeStr);
  if (hours != null && hours > 0) {
    return { count: hours / 2, source: '时段推算' };
  }
  return null;
}

// ── 姓名拆分（复用 calcFee.parseStudentCount 的 split 正则）──
/**
 * 拆分姓名单元格，返回学生姓名数组。
 * 分隔符：英文/中文逗号、分号、顿号、斜杠、空格。
 * 空单元格返回空数组（与 parseStudentCount 返回 1 不同，消课表场景下空姓名应作为异常行）。
 */
export function splitStudentNames(nameCell: RawCell): string[] {
  if (nameCell == null) return [];
  const s = String(nameCell).trim();
  if (!s) return [];
  return s
    .split(/[,，;；、/\s]+/)
    .map(x => x.trim())
    .filter(x => x.length > 0);
}

// ── 行级校验 ─────────────────────────────────────────────────
export interface ValidationError {
  row: number;
  field: string;
  value: string;
  reason: string;
}

export interface ValidRow {
  rowKey: number;
  date: ParsedDate;
  time: string;
  studentNames: string[];
  banXing: string; // 归一化后
  count: number;
  countSource: '次数列' | '时段推算';
}

// 消课表必需列
export const REQUIRED_HEADERS = ['日期', '时段', '次数', '学员姓名', '班型'] as const;

/**
 * 校验数据行，返回有效行与异常行列表。
 * @param headers 表头数组
 * @param dataRows 数据行（数组形式，每行为 RawCell[]）
 * @returns { validRows, invalidRows }
 */
export function validateRows(
  headers: string[],
  dataRows: RawCell[][],
): { validRows: ValidRow[]; invalidRows: ValidationError[] } {
  const idx = (field: string) => headers.indexOf(field);
  const validRows: ValidRow[] = [];
  const invalidRows: ValidationError[] = [];

  dataRows.forEach((row, i) => {
    // i 从 0 起，第 0 条数据对应 Excel 第 2 行（第 1 行为表头），故行号 = i + 2
    const rowNum = i + 2;
    const errors: ValidationError[] = [];

    // 跳过完全空行
    if (row.every(c => c === null || c === '')) return;

    const dateCell = idx('日期') !== -1 ? row[idx('日期')] : undefined;
    const timeCell = idx('时段') !== -1 ? row[idx('时段')] : undefined;
    const countCell = idx('次数') !== -1 ? row[idx('次数')] : undefined;
    const nameCell = idx('学员姓名') !== -1 ? row[idx('学员姓名')] : undefined;
    const banXingCell = idx('班型') !== -1 ? row[idx('班型')] : undefined;

    // 日期校验
    let parsedDate: ParsedDate | null = null;
    if (dateCell === undefined || dateCell === null || dateCell === '') {
      errors.push({ row: rowNum, field: '日期', value: '', reason: '日期不能为空' });
    } else {
      parsedDate = parseDateCell(dateCell);
      if (!parsedDate) {
        errors.push({
          row: rowNum,
          field: '日期',
          value: String(dateCell),
          reason: '无法识别为有效日期',
        });
      }
    }

    // 班型校验
    let banXing: string | null = null;
    if (banXingCell === undefined || banXingCell === null || banXingCell === '') {
      errors.push({ row: rowNum, field: '班型', value: '', reason: '班型不能为空' });
    } else {
      banXing = normalizeBanXing(String(banXingCell));
      if (!banXing) {
        errors.push({
          row: rowNum,
          field: '班型',
          value: String(banXingCell),
          reason: `班型无法归一化：${String(banXingCell)}`,
        });
      }
    }

    // 姓名校验
    let studentNames: string[] = [];
    if (nameCell === undefined || nameCell === null || nameCell === '') {
      errors.push({ row: rowNum, field: '学员姓名', value: '', reason: '学员姓名不能为空' });
    } else {
      studentNames = splitStudentNames(nameCell);
      if (studentNames.length === 0) {
        errors.push({
          row: rowNum,
          field: '学员姓名',
          value: String(nameCell),
          reason: '学员姓名不能为空',
        });
      }
    }

    // 节数校验（次数列 + 时段任一可用即可）
    const countResult = resolveLessonCount(countCell ?? null, String(timeCell ?? ''));
    if (!countResult) {
      // 只有在时段或次数其中之一确实无法解析时才报错
      errors.push({
        row: rowNum,
        field: '次数',
        value: String(countCell ?? ''),
        reason: '次数与时段均无法解析',
      });
    }

    if (errors.length > 0 || !parsedDate || !banXing || studentNames.length === 0 || !countResult) {
      invalidRows.push(...errors.length > 0 ? errors : [{
        row: rowNum,
        field: '',
        value: '',
        reason: '该行存在校验错误',
      }]);
      return;
    }

    validRows.push({
      rowKey: rowNum,
      date: parsedDate,
      time: String(timeCell ?? ''),
      studentNames,
      banXing,
      count: countResult.count,
      countSource: countResult.source,
    });
  });

  return { validRows, invalidRows };
}

// ── 月份提取 ──────────────────────────────────────────────────
export interface YearMonth {
  year: number;
  month: number;
}

export function extractMonths(validRows: ValidRow[]): YearMonth[] {
  const set = new Map<string, YearMonth>();
  validRows.forEach(r => {
    const key = `${r.date.year}-${r.date.month}`;
    if (!set.has(key)) set.set(key, { year: r.date.year, month: r.date.month });
  });
  return [...set.values()].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
}

// ── 矩阵构建 ──────────────────────────────────────────────────
export interface MatrixRow {
  key: string;
  student: string;
  banXing: string;
  dayMap: Map<number, number>;
  total: number;
}

export interface CancelMatrix {
  rows: MatrixRow[];
  daysInMonth: number;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * 构建消课矩阵：
 *   行 = 学生 × 归一化班型
 *   列 = 1..daysInMonth
 *   单元格 = 该日该学生该班型的节数累加
 *
 * 1v多课拆到每个学生各计该行次数。
 */
export function buildCancelMatrix(
  validRows: ValidRow[],
  targetYear: number,
  targetMonth: number,
): CancelMatrix {
  const daysInMonth = getDaysInMonth(targetYear, targetMonth);
  const map = new Map<string, MatrixRow>();

  validRows.forEach(r => {
    if (r.date.year !== targetYear || r.date.month !== targetMonth) return;

    r.studentNames.forEach(name => {
      const key = `${name}\u0001${r.banXing}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          student: name,
          banXing: r.banXing,
          dayMap: new Map<number, number>(),
          total: 0,
        });
      }
      const row = map.get(key)!;
      const cur = row.dayMap.get(r.date.day) ?? 0;
      row.dayMap.set(r.date.day, cur + r.count);
      row.total += r.count;
    });
  });

  // 行排序：先按 student 升序，再按 banXing 升序
  const rows = [...map.values()].sort((a, b) => {
    if (a.student !== b.student) return a.student.localeCompare(b.student, 'zh');
    return a.banXing.localeCompare(b.banXing, 'zh');
  });

  return { rows, daysInMonth };
}

// ── 单元格格式化 ──────────────────────────────────────────────
export function formatLessonCount(v: number | undefined): string {
  if (v == null) return '';
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2).replace(/\.?0+$/, '') || '0';
}
