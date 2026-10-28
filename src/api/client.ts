import { message } from 'antd';
import { API_BASE, AUTH_STORAGE_KEY, AuthState } from '../config/auth';

export class ApiError extends Error {
  status: number;
  code: number;

  constructor(status: number, code: number, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getAuthState(): AuthState | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

function setAuthState(state: AuthState): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
}

function clearAuthState(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function getAccessToken(): string {
  return getAuthState()?.accessToken ?? '';
}

function getRefreshToken(): string {
  return getAuthState()?.refreshToken ?? '';
}

// 用 refreshToken 换新 token；并发 401 时共享同一个刷新请求
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const body = (await res.json()) as {
          data?: { accessToken?: string; refreshToken?: string };
        };
        const data = body?.data;
        if (!data?.accessToken || !data?.refreshToken) return false;
        const state = getAuthState();
        if (!state) return false;
        setAuthState({
          ...state,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

// 统一请求封装：自动带 Authorization、统一弹错误提示、401 时尝试刷新并重放一次
export async function request<T = unknown>(
  path: string,
  options: RequestInit = {},
  retried = false
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    message.error('网络异常，请稍后重试');
    throw new ApiError(0, 0, '网络异常，请稍后重试');
  }

  let body: { code?: number; message?: string; data?: unknown } | null = null;
  try {
    body = (await res.json()) as { code?: number; message?: string };
  } catch {
    body = null;
  }

  // 401：仅当已登录（存在 refreshToken）时尝试刷新重放；
  // 未登录的 401（如登录接口账号密码错误）直接走下方统一报错，不再触发跳转刷新页面
  if (res.status === 401 && !retried && getRefreshToken()) {
    const ok = await tryRefresh();
    if (ok) {
      return request<T>(path, options, true);
    }
    clearAuthState();
    window.location.href = '/kbk-management/login';
    throw new ApiError(401, body?.code ?? 401, '登录已过期，请重新登录');
  }

  if (!res.ok) {
    const msg = body?.message ?? '请求失败';
    message.error(msg);
    throw new ApiError(res.status, body?.code ?? res.status, msg);
  }

  return body as T;
}
