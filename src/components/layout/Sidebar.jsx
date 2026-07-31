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
  SwapOutlined,
  ClockCircleOutlined,
  UserDeleteOutlined,
  NodeIndexOutlined
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
  const { role, currentUser } = useAuthStore();
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

    const userRoles = typeof role === 'string'
      ? role.split(',').map(r => r.trim()).filter(Boolean)
      : (Array.isArray(role) ? role : [role]);

    const hasRole = (r) => userRoles.includes(r);

    if (hasRole('SuperAdmin')) {
      items.push(
        { key: '/superadmin/tenants', icon: <GlobalOutlined />, label: 'Tenants' },
        { key: '/superadmin/settings', icon: <SettingOutlined />, label: 'Platform Settings' }
      );
    }

    if (hasRole('TenantAdmin') || hasRole('ProjectManager')) {
      if (hasRole('TenantAdmin')) {
        items.push(
          { key: '/admin/users', icon: <TeamOutlined />, label: 'Users' },
          { key: '/admin/hours', icon: <DollarOutlined />, label: 'Hour Allocation' },
          { key: '/admin/subscription', icon: <SettingOutlined />, label: 'Subscription' }
        );
      }
      items.push(
        { key: '/pm/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
        { key: '/pm/board', icon: <CheckSquareOutlined />, label: 'Project Board' },
        { key: '/pm/kanban', icon: <DashboardOutlined />, label: 'My Kanban' },
        { key: '/pm/tickets', icon: <CheckSquareOutlined />, label: 'My Tickets' },
        { key: '/pm/backlogs', icon: <ClockCircleOutlined />, label: 'Ticket Backlogs' },
        { key: '/pm/report', icon: <FileTextOutlined />, label: 'Daily Report' },
        { key: '/pm/my-reports', icon: <FileTextOutlined />, label: 'My EOD Reports' },
        { key: '/pm/analytics', icon: <TeamOutlined />, label: 'Scrum Master' },
        { key: '/pm/alerts', icon: <BellOutlined />, label: 'Alerts Feed' },
        { key: '/shared/reports', icon: <FileTextOutlined />, label: 'Overall Reports' },
        { key: '/pm/employee-reports', icon: <BarChartOutlined />, label: 'Employee Reports' },
        { key: '/pm/report-access-approvals', icon: <CalendarOutlined />, label: 'Report Access Approvals' },
        { key: '/pm/leaves', icon: <CalendarOutlined />, label: 'Leave Approvals' },
        { key: '/pm/timer-requests', icon: <ClockCircleOutlined />, label: 'Additional Hours Requests' },
        { key: '/pm/team', icon: <TeamOutlined />, label: 'TL & Employees' },
        { key: '/pm/cross-team', icon: <SwapOutlined />, label: 'Cross-Team Status' },
        { key: '/pm/org-chart', icon: <NodeIndexOutlined />, label: 'Organization Chart' }
      );
    }

    if (hasRole('Sales')) {
      items.push(
        { key: '/sales/projects', icon: <ProjectOutlined />, label: 'Projects' },
        { key: '/sales/projects/create', icon: <FileTextOutlined />, label: 'Create Project' },
        { key: '/shared/reports', icon: <FileTextOutlined />, label: 'Overall Reports' }
      );
    }

    if (hasRole('Accounts')) {
      items.push(
        { key: '/accounts/pending', icon: <CheckSquareOutlined />, label: 'Pending Review' },
        { key: '/accounts/leaves', icon: <CalendarOutlined />, label: 'Leave Approvals' },
        { key: '/accounts/cost-history', icon: <DollarOutlined />, label: 'Cost Analysis History' },
        { key: '/accounts/profit-loss', icon: <BarChartOutlined />, label: 'Project Profit & Loss' },
        { key: '/accounts/users', icon: <TeamOutlined />, label: 'User Management' },
        { key: '/accounts/org-chart', icon: <NodeIndexOutlined />, label: 'Organization Chart' },
        { key: '/accounts/standard-cost', icon: <DollarOutlined />, label: 'Standard Cost' },
        { key: '/accounts/hours-approval', icon: <ClockCircleOutlined />, label: 'Additional Hours Approval' },
        { key: '/accounts/reports', icon: <BarChartOutlined />, label: 'Work Reports' },
        { key: '/shared/reports', icon: <FileTextOutlined />, label: 'Overall Reports' }
      );
    }

    if (hasRole('TeamLead')) {
      items.push(
        { key: '/teamlead/projects', icon: <ProjectOutlined />, label: 'My Projects' },
        { key: '/teamlead/team', icon: <TeamOutlined />, label: 'My Team' },
        { key: '/teamlead/board', icon: <DashboardOutlined />, label: 'Project Board' },
        { key: '/teamlead/kanban', icon: <DashboardOutlined />, label: 'My Kanban' },
        { key: '/teamlead/tickets', icon: <CheckSquareOutlined />, label: 'My Tickets' },
        { key: '/teamlead/backlogs', icon: <ClockCircleOutlined />, label: 'Ticket Backlogs' },
        { key: '/teamlead/report', icon: <FileTextOutlined />, label: 'Daily Report' },
        { key: '/teamlead/my-reports', icon: <FileTextOutlined />, label: 'My EOD Reports' },
        { key: '/teamlead/scrum-master', icon: <TeamOutlined />, label: 'Scrum Master' },
        { key: '/teamlead/employee-reports', icon: <BarChartOutlined />, label: 'Employee Reports' },
        { key: '/teamlead/leaves', icon: <CalendarOutlined />, label: 'Leave Approvals' },
        { key: '/teamlead/report-access-approvals', icon: <CalendarOutlined />, label: 'Report Access Approvals' },
        { key: '/teamlead/timer-requests', icon: <ClockCircleOutlined />, label: 'Additional Hours Requests' },
        { key: '/teamlead/cross-share', icon: <SwapOutlined />, label: 'Cross-Team Share' },
        { key: '/teamlead/org-chart', icon: <NodeIndexOutlined />, label: 'Organization Chart' }
      );
    }

    if (hasRole('Employee')) {
      items.push(
        { key: '/employee/tickets', icon: <CheckSquareOutlined />, label: 'My Tickets' },
        { key: '/employee/kanban', icon: <DashboardOutlined />, label: 'Kanban Board' },
        { key: '/employee/backlogs', icon: <ClockCircleOutlined />, label: 'Ticket Backlogs' },
        { key: '/employee/report', icon: <FileTextOutlined />, label: 'Daily Report' },
        { key: '/employee/my-reports', icon: <FileTextOutlined />, label: 'My EOD Reports' },
        { key: '/employee/reports', icon: <BarChartOutlined />, label: 'Work Reports' },
        { key: '/employee/scrum-master', icon: <TeamOutlined />, label: 'Scrum Master' }
      );
    }

    if (hasRole('HR')) {
      items.push(
        { key: '/hr/board', icon: <CheckSquareOutlined />, label: 'Project Board' },
        { key: '/hr/team', icon: <TeamOutlined />, label: 'Team Details' },
        { key: '/hr/approve-leaves', icon: <CalendarOutlined />, label: 'Approve Leaves & Perms' },
        { key: '/hr/view-leaves', icon: <CalendarOutlined />, label: 'View Leaves & Perms' },
        { key: '/hr/report-access-approvals', icon: <CalendarOutlined />, label: 'Report Access Approvals' },
        { key: '/hr/projects', icon: <ProjectOutlined />, label: 'Project Allocations' },
        { key: '/missing-tasks', icon: <ClockCircleOutlined />, label: 'Missing Tasks' },
        { key: '/hr/reports', icon: <BarChartOutlined />, label: 'Work Reports' },
        { key: '/hr/org-chart', icon: <NodeIndexOutlined />, label: 'Organization Chart' },
        { key: '/hr/offboarding', icon: <UserDeleteOutlined />, label: 'Offboarding' }
      );
    }

    // Common items
    items.push({ key: '/chatbot', icon: <MessageOutlined />, label: 'Rabbit Assistant' });

    // Deduplicate by item key
    const seenKeys = new Set();
    return items.filter(item => {
      if (seenKeys.has(item.key)) return false;
      seenKeys.add(item.key);
      if (currentUser?.permissions && currentUser.permissions[item.key] === false) {
        return false;
      }
      return true;
    });
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
