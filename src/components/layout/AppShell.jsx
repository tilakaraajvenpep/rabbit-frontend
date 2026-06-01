import React, { useState, useEffect } from 'react';
import { Layout, Grid, Drawer, FloatButton, theme } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { Outlet } from 'react-router-dom';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';
import Sidebar from './Sidebar';
import Header from './Header';
import AssistantDrawer from '../common/AssistantDrawer';

const { Content } = Layout;
const { useBreakpoint } = Grid;

const AppShell = () => {
  const screens = useBreakpoint();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [assistantVisible, setAssistantVisible] = useState(false);
  
  const { isDarkMode } = useThemeStore();
  const { token } = theme.useToken();
  const { isAuthenticated, setUser } = useAuthStore();

  // Refresh user profile on mount to pick up latest allocatedHours / role changes
  useEffect(() => {
    if (isAuthenticated) {
      authService.me()
        .then(res => { if (res?.data?.data) setUser(res.data.data); })
        .catch(() => {}); // Silent fail — don't log out on refresh error
    }
  }, [isAuthenticated]);

  // Auto-collapse on smaller screens
  useEffect(() => {
    if (screens.md === false) {
      setCollapsed(true);
    }
  }, [screens.md]);

  // Derived booleans — treat undefined (initial SSR) as desktop
  const isMobile = screens.md === false;

  const toggleSidebar = () => {
    if (isMobile) {
      setDrawerVisible(prev => !prev);
    } else {
      setCollapsed(prev => !prev);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', maxWidth: '100vw', overflowX: 'hidden' }}>
      {/* ── Sidebar: Drawer on mobile, fixed Sider on desktop ── */}
      {isMobile ? (
        <Drawer
          placement="left"
          onClose={() => setDrawerVisible(false)}
          open={drawerVisible}
          styles={{ body: { padding: 0 } }}
          width={240}
          style={{ zIndex: 1001 }}
        >
          <Sidebar collapsed={false} isMobile={true} closeDrawer={() => setDrawerVisible(false)} />
        </Drawer>
      ) : (
        <Sidebar collapsed={collapsed} />
      )}

      {/* ── Main content area ── */}
      <Layout style={{
        marginLeft: isMobile ? 0 : (collapsed ? 80 : 240),
        transition: 'margin-left 0.2s',
        minHeight: '100vh',
        maxWidth: isMobile ? '100vw' : undefined,
        overflowX: 'hidden',
        background: token.colorBgLayout
      }}>
        <Header collapsed={isMobile ? false : collapsed} setCollapsed={toggleSidebar} />

        <Content style={{
          margin: isMobile ? '12px 10px' : '24px 32px',
          padding: 0,
          background: 'transparent',
          minHeight: 'calc(100vh - 112px)',
          // Prevent content from overflowing horizontally on mobile
          overflowX: 'hidden',
          maxWidth: '100%',
        }}>
          <Outlet />
        </Content>
      </Layout>

      {/* ── Global Rabbit Assistant float button ── */}
      <FloatButton
        icon={<RobotOutlined />}
        type="primary"
        style={{
          right: isMobile ? 16 : 24,
          bottom: isMobile ? 20 : 24,
          width: isMobile ? 48 : 56,
          height: isMobile ? 48 : 56,
        }}
        tooltip={<div>Rabbit Assistant</div>}
        onClick={() => setAssistantVisible(true)}
      />

      <AssistantDrawer
        open={assistantVisible}
        onClose={() => setAssistantVisible(false)}
      />
    </Layout>
  );
};

export default AppShell;
