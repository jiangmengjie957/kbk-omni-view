export type Grade =
  | '三年级' | '四年级' | '五年级'
  | '六年级' | '七年级' | '八年级'
  | '九年级'
  | '高一' | '高二' | '高三';

export type ClassType = '1v1' | '1v多';

export interface CalcInput {
  grade: Grade;
  classType: ClassType;
  studentCount?: number;
  monthlyCourseCount: number;
}

type GradeGroup = '3-5' | '6-8' | '初三' | '高一二' | '高三';

// ── 年级合法值集合（用于校验）────────────────────────────────
const VALID_GRADES = new Set<string>([
  '三年级', '四年级', '五年级',
  '六年级', '七年级', '八年级',
  '九年级',
  '高一', '高二', '高三',
]);

export function isValidGrade(grade: string): grade is Grade {
  return VALID_GRADES.has(grade);
}

// ── 年级映射 ─────────────────────────────────────────────────
function mapGrade(grade: Grade): GradeGroup {
  if (['三年级', '四年级', '五年级'].includes(grade)) return '3-5';
  if (['六年级', '七年级', '八年级'].includes(grade)) return '6-8';
  if (grade === '九年级') return '初三';
  if (['高一', '高二'].includes(grade)) return '高一二';
  return '高三';
}

// ── 价格配置（标准 2 小时单价）───────────────────────────────
const PRICE_1V1: Record<GradeGroup, number> = {
  '3-5': 160, '6-8': 160, '初三': 180, '高一二': 180, '高三': 220,
};

// 1v多：按实际学生人数（1/2/3人）分别定价；4人+ 在3人基础上每人 +45
const PRICE_1VN: Record<GradeGroup, { 1: number; 2: number; 3: number }> = {
  '3-5':   { 1: 80,  2: 160, 3: 200 },
  '6-8':   { 1: 100, 2: 160, 3: 200 },
  '初三':  { 1: 120, 2: 180, 3: 220 },
  '高一二': { 1: 120, 2: 180, 3: 220 },
  '高三':  { 1: 140, 2: 220, 3: 240 },
};

// ── 1v多计算 ─────────────────────────────────────────────────
function calcMultiFee(gradeGroup: GradeGroup, studentCount: number): number {
  const p = PRICE_1VN[gradeGroup];
  if (studentCount <= 1) return p[1];
  if (studentCount === 2) return p[2];
  if (studentCount === 3) return p[3];
  // 4人及以上：在3人价格基础上每多1人 +45
  return p[3] + (studentCount - 3) * 45;
}

// ── 阶梯系数 ─────────────────────────────────────────────────
export function getMultiplier(count: number): number {
  if (count <= 50) return 1;
  if (count <= 60) return 1.05;
  if (count <= 80) return 1.1;
  if (count <= 100) return 1.15;
  return 1.2;
}

// ── 班型 → ClassType（不再从班型取人数）─────────────────────
export function getClassType(banXing: string): ClassType | null {
  const s = banXing.toUpperCase().replace(/\s/g, '');
  if (s === '1V1') return '1v1';
  if (/^1V\d+$/.test(s)) return '1v多';
  return null;
}

/** @deprecated 仍保留供校验阶段使用，人数请改用 parseStudentCount */
export function parseBanXing(
  banXing: string,
): { classType: ClassType; studentCount: number } | null {
  const ct = getClassType(banXing);
  if (!ct) return null;
  const m = /^1V(\d+)$/i.exec(banXing.replace(/\s/g, ''));
  const studentCount = m ? parseInt(m[1], 10) : 1;
  return { classType: ct, studentCount };
}

// ── 解析时间段 → 实际小时数 ──────────────────────────────────
/**
 * 支持格式：
 *   "10：00-12：00"（全角冒号）
 *   "10:00-12:00"  （半角冒号）
 *   "10:00—12:00"  （破折号）
 *   以及两端含空格的变体
 *
 * 返回实际小时数（精确到分钟），跨午夜自动加 24h。
 */
export function parseDurationHours(timeStr: string): number {
  // 统一全角冒号 → 半角，去空格
  const s = timeStr.replace(/[：]/g, ':').replace(/\s/g, '');

  // 分隔符：- 或 —（破折号），分出开始/结束
  const parts = s.split(/[-—]/);
  if (parts.length !== 2) throw new Error(`无法解析时间段：${timeStr}`);

  const toMinutes = (t: string): number => {
    const [hStr, mStr] = t.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) throw new Error(`无法解析时间：${t}`);
    return h * 60 + m;
  };

  let start = toMinutes(parts[0]);
  let end = toMinutes(parts[1]);

  // 跨午夜（结束时间 ≤ 开始时间）
  if (end <= start) end += 24 * 60;

  return (end - start) / 60;
}

// ── 解析姓名单元格 → 学生人数 ────────────────────────────────
/**
 * 支持分隔符：
 *   英文逗号 ,   中文逗号 ，
 *   英文分号 ;   中文分号 ；
 *   顿号 、      斜杠 /
 *   一个或多个空格
 */
export function parseStudentCount(nameCell: string): number {
  if (!nameCell?.trim()) return 1;
  const names = nameCell
    .split(/[,，;；、/\s]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  return names.length || 1;
}

// ── 主函数（价格为标准 2 小时单价，时长比例在外部应用）───────
export function calculateFee(input: CalcInput): number {
  const { grade, classType, studentCount = 1, monthlyCourseCount } = input;
  if (classType === '1v多' && studentCount == null) {
    throw new Error('studentCount required');
  }
  const gradeGroup = mapGrade(grade);
  const baseFee =
    classType === '1v1'
      ? PRICE_1V1[gradeGroup]
      : calcMultiFee(gradeGroup, studentCount);
  return baseFee * getMultiplier(monthlyCourseCount);
}

/** 仅返回基础单价（不含阶梯系数），用于明细展示 */
export function getBaseFee(
  grade: Grade,
  classType: ClassType,
  studentCount: number,
): number {
  const gradeGroup = mapGrade(grade);
  return classType === '1v1'
    ? PRICE_1V1[gradeGroup]
    : calcMultiFee(gradeGroup, studentCount);
}
