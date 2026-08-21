// 课时统计工具：聚合月度消课单元、按月/按天聚合、剩余课时计算
// 数据模型：一个月一条 LessonMonthlyRecord，内部 students 数组打包当月所有学生×班型明细

import type {
  LessonMonthlyRecord,
  StudentMonthlyEntry,
  StudentQuota,
} from '../db';

// ── 工具：把数字补零为 2 位字符串 ─────────────────────────────
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// ── 格式化年月为 "YYYY-MM" ───────────────────────────────────
export function formatYearMonth(year: number, month: number): string {
  return `${year}-${pad2(month)}`;
}

// ── 从 yearMonth 字段提取所有年份（去重升序）──────────────────
export function extractAvailableYears(units: LessonMonthlyRecord[]): number[] {
  const set = new Set<number>();
  units.forEach(u => {
    const y = parseInt(u.yearMonth.slice(0, 4), 10);
    if (Number.isFinite(y)) set.add(y);
  });
  return [...set].sort((a, b) => a - b);
}

// ── 展开月度单元为明细行（内部工具）──────────────────────────
// 把 LessonMonthlyRecord[] 展平为 (studentName, yearMonth, banXing, dayMap, total) 明细
// yearFilter 为 null 时不按年份过滤（全部年份）
function flattenEntries(
  units: LessonMonthlyRecord[],
  yearFilter?: number | null,
): Array<{ studentName: string; yearMonth: string; banXing: string; dayMap: Record<number, number>; total: number }> {
  const yearStr = yearFilter == null ? null : String(yearFilter);
  const out: Array<{ studentName: string; yearMonth: string; banXing: string; dayMap: Record<number, number>; total: number }> = [];
  units
    .filter(u => yearStr === null || u.yearMonth.startsWith(yearStr))
    .forEach(u => {
      u.students.forEach(s => {
        out.push({
          studentName: s.studentName,
          yearMonth: u.yearMonth,
          banXing: s.banXing,
          dayMap: s.dayMap,
          total: s.total,
        });
      });
    });
  return out;
}

// ── 按月聚合 ─────────────────────────────────────────────────
export interface MonthlyAggRow {
  studentName: string;
  yearMonth: string;
  banXing: string;
  total: number;
}

/**
 * 聚合月度明细行。year 为 'all' 时不按年份过滤（全部年份）。
 */
export function aggregateByMonth(
  units: LessonMonthlyRecord[],
  year: number | 'all',
): MonthlyAggRow[] {
  const yearFilter = year === 'all' ? null : year;
  return flattenEntries(units, yearFilter)
    .map(e => ({
      studentName: e.studentName,
      yearMonth: e.yearMonth,
      banXing: e.banXing,
      total: e.total,
    }))
    .sort((a, b) => {
      if (a.yearMonth !== b.yearMonth) return a.yearMonth.localeCompare(b.yearMonth);
      if (a.studentName !== b.studentName) return a.studentName.localeCompare(b.studentName, 'zh');
      return a.banXing.localeCompare(b.banXing, 'zh');
    });
}

// ── 按天聚合 ─────────────────────────────────────────────────
export interface DailyAggRow {
  studentName: string;
  date: string;      // "YYYY-MM-DD"
  banXing: string;
  count: number;
}

/**
 * 过滤指定年份的单元，把每个学生的 dayMap 展开为 { date: "YYYY-MM-DD", count } 行。
 */
export function aggregateByDay(
  units: LessonMonthlyRecord[],
  year: number,
): DailyAggRow[] {
  const rows: DailyAggRow[] = [];
  flattenEntries(units, year).forEach(e => {
    Object.entries(e.dayMap).forEach(([dayStr, count]) => {
      const day = parseInt(dayStr, 10);
      if (!Number.isFinite(day) || day < 1 || day > 31) return;
      rows.push({
        studentName: e.studentName,
        date: `${e.yearMonth}-${pad2(day)}`,
        banXing: e.banXing,
        count,
      });
    });
  });
  return rows.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.studentName !== b.studentName) return a.studentName.localeCompare(b.studentName, 'zh');
    return a.banXing.localeCompare(b.banXing, 'zh');
  });
}

// ── 按天矩阵（指定年月，每日节数作为列）──────────────────────
export interface DayMatrixRow {
  studentName: string;
  banXing: string;
  dayMap: Record<number, number>;  // {1: 1, 7: 0.5, ...} 当月每日节数
  monthTotal: number;               // 当月总节数
}

/**
 * 获取某年某月的天数。
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * 构建按天矩阵：行=学生×班型，列=1..daysInMonth，单元格=当日节数。
 * 只取指定年月的月度单元，合并其 students[] 的 dayMap。
 */
export function buildDayMatrix(
  units: LessonMonthlyRecord[],
  year: number,
  month: number,
): DayMatrixRow[] {
  const targetYearMonth = formatYearMonth(year, month);
  const map = new Map<string, DayMatrixRow>();

  units
    .filter(u => u.yearMonth === targetYearMonth)
    .forEach(u => {
      u.students.forEach(s => {
        const key = `${s.studentName}\u0001${s.banXing}`;
        if (!map.has(key)) {
          map.set(key, {
            studentName: s.studentName,
            banXing: s.banXing,
            dayMap: {},
            monthTotal: 0,
          });
        }
        const row = map.get(key)!;
        Object.entries(s.dayMap).forEach(([dayStr, count]) => {
          const day = parseInt(dayStr, 10);
          if (!Number.isFinite(day) || day < 1 || day > 31) return;
          row.dayMap[day] = (row.dayMap[day] ?? 0) + count;
          row.monthTotal += count;
        });
      });
    });

  return [...map.values()].sort((a, b) => {
    if (a.studentName !== b.studentName) return a.studentName.localeCompare(b.studentName, 'zh');
    return a.banXing.localeCompare(b.banXing, 'zh');
  });
}

// ── 按月矩阵（指定年份，每月节数作为列）──────────────────────
export interface MonthMatrixRow {
  studentName: string;
  banXing: string;
  monthTotals: Record<number, number>;  // {1: 5, 2: 3, ...} 每月节数
  yearTotal: number;                     // 全年总节数
}

/**
 * 构建按月矩阵：行=学生×班型，列=1..12，单元格=当月节数。
 * 取指定年份的所有月度单元，按月份累加 total。
 */
export function buildMonthMatrix(
  units: LessonMonthlyRecord[],
  year: number,
): MonthMatrixRow[] {
  const yearStr = String(year);
  const map = new Map<string, MonthMatrixRow>();

  units
    .filter(u => u.yearMonth.startsWith(yearStr))
    .forEach(u => {
      const month = parseInt(u.yearMonth.slice(5, 7), 10);
      if (!Number.isFinite(month) || month < 1 || month > 12) return;
      u.students.forEach(s => {
        const key = `${s.studentName}\u0001${s.banXing}`;
        if (!map.has(key)) {
          map.set(key, {
            studentName: s.studentName,
            banXing: s.banXing,
            monthTotals: {},
            yearTotal: 0,
          });
        }
        const row = map.get(key)!;
        row.monthTotals[month] = (row.monthTotals[month] ?? 0) + s.total;
        row.yearTotal += s.total;
      });
    });

  return [...map.values()].sort((a, b) => {
    if (a.studentName !== b.studentName) return a.studentName.localeCompare(b.studentName, 'zh');
    return a.banXing.localeCompare(b.banXing, 'zh');
  });
}

// ── 按学生汇总已消耗课时 ─────────────────────────────────────
/**
 * 按 studentName 聚合 total。
 * year 为数字时只统计该年份；'all' 时统计全部。
 * 遍历每条月度单元的 students 数组累加。
 */
export function computeStudentConsumed(
  units: LessonMonthlyRecord[],
  year: number | 'all',
): Map<string, number> {
  const yearStr = year === 'all' ? null : String(year);
  const map = new Map<string, number>();
  units
    .filter(u => yearStr === null || u.yearMonth.startsWith(yearStr))
    .forEach(u => {
      u.students.forEach(s => {
        const cur = map.get(s.studentName) ?? 0;
        map.set(s.studentName, cur + s.total);
      });
    });
  return map;
}

// ── 配额匹配与剩余课时计算 ───────────────────────────────────
export type QuotaStatus = 'normal' | 'exhausted' | 'over' | 'no-quota';

export interface QuotaMatchResult {
  consumed: number;
  quota: number | null;
  remaining: number | null;
  status: QuotaStatus;
}

/**
 * 计算剩余课时与状态。
 *   - quota 为空 → status='no-quota'，remaining=null
 *   - consumed >= quota → status='exhausted'（相等）或 'over'（超过）
 *   - consumed < quota → status='normal'
 */
export function matchQuota(
  consumed: number | undefined,
  quota: StudentQuota | undefined,
): QuotaMatchResult {
  const c = consumed ?? 0;
  if (!quota) {
    return { consumed: c, quota: null, remaining: null, status: 'no-quota' };
  }
  const remaining = quota.totalQuota - c;
  let status: QuotaStatus;
  if (remaining > 0) status = 'normal';
  else if (remaining === 0) status = 'exhausted';
  else status = 'over';
  return { consumed: c, quota: quota.totalQuota, remaining, status };
}

// ── 未匹配告警计算 ─────────────────────────────────────────
export interface UnmatchedReport {
  noQuotaStudents: string[];      // 月度单元中存在但配额表中无记录的学生
  noConsumptionStudents: string[]; // 配额表中存在但所选范围月度单元中无消耗的学生
}

/**
 * 计算未匹配的学生列表。
 */
export function computeUnmatched(
  consumedMap: Map<string, number>,
  quotas: StudentQuota[],
): UnmatchedReport {
  const quotaNames = new Set(quotas.map(q => q.studentName));
  const consumedNames = new Set(consumedMap.keys());

  const noQuotaStudents = [...consumedNames]
    .filter(n => !quotaNames.has(n))
    .sort((a, b) => a.localeCompare(b, 'zh'));
  const noConsumptionStudents = quotas
    .filter(q => !consumedNames.has(q.studentName))
    .map(q => q.studentName)
    .sort((a, b) => a.localeCompare(b, 'zh'));

  return { noQuotaStudents, noConsumptionStudents };
}

// 导出子条目类型供外部使用
export type { StudentMonthlyEntry };
