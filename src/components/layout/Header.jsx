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
    { key: 'profile', icon: <UserOutlined />, label: 'Profile' },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', onClick: handleLogout },
  ];

  return (
    <AntHeader style={{ 
      padding: '0 24px', 
      background: token.colorBgContainer, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      height: 64,
      lineHeight: '64px',
      boxShadow: `0 2px 8px ${isDarkMode ? 'rgba(0,0,0,0.5)' : '#f0f1f2'}`,
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
