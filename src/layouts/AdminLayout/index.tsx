import { useState, useEffect } from 'react';
import { Layout, Menu, Dropdown, Avatar, Typography, theme } from 'antd';
import type { MenuProps } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HomeOutlined,
  UserOutlined,
  LogoutOutlined,
  DashboardOutlined,
  BarChartOutlined,
  ScheduleOutlined,
  PieChartOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { clearAuthState, getAuthState } from '../../hooks/useAuth';
import { logout } from '../../api/auth';
import PageTransition from '../../components/PageTransition';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import styles from './AdminLayout.module.scss';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const SIDER_WIDTH = 220;
const SIDER_COLLAPSED_WIDTH = 64;
const HEADER_HEIGHT = 64;

const STATS_MENU_KEY = 'data-stats';

const menuItems: MenuProps['items'] = [
  {
    key: '/admin',
    icon: <HomeOutlined />,
    label: '首页',
  },
  {
    key: STATS_MENU_KEY,
    icon: <DashboardOutlined />,
    label: '数据统计',
    children: [
      {
        key: '/admin/perf-stats',
        icon: <BarChartOutlined />,
        label: '绩效统计',
      },
      {
        key: '/admin/lesson-cancel-report',
        icon: <ScheduleOutlined />,
        label: '消课表',
      },
      {
        key: '/admin/lesson-hour-stats',
        icon: <PieChartOutlined />,
        label: '课时统计',
      },
    ],
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
  const userName = getAuthState()?.user?.name ?? '用户';
  const [pwdModalOpen, setPwdModalOpen] = useState(
    () => getAuthState()?.mustChangePassword === true
  );
  const [openKeys, setOpenKeys] = useState<string[]>([STATS_MENU_KEY]);

  // 路由切到统计子页时，确保“数据统计”子菜单展开
  useEffect(() => {
    if (
      location.pathname === '/admin/perf-stats' ||
      location.pathname === '/admin/lesson-cancel-report' ||
      location.pathname === '/admin/lesson-hour-stats'
    ) {
      setOpenKeys(prev =>
        prev.includes(STATS_MENU_KEY) ? prev : [...prev, STATS_MENU_KEY]
      );
    }
  }, [location.pathname]);

  function handleMenuClick({ key }: { key: string }) {
    void navigate(key);
  }

  function handleHeaderDropdown({ key }: { key: string }) {
    if (key === 'logout') {
      void logout().catch(() => {});
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
            openKeys={openKeys}
            onOpenChange={setOpenKeys}
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
              <Text className={styles.userName}>{userName}</Text>
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

      {/* 首次登录强提醒：修改初始密码，可关闭跳过 */}
      <ChangePasswordModal
        open={pwdModalOpen}
        onClose={() => setPwdModalOpen(false)}
      />
    </Layout>
  );
}
