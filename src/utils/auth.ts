import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const TOKEN_KEY = 'auth_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getAdminInfo() {
  const info = localStorage.getItem('admin_info');
  if (info) {
    try {
      return JSON.parse(info);
    } catch {
      return null;
    }
  }
  return null;
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('admin_info');
}

/**
 * 路由守卫 Hook - 未登录时跳转到登录页
 */
export function useAuthGuard() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      // 保存当前路径，登录后跳转回来
      navigate('/login', { state: { from: location }, replace: true });
    }
  }, [navigate, location]);

  return !!getToken();
}
