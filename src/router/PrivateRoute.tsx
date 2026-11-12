import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getAuthState, isAuthenticated } from '../hooks/useAuth';

interface Props {
  children: ReactNode;
}

// 保护受限路由：未登录跳转 /login
export function RequireAuth({ children }: Props) {
  const auth = getAuthState();

  if (!auth) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// 已登录时访问 /login 跳转 /admin
export function RedirectIfAuth({ children }: Props) {
  if (isAuthenticated()) {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
}

// 权限守卫：缺少指定权限点时跳回 /admin
export function RequirePermission({
  permission,
  children,
}: Props & { permission: string }) {
  const auth = getAuthState();
  if (!auth?.permissions?.includes(permission)) {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
}
