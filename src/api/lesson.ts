import { request } from './client';
import type { Lesson, LessonInput, LessonTransfer, TransferInput } from '../types/lesson';

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface CopyDayResult {
  sourceDate: string;
  targetDate: string;
  mode: 'copy' | 'move';
  total: number;
  success: number;
  skipped: number;
  results: { lessonId: number; timeRange: string; ok: boolean; message: string }[];
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

  remove: (id: number, reason?: string) =>
    request<ApiResponse<{ pending: boolean }>>(`/lesson/${id}`, {
      method: 'DELETE',
      ...(reason ? { body: JSON.stringify({ reason }) } : {}),
    }).then((r) => r.data),

  // 更新单个学生上课状态
  updateStudentStatus: (lessonId: number, studentId: number, status: number) =>
    request<ApiResponse<unknown>>(`/lesson/${lessonId}/student-status`, {
      method: 'PUT',
      body: JSON.stringify({ studentId, status }),
    }).then(() => undefined),

  // 批量导入排课
  batch: (items: LessonInput[]) =>
    request<ApiResponse<{ success: number; failed: number; results: { line: number; ok: boolean; message: string }[] }>>(
      '/lesson/batch',
      { method: 'POST', body: JSON.stringify({ items }) }
    ).then((r) => r.data),

  // 按天批量复制/转移课程
  copyDay: (data: { sourceDate: string; targetDate: string; mode: 'copy' | 'move' }) =>
    request<ApiResponse<CopyDayResult>>('/lesson/copy-day', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => r.data),
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
