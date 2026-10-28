import type { Campus, Employee, Student } from '../types/basicData';

// ─────────────────────────────────────────────────────────────
// 基础数据 mock 层（localStorage 持久化）
// 后端接口就绪后，把下面每个方法体替换为 request('/api/v1/...') 即可，
// 页面无需改动。
// ─────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  campus: 'kbk_campus',
  employee: 'kbk_employee',
  student: 'kbk_student',
} as const;

function readList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, list: T[]): void {
  localStorage.setItem(key, JSON.stringify(list));
}

function nextId(list: { id: number }[]): number {
  return list.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

function now(): string {
  return new Date().toISOString();
}

async function listAll<T>(key: string): Promise<T[]> {
  return readList<T>(key);
}

async function createOne<T extends { id: number; createdAt: string }>(
  key: string,
  data: Omit<T, 'id' | 'createdAt'>
): Promise<T> {
  const list = readList<T>(key);
  const item = { ...data, id: nextId(list), createdAt: now() } as T;
  writeList(key, [...list, item]);
  return item;
}

async function updateOne<T extends { id: number }>(
  key: string,
  id: number,
  data: Partial<Omit<T, 'id'>>
): Promise<T> {
  const list = readList<T>(key);
  const index = list.findIndex((item) => item.id === id);
  if (index === -1) throw new Error('记录不存在');
  const updated = { ...list[index], ...data, id } as T;
  list[index] = updated;
  writeList(key, list);
  return updated;
}

async function deleteOne<T extends { id: number }>(key: string, id: number): Promise<void> {
  const list = readList<T>(key);
  writeList(key, list.filter((item) => item.id !== id));
}

async function batchCreate<T extends { id: number; createdAt: string }>(
  key: string,
  items: Omit<T, 'id' | 'createdAt'>[]
): Promise<T[]> {
  const list = readList<T>(key);
  let id = nextId(list);
  const created = items.map((data) => {
    const item = { ...data, id: id++, createdAt: now() } as T;
    list.push(item);
    return item;
  });
  writeList(key, list);
  return created;
}

// 首次使用预置一个默认校区
function ensureSeed(): void {
  const campus = readList<Campus>(STORAGE_KEYS.campus);
  if (campus.length === 0) {
    writeList<Campus>(STORAGE_KEYS.campus, [
      {
        id: 1,
        name: '宝杨路校区',
        address: '',
        phone: '',
        status: 1,
        remark: '',
        createdAt: now(),
      },
    ]);
  }
}
ensureSeed();

// ── 类型 ─────────────────────────────────────────────────────

export type CampusInput = Omit<Campus, 'id' | 'createdAt'>;
export type EmployeeInput = Omit<Employee, 'id' | 'createdAt'>;
export type StudentInput = Omit<Student, 'id' | 'createdAt'>;

// ── 校区 ─────────────────────────────────────────────────────

export const campusApi = {
  list: () => listAll<Campus>(STORAGE_KEYS.campus),
  create: (data: CampusInput) => createOne<Campus>(STORAGE_KEYS.campus, data),
  update: (id: number, data: Partial<CampusInput>) =>
    updateOne<Campus>(STORAGE_KEYS.campus, id, data),
  remove: (id: number) => deleteOne<Campus>(STORAGE_KEYS.campus, id),
  batchCreate: (items: CampusInput[]) =>
    batchCreate<Campus>(STORAGE_KEYS.campus, items),
};

// ── 员工 ─────────────────────────────────────────────────────

export const employeeApi = {
  list: () => listAll<Employee>(STORAGE_KEYS.employee),
  create: (data: EmployeeInput) => createOne<Employee>(STORAGE_KEYS.employee, data),
  update: (id: number, data: Partial<EmployeeInput>) =>
    updateOne<Employee>(STORAGE_KEYS.employee, id, data),
  remove: (id: number) => deleteOne<Employee>(STORAGE_KEYS.employee, id),
  batchCreate: (items: EmployeeInput[]) =>
    batchCreate<Employee>(STORAGE_KEYS.employee, items),
};

// ── 学员 ─────────────────────────────────────────────────────

export const studentApi = {
  list: () => listAll<Student>(STORAGE_KEYS.student),
  create: (data: StudentInput) => createOne<Student>(STORAGE_KEYS.student, data),
  update: (id: number, data: Partial<StudentInput>) =>
    updateOne<Student>(STORAGE_KEYS.student, id, data),
  remove: (id: number) => deleteOne<Student>(STORAGE_KEYS.student, id),
  batchCreate: (items: StudentInput[]) =>
    batchCreate<Student>(STORAGE_KEYS.student, items),
};
