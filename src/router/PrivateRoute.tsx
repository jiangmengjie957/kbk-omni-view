import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '../hooks/useAuth';

interface Props {
  children: ReactNode;
}

// 保护受限路由：未登录跳转 /login
export function RequireAuth({ children }: Props) {
  if (!isAuthenticated()) {
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
