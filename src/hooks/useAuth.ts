import { AUTH_STORAGE_KEY, AuthState } from '../config/auth';

export function getAuthState(): AuthState | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

export function setAuthState(state: AuthState): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
}

export function clearAuthState(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getToken(): string {
  return getAuthState()?.accessToken ?? '';
}

export function isAuthenticated(): boolean {
  return getToken() !== '';
}
