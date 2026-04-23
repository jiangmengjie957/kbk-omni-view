import { useState } from 'react';
import { Layout, Menu, Dropdown, Avatar, Typography, theme } from 'antd';
import type { MenuProps } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HomeOutlined,
  UserOutlined,
  LogoutOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { clearAuthState } from '../../hooks/useAuth';
import PageTransition from '../../components/PageTransition';
import styles from './AdminLayout.module.scss';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const SIDER_WIDTH = 220;
const SIDER_COLLAPSED_WIDTH = 64;
const HEADER_HEIGHT = 64;

const menuItems: MenuProps['items'] = [
  {
    key: '/admin',
    icon: <HomeOutlined />,
    label: '首页',
  },
  {
    key: '/admin/perf-stats',
    icon: <BarChartOutlined />,
    label: '绩效统计',
  },
];

const headerDropdownItems: MenuProps['items'] = [
  {
    key: 'logout',
    icon: <LogoutOutlined />,
    label: '退出登录',
    danger: true,
  },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  function handleMenuClick({ key }: { key: string }) {
    void navigate(key);
  }

  function handleHeaderDropdown({ key }: { key: string }) {
    if (key === 'logout') {
      clearAuthState();
      void navigate('/login', { replace: true });
    }
  }

  return (
    <Layout className={styles.root}>
      {/* 侧边栏 — Framer Motion 控制宽度动画 */}
      <motion.div
        animate={{ width: collapsed ? SIDER_COLLAPSED_WIDTH : SIDER_WIDTH }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className={styles.sider}
        style={{
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Sider
          width="100%"
          collapsedWidth={SIDER_COLLAPSED_WIDTH}
          collapsed={collapsed}
          className={styles.siderInner}
          trigger={null}
        >
          {/* Logo 区域 */}
          <div
            className={styles.logoArea}
            style={{
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? 0 : '0 20px',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <div
              className={styles.logoIcon}
              style={{ background: token.colorPrimary }}
            >
              K
            </div>
            {!collapsed && (
              <Text
                strong
                className={styles.logoText}
                style={{ color: token.colorText }}
              >
                KBK 管理中心
              </Text>
            )}
          </div>

          {/* 菜单 */}
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={handleMenuClick}
            className={styles.menu}
          />
        </Sider>
      </motion.div>

      {/* 右侧主体 */}
      <Layout
        className={styles.mainLayout}
        style={{
          marginLeft: collapsed ? SIDER_COLLAPSED_WIDTH : SIDER_WIDTH,
          transition: 'margin-left 0.25s ease-in-out',
        }}
      >
        {/* 顶部 Header */}
        <Header
          className={styles.header}
          style={{
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          {/* 折叠按钮 */}
          <div
            className={styles.collapseBtn}
            onClick={() => setCollapsed(!collapsed)}
            style={{ color: token.colorTextSecondary }}
            onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = token.colorFillSecondary)}
            onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>

          {/* 右侧用户区 */}
          <Dropdown
            menu={{ items: headerDropdownItems, onClick: handleHeaderDropdown }}
            placement="bottomRight"
            trigger={['click']}
          >
            <div
              className={styles.userArea}
              onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = token.colorFillSecondary)}
              onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}
            >
              <Avatar size={32} icon={<UserOutlined />} style={{ background: token.colorPrimary }} />
              <Text className={styles.userName}>管理员</Text>
            </div>
          </Dropdown>
        </Header>

        {/* 内容区 */}
        <Content
          className={styles.content}
          style={{
            minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
            background: token.colorBgLayout,
          }}
        >
          <PageTransition locationKey={location.pathname}>
            <Outlet />
          </PageTransition>
        </Content>
      </Layout>
    </Layout>
  );
}
