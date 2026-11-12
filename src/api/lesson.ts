import { request } from './client';
import type { Lesson, LessonInput, LessonTransfer, TransferInput } from '../types/lesson';

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export const lessonApi = {
  // 查询（可选日期范围）
  list: (params?: { startDate?: string; endDate?: string }) => {
    const qs = params
      ? `?${new URLSearchParams({
          ...(params.startDate ? { startDate: params.startDate } : {}),
          ...(params.endDate ? { endDate: params.endDate } : {}),
        }).toString()}`
      : '';
    return request<ApiResponse<Lesson[]>>(`/lesson${qs}`).then((r) => r.data);
  },

  detail: (id: number) =>
    request<ApiResponse<Lesson>>(`/lesson/${id}`).then((r) => r.data),

  create: (data: LessonInput) =>
    request<ApiResponse<Lesson>>('/lesson', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => r.data),

  update: (id: number, data: LessonInput) =>
    request<ApiResponse<Lesson>>(`/lesson/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }).then((r) => r.data),

  remove: (id: number) =>
    request<ApiResponse<unknown>>(`/lesson/${id}`, { method: 'DELETE' }).then(
      () => undefined
    ),

  // 更新单个学生上课状态
  updateStudentStatus: (lessonId: number, studentId: number, status: number) =>
    request<ApiResponse<unknown>>(`/lesson/${lessonId}/student-status`, {
      method: 'PUT',
      body: JSON.stringify({ studentId, status }),
    }).then(() => undefined),
};

export const transferApi = {
  list: () => request<ApiResponse<LessonTransfer[]>>('/lesson/transfer/list').then((r) => r.data),

  apply: (data: TransferInput) =>
    request<ApiResponse<{ id: number }>>('/lesson/transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => r.data),

  approve: (id: number, action: 'approve' | 'reject') =>
    request<ApiResponse<unknown>>(`/lesson/transfer/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }).then(() => undefined),
};
