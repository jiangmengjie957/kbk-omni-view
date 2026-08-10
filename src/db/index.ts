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

// ── Dexie 子类化以获得 TypeScript 表类型 ──────────────────────
class KbkDB extends Dexie {
  historyRecords!: Table<HistoryRecord, number>;

  constructor() {
    super('kbkDB');
    // 版本 1：空库（保留向后兼容）
    this.version(1).stores({});
    // 版本 2：新增 historyRecords 表
    // 索引：++id 自增主键、createdAt 写入时间、type 记录类型、targetMonth 目标月份、fileName 文件名
    this.version(2).stores({
      historyRecords: '++id, createdAt, type, targetMonth, fileName',
    });
  }
}

const db = new KbkDB();

export default db;
