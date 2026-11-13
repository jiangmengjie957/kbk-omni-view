import { request } from './client';

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// 员工账号信息（按 employeeId 映射）
export type EmployeeAccountMap = Record<string, { username: string; status: number }>;

export const employeeAccountApi = {
  // 批量查询员工账号状态
  accounts: () =>
    request<ApiResponse<EmployeeAccountMap>>('/employee-account/accounts').then((r) => r.data),

  // 为员工创建账号，返回初始账号/密码
  create: (employeeId: number) =>
    request<ApiResponse<{ username: string; password: string }>>(
      `/employee-account/${employeeId}/account`,
      { method: 'POST' }
    ).then((r) => r.data),

  // 启用/禁用账号：status 1 启用 2 禁用
  updateStatus: (employeeId: number, status: number) =>
    request<ApiResponse<unknown>>(`/employee-account/${employeeId}/account-status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }).then(() => undefined),

  // 重置密码，返回新初始密码
  resetPassword: (employeeId: number) =>
    request<ApiResponse<{ username: string; password: string }>>(
      `/employee-account/${employeeId}/reset-password`,
      { method: 'POST' }
    ).then((r) => r.data),
};
