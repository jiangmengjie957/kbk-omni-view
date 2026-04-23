import { AUTH_STORAGE_KEY, AUTH_EXPIRE_MS } from '../config/auth';

interface AuthData {
  loggedIn: boolean;
  expireAt: number;
}

export function getAuthState(): AuthData | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const data: AuthData = JSON.parse(raw) as AuthData;
    if (!data.loggedIn || Date.now() > data.expireAt) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function setAuthState(): void {
  const data: AuthData = {
    loggedIn: true,
    expireAt: Date.now() + AUTH_EXPIRE_MS,
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
}

export function clearAuthState(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function isAuthenticated(): boolean {
  return getAuthState() !== null;
}
