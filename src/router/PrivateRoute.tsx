import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getAuthState, isAuthenticated } from '../hooks/useAuth';

interface Props {
  children: ReactNode;
}

// 保护受限路由：未登录跳转 /login；需改密时强制跳转 /change-password
export function RequireAuth({ children }: Props) {
  const location = useLocation();
  const auth = getAuthState();

  if (!auth) {
    return <Navigate to="/login" replace />;
  }
  if (auth.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
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
