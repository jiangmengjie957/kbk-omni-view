import db, {
  type HistoryRecord,
  type HistoryType,
  type PerfStatsPayload,
  type LessonCancelPayload,
} from '../db';

// ── 写入历史记录 ─────────────────────────────────────────────
export async function addHistoryRecord(
  record: Omit<HistoryRecord, 'id'>,
): Promise<number> {
  const id = await db.historyRecords.add(record as HistoryRecord);
  return id as number;
}

// ── 单条查询 ─────────────────────────────────────────────────
export async function getHistoryRecord(
  id: number,
): Promise<HistoryRecord | undefined> {
  return db.historyRecords.get(id);
}

// ── 按类型查询列表（createdAt 降序，最近在前）──────────────
export async function listHistoryByType(
  type: HistoryType,
): Promise<HistoryRecord[]> {
  const records = await db.historyRecords
    .where('type')
    .equals(type)
    .toArray();
  // JS 层排序：createdAt 降序（最近在前），避免 Dexie reverse()+sortBy() 组合的行为歧义
  records.sort((a, b) => b.createdAt - a.createdAt);
  return records;
}

// ── 批量删除（单事务原子操作）──────────────────────────────
export async function deleteHistoryRecords(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await db.transaction('rw', db.historyRecords, async () => {
    await db.historyRecords.bulkDelete(ids);
  });
}

// ── 清空某类型全部 ───────────────────────────────────────────
export async function clearHistoryByType(type: HistoryType): Promise<void> {
  const ids = await db.historyRecords
    .where('type')
    .equals(type)
    .primaryKeys();
  if (ids.length === 0) return;
  await db.transaction('rw', db.historyRecords, async () => {
    await db.historyRecords.bulkDelete(ids as number[]);
  });
}

// ── 保留策略：删除超期记录 ──────────────────────────────────
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * 删除 createdAt 早于一年前的记录，返回删除条数。
 * 应用启动时调用。
 */
export async function cleanupExpiredHistory(
  maxAgeMs: number = ONE_YEAR_MS,
): Promise<number> {
  const cutoff = Date.now() - maxAgeMs;
  const ids = await db.historyRecords
    .where('createdAt')
    .below(cutoff)
    .primaryKeys();
  if (ids.length === 0) return 0;
  await db.transaction('rw', db.historyRecords, async () => {
    await db.historyRecords.bulkDelete(ids as number[]);
  });
  return ids.length;
}

// ── 更新记录（用于消课表生成矩阵后更新 payload）─────────────
export async function updateHistoryRecord(
  id: number,
  changes: Partial<HistoryRecord>,
): Promise<void> {
  await db.historyRecords.update(id, changes);
}

// ── 获取最近一条某类型记录（用于消课表回填矩阵）────────────
export async function getLatestHistoryByType(
  type: HistoryType,
): Promise<HistoryRecord | undefined> {
  const records = await db.historyRecords
    .where('type')
    .equals(type)
    .reverse()
    .sortBy('createdAt');
  return records[0];
}

// 类型守卫：payload 是 perf-stats 还是 lesson-cancel
export function isPerfStatsPayload(
  payload: PerfStatsPayload | LessonCancelPayload,
): payload is PerfStatsPayload {
  return (
    'tableData' in payload &&
    'feeSummary' in payload &&
    'validationErrors' in payload
  );
}

export function isLessonCancelPayload(
  payload: PerfStatsPayload | LessonCancelPayload,
): payload is LessonCancelPayload {
  return 'rawRows' in payload && 'validRows' in payload && 'matrix' in payload;
}

// 导出类型供页面使用
export type {
  HistoryRecord,
  HistoryType,
  PerfStatsPayload,
  LessonCancelPayload,
};
