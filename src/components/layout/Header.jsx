import React, { useState, useEffect } from 'react';
import { Layout, Button, Badge, Avatar, Space, Dropdown, Typography, Divider, Switch, theme } from 'antd';
import { 
  MenuUnfoldOutlined, 
  MenuFoldOutlined, 
  BellOutlined, 
  LogoutOutlined,
  UserOutlined,
  BulbOutlined,
  BulbFilled,
  WarningOutlined,
  FileTextOutlined,
  ProjectOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../../services/notificationService';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Header: AntHeader } = Layout;
const { Text } = Typography;

const Header = ({ collapsed, setCollapsed }) => {
  const navigate = useNavigate();
  const { currentUser, tenantCode, logout } = useAuthStore();
  const { isDarkMode, toggleTheme } = useThemeStore();
  const { token } = theme.useToken();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const res = await notificationService.getNotifications();
      setNotifications(res.data || []);
      setUnreadCount((res.data || []).filter(n => !n.isRead).length);
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 15000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const handleMarkAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      fetchNotifications();
    } catch (e) {
      console.error('Failed to mark notification as read:', e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      fetchNotifications();
    } catch (e) {
      console.error('Failed to mark all notifications as read:', e);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: 'Profile', onClick: () => navigate('/profile') },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', onClick: handleLogout },
  ];

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'alert':
        return <WarningOutlined style={{ color: '#ef4444', fontSize: '16px' }} />;
      case 'ticket':
        return <FileTextOutlined style={{ color: '#3b82f6', fontSize: '16px' }} />;
      case 'project':
        return <ProjectOutlined style={{ color: '#6366f1', fontSize: '16px' }} />;
      case 'leave':
        return <CalendarOutlined style={{ color: '#f59e0b', fontSize: '16px' }} />;
      default:
        return <BellOutlined style={{ color: '#6b7280', fontSize: '16px' }} />;
    }
  };

  const notificationContent = (
    <div style={{
      background: isDarkMode ? '#1f2937' : '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      width: '320px',
      border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${isDarkMode ? '#374151' : '#f3f4f6'}`
      }}>
        <Text strong style={{ fontSize: '14px', color: token.colorText }}>Notifications</Text>
        {unreadCount > 0 && (
          <Button 
            type="link" 
            size="small" 
            onClick={handleMarkAllRead}
            style={{ padding: 0, height: 'auto', fontSize: '12px' }}
          >
            Mark all read
          </Button>
        )}
      </div>
      <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '4px 0' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af' }}>
            No notifications
          </div>
        ) : (
          notifications.map((notif) => (
            <div 
              key={notif.notificationId} 
              onClick={() => !notif.isRead && handleMarkAsRead(notif.notificationId)}
              style={{
                padding: '10px 16px',
                display: 'flex',
                gap: '12px',
                cursor: notif.isRead ? 'default' : 'pointer',
                background: !notif.isRead ? (isDarkMode ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.03)') : 'transparent',
                transition: 'background 0.2s',
                borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}`
              }}
            >
              <div style={{ marginTop: '2px' }}>
                {getNotificationIcon(notif.type)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontWeight: !notif.isRead ? '600' : '400', 
                  fontSize: '13px',
                  color: token.colorText,
                  marginBottom: '2px'
                }}>
                  {notif.title}
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: isDarkMode ? '#9ca3af' : '#6b7280',
                  lineHeight: '1.4'
                }}>
                  {notif.message}
                </div>
                <div style={{ 
                  fontSize: '10px', 
                  color: '#9ca3af', 
                  marginTop: '4px' 
                }}>
                  {dayjs(notif.createdAt).fromNow()}
                </div>
              </div>
              {!notif.isRead && (
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#4f46e5',
                  marginTop: '6px'
                }} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

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
        
        <Dropdown dropdownRender={() => notificationContent} trigger={['click']} placement="bottomRight">
          <Badge count={unreadCount} size="small" style={{ cursor: 'pointer' }}>
            <Button type="text" icon={<BellOutlined />} style={{ fontSize: '18px' }} />
          </Badge>
        </Dropdown>
        
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
