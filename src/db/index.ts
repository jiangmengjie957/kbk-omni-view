import Dexie, { type Table } from 'dexie';

// ── 历史记录类型 ──────────────────────────────────────────────
export type HistoryType = 'perf-stats' | 'lesson-cancel';

export interface YearMonth {
  year: number;
  month: number;
}

// 绩效统计 payload
export interface PerfStatsPayload {
  tableData: unknown[];        // 原始预览行
  feeSummary: unknown[];       // 按老师聚合的费用汇总
  validationErrors: unknown[]; // 校验错误列表
}

// 消课表 payload
export interface LessonCancelPayload {
  rawRows: unknown[];          // 原始预览行
  validRows: unknown[];        // 校验通过的有效行
  invalidRows: unknown[];      // 校验失败的异常行
  matrix: unknown | null;      // 生成的消课矩阵（未生成时为 null）
  targetMonth: YearMonth | null; // 用户选定的目标月份
}

export interface HistoryRecord {
  id?: number;                  // 自增主键
  createdAt: number;            // 写入时间戳（Date.now()）
  type: HistoryType;            // 记录类型
  fileName: string;             // 原始文件名
  fileSize: number;              // 文件大小（字节）
  fileBinary: ArrayBuffer;      // 原始 Excel 文件二进制
  validCount: number;           // 有效行数
  invalidCount: number;         // 异常行数
  targetMonth: YearMonth | null; // 目标月份（消课表才有，perf-stats 为 null）
  payload: PerfStatsPayload | LessonCancelPayload; // 完整解析结果
}

// ── 持久化存储（不过期）──────────────────────────────────────
// 月度消课单元：一个月一条记录，内部 students 数组打包当月所有学生×班型明细
// 设计原则："一个月为一个单元"——历史记录里每月只显示一条，避免条目爆炸

// 单个学生在某月的消课明细（月度单元内的子条目）
export interface StudentMonthlyEntry {
  studentName: string;            // 学生姓名
  banXing: string;                // 归一化班型（1v1/1v2/1v3/1v4/1v6）
  dayMap: Record<number, number>; // 普通对象 { [day: 1..31]: count }，只含非零日
  total: number;                  // 该学生该班型当月节数总和
}

// 月度消课单元：一个月一条记录
export interface LessonMonthlyRecord {
  yearMonth: string;              // "YYYY-MM" 字符串（主键）
  students: StudentMonthlyEntry[]; // 当月所有学生×班型的明细
  total: number;                  // 当月所有学生节数总和（students[].total 之和）
  savedAt: number;                // 写入时间戳（Date.now()）
}

// 学生课时配额：以学生姓名为键，存储该学生的总课时配额
export interface StudentQuota {
  studentName: string;          // 学生姓名（主键）
  totalQuota: number;          // 总课时配额
  importedAt: number;          // 导入时间戳（Date.now()）
  note?: string;                // 可选备注
}

// ── Dexie 子类化以获得 TypeScript 表类型 ──────────────────────
class KbkDB extends Dexie {
  historyRecords!: Table<HistoryRecord, number>;
  monthlyRecords!: Table<LessonMonthlyRecord, string>;
  studentQuotas!: Table<StudentQuota, string>;

  constructor() {
    super('kbkDB');
    // 版本 1：空库（保留向后兼容）
    this.version(1).stores({});
    // 版本 2：新增 historyRecords 表（1 年自动清理策略）
    this.version(2).stores({
      historyRecords: '++id, createdAt, type, targetMonth, fileName',
    });
    // 版本 3：曾用复合键 [studentName+yearMonth+banXing]（粒度过细，已废弃）
    this.version(3).stores({
      historyRecords: '++id, createdAt, type, targetMonth, fileName',
      lessonMonthlyRecords: '[studentName+yearMonth+banXing], studentName, yearMonth',
      studentQuotas: 'studentName',
    });
    // 版本 4：改用新表名 monthlyRecords（keyPath=yearMonth，一个月一条记录）
    // 内部 students 数组打包当月所有学生×班型明细。
    // 注：Dexie 不支持改已有表的 keyPath，所以用新表名 monthlyRecords；
    //     v3 的 lessonMonthlyRecords 在 v4 stores 里没定义，会被 Dexie 自动删除（功能刚上线无生产数据）。
    //     historyRecords 与 studentQuotas 定义不变，已有数据保留。
    this.version(4).stores({
      historyRecords: '++id, createdAt, type, targetMonth, fileName',
      monthlyRecords: 'yearMonth',
      studentQuotas: 'studentName',
    });
  }
}

const db = new KbkDB();

export default db;
