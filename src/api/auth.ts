import { request } from './client';
import type { AuthState, AuthUser } from '../config/auth';

interface LoginParams {
  username: string;
  password: string;
}

interface ChangePasswordParams {
  oldPassword: string;
  newPassword: string;
}

export interface MeData {
  user: AuthUser;
  roles: string[];
  isSuper: boolean;
  dataScope: number;
  mustChangePassword: boolean;
}

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export function login(params: LoginParams): Promise<ApiResponse<AuthState>> {
  return request<ApiResponse<AuthState>>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function fetchMe(): Promise<ApiResponse<MeData>> {
  return request<ApiResponse<MeData>>('/auth/me', { method: 'GET' });
}

export function logout(): Promise<ApiResponse<Record<string, never>>> {
  return request<ApiResponse<Record<string, never>>>('/auth/logout', {
    method: 'POST',
  });
}

export function changePassword(
  params: ChangePasswordParams
): Promise<ApiResponse<Record<string, never>>> {
  return request<ApiResponse<Record<string, never>>>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
