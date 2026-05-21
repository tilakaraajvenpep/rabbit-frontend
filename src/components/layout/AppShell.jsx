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

  const isMobile = screens.xs || (screens.sm && !screens.md);

  const toggleSidebar = () => {
    if (isMobile) {
      setDrawerVisible(!drawerVisible);
    } else {
      setCollapsed(!collapsed);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {isMobile ? (
        <Drawer
          placement="left"
          onClose={() => setDrawerVisible(false)}
          open={drawerVisible}
          bodyStyle={{ padding: 0 }}
          width={240}
        >
          <Sidebar collapsed={false} isMobile={true} closeDrawer={() => setDrawerVisible(false)} />
        </Drawer>
      ) : (
        <Sidebar collapsed={collapsed} />
      )}
      
      <Layout style={{ 
        marginLeft: isMobile ? 0 : (collapsed ? 80 : 240), 
        transition: 'margin-left 0.2s',
        minHeight: '100vh',
        background: token.colorBgLayout
      }}>
        <Header collapsed={isMobile ? false : collapsed} setCollapsed={toggleSidebar} />
        <Content style={{ 
          margin: isMobile ? '16px 12px' : '24px 32px', 
          padding: 0, 
          background: 'transparent', 
          minHeight: 'calc(100vh - 112px)'
        }}>
          <Outlet />
        </Content>
      </Layout>

      {/* Global Rabbit Assistant */}
      <FloatButton
        icon={<RobotOutlined />}
        type="primary"
        style={{ right: 24, bottom: 24, width: 56, height: 56 }}
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
