// 后端 API 基础地址
// 开发环境直连本地后端；生产环境走 nginx 反代到同域 /api/v1
export const API_BASE = import.meta.env.DEV
  ? 'http://127.0.0.1:4001/api/v1'
  : 'https://www.mengmenga.com/api/v1';

// localStorage key
export const AUTH_STORAGE_KEY = 'kbk_auth';

export interface AuthUser {
  userId: number;
  employeeId: number;
  employeeNo: string;
  username: string;
  name: string;
  gender: number;
  avatarUrl: string | null;
  campusId: number;
}

export interface AuthState {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  roles: string[];
  isSuper: boolean;
  dataScope: number;
  mustChangePassword: boolean;
}
