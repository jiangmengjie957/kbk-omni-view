import db, {
  type LessonMonthlyRecord,
  type StudentMonthlyEntry,
  type StudentQuota,
} from '../db';

// ── 月度消课单元 CRUD ───────────────────────────────────────
// 设计：一个月一条记录（keyPath=yearMonth），内部 students 数组打包当月所有学生×班型明细

/**
 * upsert 月度消课单元。
 * 同 yearMonth 的记录会被覆盖（一个月只有一条）。
 * 全部写入在单个事务内完成，保证原子性。
 */
export async function upsertMonthlyRecords(
  rows: LessonMonthlyRecord[],
): Promise<void> {
  if (rows.length === 0) return;
  await db.transaction('rw', db.monthlyRecords, async () => {
    for (const row of rows) {
      await db.monthlyRecords.put(row);
    }
  });
}

/**
 * upsert 单个月度单元（最常用：消课表保存某月矩阵）。
 * 同 yearMonth 已存在则覆盖。
 */
export async function upsertMonthlyRecord(
  row: LessonMonthlyRecord,
): Promise<void> {
  await db.monthlyRecords.put(row);
}

/**
 * 检测某年月是否已存在月度单元（用于覆盖确认）。
 */
export async function findExistingMonthlyUnit(
  yearMonth: string,
): Promise<LessonMonthlyRecord | undefined> {
  return db.monthlyRecords.get(yearMonth);
}

/**
 * 按年月查询单个月度单元。
 */
export async function getMonthlyRecordByYearMonth(
  yearMonth: string,
): Promise<LessonMonthlyRecord | undefined> {
  return db.monthlyRecords.get(yearMonth);
}

/**
 * 全表查询所有月度单元，用于课时统计页面一次性加载。
 * 按 yearMonth 升序返回。
 */
export async function listAllMonthlyRecords(): Promise<LessonMonthlyRecord[]> {
  const records = await db.monthlyRecords.toArray();
  return records.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
}

/**
 * 批量删除月度单元（按 yearMonth 主键）。
 */
export async function deleteMonthlyRecords(
  yearMonths: string[],
): Promise<void> {
  if (yearMonths.length === 0) return;
  await db.transaction('rw', db.monthlyRecords, async () => {
    await db.monthlyRecords.bulkDelete(yearMonths);
  });
}

/**
 * 清空所有月度消课单元（不过期表的全量清空，需用户确认）。
 */
export async function clearAllMonthlyRecords(): Promise<void> {
  await db.transaction('rw', db.monthlyRecords, async () => {
    await db.monthlyRecords.clear();
  });
}

// ── 学生课时配额 CRUD ───────────────────────────────────────

/**
 * 批量 upsert 学生课时配额。
 * 同名学生的配额会被覆盖。
 * 返回 { inserted, updated } 统计。
 */
export async function importStudentQuotas(
  quotas: StudentQuota[],
): Promise<{ inserted: number; updated: number }> {
  if (quotas.length === 0) return { inserted: 0, updated: 0 };
  let inserted = 0;
  let updated = 0;
  await db.transaction('rw', db.studentQuotas, async () => {
    for (const quota of quotas) {
      const existing = await db.studentQuotas.get(quota.studentName);
      if (existing) {
        updated++;
      } else {
        inserted++;
      }
      await db.studentQuotas.put(quota);
    }
  });
  return { inserted, updated };
}

/**
 * 全表查询所有学生配额，按学生姓名升序返回。
 */
export async function listAllStudentQuotas(): Promise<StudentQuota[]> {
  const quotas = await db.studentQuotas.toArray();
  return quotas.sort((a, b) => a.studentName.localeCompare(b.studentName, 'zh'));
}

// 导出类型供页面使用
export type { LessonMonthlyRecord, StudentMonthlyEntry, StudentQuota };
