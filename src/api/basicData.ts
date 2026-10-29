import { request } from './client';
import type { Campus, Employee, Student } from '../types/basicData';

// ─────────────────────────────────────────────────────────────
// 基础数据接口（已联调后端）
// GET/POST /api/v1/{resource}，PUT/DELETE /api/v1/{resource}/:id，
// POST /api/v1/{resource}/batch 批量导入
// ─────────────────────────────────────────────────────────────

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export type CampusInput = Omit<Campus, 'id' | 'createdAt'>;
export type EmployeeInput = Omit<Employee, 'id' | 'createdAt'>;
export type StudentInput = Omit<Student, 'id' | 'createdAt'>;

function list<T>(path: string): Promise<T[]> {
  return request<ApiResponse<T[]>>(path).then((r) => r.data);
}

function create<T>(path: string, data: unknown): Promise<T> {
  return request<ApiResponse<T>>(path, {
    method: 'POST',
    body: JSON.stringify(data),
  }).then((r) => r.data);
}

function update<T>(path: string, data: unknown): Promise<T> {
  return request<ApiResponse<T>>(path, {
    method: 'PUT',
    body: JSON.stringify(data),
  }).then((r) => r.data);
}

function remove(path: string): Promise<void> {
  return request<ApiResponse<unknown>>(path, { method: 'DELETE' }).then(() => undefined);
}

function batch(path: string, items: unknown[]): Promise<void> {
  return request<ApiResponse<{ count: number }>>(path, {
    method: 'POST',
    body: JSON.stringify(items),
  }).then(() => undefined);
}

// ── 校区 ─────────────────────────────────────────────────────

export const campusApi = {
  list: () => list<Campus>('/campus'),
  create: (data: CampusInput) => create<Campus>('/campus', data),
  update: (id: number, data: Partial<CampusInput>) => update<Campus>(`/campus/${id}`, data),
  remove: (id: number) => remove(`/campus/${id}`),
  batchCreate: (items: CampusInput[]) => batch('/campus/batch', items),
};

// ── 员工 ─────────────────────────────────────────────────────

export const employeeApi = {
  list: () => list<Employee>('/employee'),
  create: (data: EmployeeInput) => create<Employee>('/employee', data),
  update: (id: number, data: Partial<EmployeeInput>) => update<Employee>(`/employee/${id}`, data),
  remove: (id: number) => remove(`/employee/${id}`),
  batchCreate: (items: EmployeeInput[]) => batch('/employee/batch', items),
};

// ── 学员 ─────────────────────────────────────────────────────

export const studentApi = {
  list: () => list<Student>('/student'),
  create: (data: StudentInput) => create<Student>('/student', data),
  update: (id: number, data: Partial<StudentInput>) => update<Student>(`/student/${id}`, data),
  remove: (id: number) => remove(`/student/${id}`),
  batchCreate: (items: StudentInput[]) => batch('/student/batch', items),
};
