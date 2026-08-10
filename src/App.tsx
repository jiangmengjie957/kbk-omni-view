import './styles/global.scss';
import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import type { ThemeConfig } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import router from './router';
import { cleanupExpiredHistory } from './utils/historyDb';

const theme: ThemeConfig = {
  token: {
    colorPrimary: '#6366f1',
    borderRadius: 8,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif',
  },
};

export default function App() {
  // 应用启动时清理超期历史记录（超一年）
  useEffect(() => {
    void cleanupExpiredHistory().catch((err) => {
      console.warn('[history] 清理超期记录失败:', err);
    });
  }, []);

  return (
    <ConfigProvider locale={zhCN} theme={theme}>
      <RouterProvider router={router} />
    </ConfigProvider>
  );
}
