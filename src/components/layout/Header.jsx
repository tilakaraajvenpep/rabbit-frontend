import React from 'react';
import { Layout, Button, Badge, Avatar, Space, Dropdown, Typography, Divider, Switch, theme } from 'antd';
import { 
  MenuUnfoldOutlined, 
  MenuFoldOutlined, 
  BellOutlined, 
  LogoutOutlined,
  UserOutlined,
  BulbOutlined,
  BulbFilled
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useNavigate } from 'react-router-dom';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

const Header = ({ collapsed, setCollapsed }) => {
  const navigate = useNavigate();
  const { currentUser, tenantCode, logout } = useAuthStore();
  const { isDarkMode, toggleTheme } = useThemeStore();
  const { token } = theme.useToken();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: 'Profile', onClick: () => navigate('/profile') },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', onClick: handleLogout },
  ];

  return (
    <AntHeader style={{ 
      padding: '0 24px', 
      background: isDarkMode ? 'rgba(17, 24, 39, 0.85)' : 'rgba(255, 255, 255, 0.75)', 
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      height: 64,
      lineHeight: '64px',
      boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.02)',
      borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'}`,
      position: 'sticky',
      top: 0,
      zIndex: 100,
      width: '100%'
    }}>
      <Space size="middle">
        {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
          className: 'trigger',
          onClick: () => setCollapsed(!collapsed),
          style: { fontSize: '20px', cursor: 'pointer', color: token.colorPrimary }
        })}
        <Divider type="vertical" style={{ height: '24px', borderColor: token.colorBorderSecondary }} />
        <Text strong style={{ fontSize: '16px', color: token.colorText }}>
          {tenantCode?.toUpperCase() || 'RABBIT'} Workspace
        </Text>
      </Space>

      <Space size="large" align="center">
        <Switch 
          checkedChildren={<BulbFilled />}
          unCheckedChildren={<BulbOutlined />}
          checked={isDarkMode}
          onChange={toggleTheme}
          style={{ marginRight: 8 }}
        />
        <Badge count={3} size="small">
          <Button type="text" icon={<BellOutlined />} style={{ fontSize: '18px' }} />
        </Badge>
        
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Space style={{ cursor: 'pointer' }}>
            <Avatar src={currentUser?.avatar} icon={<UserOutlined />} />
            <Text strong>{currentUser?.name}</Text>
          </Space>
        </Dropdown>
      </Space>
    </AntHeader>
  );
};

export default Header;
