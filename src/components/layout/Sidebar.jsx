import React from 'react';
import { Layout, Menu, Typography } from 'antd';
import { 
  DashboardOutlined, 
  ProjectOutlined, 
  TeamOutlined, 
  CheckSquareOutlined, 
  FileTextOutlined, 
  BarChartOutlined, 
  BellOutlined, 
  MessageOutlined,
  SettingOutlined,
  GlobalOutlined,
  DollarOutlined,
  CalendarOutlined,
  SwapOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { theme as antdTheme } from 'antd';

const { Sider } = Layout;
const { Title, Text } = Typography;

const Sidebar = ({ collapsed, isMobile, closeDrawer }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  const { token } = antdTheme.useToken();

  const handleMenuClick = ({ key }) => {
    navigate(key);
    if (isMobile && closeDrawer) {
      closeDrawer();
    }
  };

  const getMenuItems = () => {
    const items = [];

    if (role === 'SuperAdmin') {
      items.push(
        { key: '/superadmin/tenants', icon: <GlobalOutlined />, label: 'Tenants' },
        { key: '/superadmin/settings', icon: <SettingOutlined />, label: 'Platform Settings' }
      );
    }

    if (role === 'TenantAdmin' || role === 'ProjectManager') {
      if (role === 'TenantAdmin') {
        items.push(
          { key: '/admin/users', icon: <TeamOutlined />, label: 'Users' },
          { key: '/admin/hours', icon: <DollarOutlined />, label: 'Hour Allocation' },
          { key: '/admin/subscription', icon: <SettingOutlined />, label: 'Subscription' }
        );
      }
      items.push(
        { key: '/pm/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
        { key: '/pm/board', icon: <CheckSquareOutlined />, label: 'Kanban Board' },
        { key: '/pm/analytics', icon: <BarChartOutlined />, label: 'Analytics' },
        { key: '/pm/alerts', icon: <BellOutlined />, label: 'Alerts Feed' },
        { key: '/shared/reports', icon: <FileTextOutlined />, label: 'Overall Reports' },
        { key: '/pm/employee-reports', icon: <BarChartOutlined />, label: 'Employee Reports' },
        { key: '/pm/leaves', icon: <CalendarOutlined />, label: 'Leave Approvals' },
        { key: '/pm/team', icon: <TeamOutlined />, label: 'TL & Employees' },
        { key: '/pm/cross-team', icon: <SwapOutlined />, label: 'Cross-Team Status' }
      );
    }

    if (role === 'Sales') {
      items.push(
        { key: '/sales/projects', icon: <ProjectOutlined />, label: 'Projects' },
        { key: '/sales/projects/create', icon: <FileTextOutlined />, label: 'Create Project' },
        { key: '/shared/reports', icon: <FileTextOutlined />, label: 'Overall Reports' }
      );
    }

    if (role === 'Accounts') {
      items.push(
        { key: '/accounts/pending', icon: <CheckSquareOutlined />, label: 'Pending Review' },
        { key: '/accounts/leaves', icon: <CalendarOutlined />, label: 'Leave Approvals' },
        { key: '/shared/reports', icon: <FileTextOutlined />, label: 'Overall Reports' }
      );
    }

    if (role === 'TeamLead') {
      items.push(
        { key: '/teamlead/projects', icon: <ProjectOutlined />, label: 'My Projects' },
        { key: '/teamlead/board', icon: <DashboardOutlined />, label: 'Kanban Board' },
        { key: '/teamlead/employee-reports', icon: <BarChartOutlined />, label: 'Employee Reports' },
        { key: '/teamlead/leaves', icon: <CalendarOutlined />, label: 'Leave Approvals' }
      );
    }

    if (role === 'Employee') {
      items.push(
        { key: '/employee/tickets', icon: <CheckSquareOutlined />, label: 'My Tickets' },
        { key: '/employee/report', icon: <FileTextOutlined />, label: 'Daily Report' },
        { key: '/employee/reports', icon: <BarChartOutlined />, label: 'Work Reports' },
        { key: '/employee/leaves', icon: <CalendarOutlined />, label: 'Leave Requests' }
      );
    }

    // Common items
    items.push({ key: '/chatbot', icon: <MessageOutlined />, label: 'Rabbit Assistant' });

    return items;
  };

  return (
    <Sider 
      trigger={null} 
      collapsible 
      collapsed={collapsed} 
      theme={isDarkMode ? "dark" : "light"} 
      width={240}
      style={{ 
        boxShadow: isDarkMode ? 'none' : '2px 0 8px 0 rgba(29,35,41,.05)',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 101,
        borderRight: isDarkMode ? `1px solid ${token.colorBorderSecondary}` : 'none',
        background: isDarkMode ? '#111827' : '#ffffff'
      }}
    >
      <div style={{ 
        height: 64, 
        display: 'flex', 
        alignItems: 'center', 
        padding: collapsed ? '0 24px' : '0 24px', 
        background: 'transparent',
        borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'}` 
      }}>
        <div style={{ 
          width: 32, 
          height: 32, 
          background: token.colorPrimary, 
          borderRadius: 6, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          marginRight: collapsed ? 0 : 12 
        }}>
          <Text strong style={{ color: '#fff', fontSize: '18px' }}>R</Text>
        </div>
        {!collapsed && (
          <Title level={4} style={{ margin: 0, color: token.colorPrimary, fontSize: '20px', fontWeight: 700, letterSpacing: '-0.5px' }}>
            Rabbit 4.0
          </Title>
        )}
      </div>
      <Menu
        theme={isDarkMode ? "dark" : "light"}
        mode="inline"
        selectedKeys={[location.pathname]}
        onClick={handleMenuClick}
        items={getMenuItems()}
        style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', overflowX: 'hidden', borderRight: 0, background: 'transparent' }}
      />
    </Sider>
  );
};


export default Sidebar;
