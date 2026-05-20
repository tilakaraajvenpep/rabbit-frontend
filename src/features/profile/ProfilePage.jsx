import React, { useState } from 'react';
import {
  Card, Form, Input, Button, Space, Typography, Row, Col,
  Avatar, Tag, Divider, notification, theme, Tabs
} from 'antd';
import {
  UserOutlined, MailOutlined, LockOutlined, SaveOutlined,
  IdcardOutlined, TeamOutlined, EditOutlined, KeyOutlined,
  GlobalOutlined, SettingOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import apiClient from '../../services/apiClient';
import PageHeader from '../../components/common/PageHeader';

const { Title, Text } = Typography;

const ROLE_META = {
  SuperAdmin:     { color: 'red',    label: 'Super Admin',     icon: <GlobalOutlined /> },
  TenantAdmin:    { color: 'purple', label: 'Tenant Admin',    icon: <SettingOutlined /> },
  Sales:          { color: 'blue',   label: 'Sales',           icon: <IdcardOutlined /> },
  Accounts:       { color: 'cyan',   label: 'Accounts',        icon: <IdcardOutlined /> },
  TeamLead:       { color: 'orange', label: 'Team Lead',       icon: <TeamOutlined />   },
  Employee:       { color: 'green',  label: 'Employee',        icon: <UserOutlined />   },
  ProjectManager: { color: 'gold',   label: 'Project Manager', icon: <TeamOutlined />   },
};

const ProfilePage = () => {
  const { currentUser, tenantCode, setUser } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  const { token } = theme.useToken();

  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const role = currentUser?.role || 'Employee';
  const roleMeta = ROLE_META[role] || ROLE_META['Employee'];

  const handleUpdateProfile = async (values) => {
    setSavingProfile(true);
    try {
      const res = await apiClient.put('/users/me/profile', {
        fullName: values.fullName,
        email: values.email,
      });
      
      const updatedUser = res.data.data;
      const mergedUser = {
        ...currentUser,
        ...updatedUser,
        name: updatedUser.fullName,
      };
      setUser(mergedUser);

      notification.success({
        message: 'Profile Updated',
        description: 'Your profile information has been saved successfully.',
      });
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to update profile.';
      notification.error({ message: 'Update Failed', description: msg });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (values) => {
    setSavingPassword(true);
    try {
      await apiClient.put('/users/me/password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      notification.success({
        message: 'Password Changed',
        description: 'Your password has been updated. Please use the new password on next login.',
      });
      passwordForm.resetFields();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to change password.';
      notification.error({ message: 'Password Error', description: msg });
    } finally {
      setSavingPassword(false);
    }
  };

  const cardStyle = {
    borderRadius: 12,
    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
  };

  const tabItems = [
    {
      key: 'profile',
      label: (
        <Space>
          <EditOutlined />
          Edit Profile
        </Space>
      ),
      children: (
        <Form
          form={profileForm}
          layout="vertical"
          initialValues={{
            fullName: currentUser?.name || currentUser?.fullName || '',
            email: currentUser?.email || '',
          }}
          onFinish={handleUpdateProfile}
        >
          <Row gutter={24}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="fullName"
                label="Full Name"
                rules={[{ required: true, message: 'Please enter your full name' }]}
              >
                <Input
                  prefix={<UserOutlined style={{ color: token.colorTextSecondary }} />}
                  placeholder="Your full name"
                  size="large"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="email"
                label="Email Address"
                rules={[
                  { required: true, message: 'Please enter your email' },
                  { type: 'email', message: 'Please enter a valid email' },
                ]}
              >
                <Input
                  prefix={<MailOutlined style={{ color: token.colorTextSecondary }} />}
                  placeholder="Your email"
                  size="large"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} sm={12}>
              <Form.Item label="Role">
                <Input
                  prefix={roleMeta.icon}
                  value={roleMeta.label}
                  disabled
                  size="large"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Workspace">
                <Input
                  value={tenantCode?.toUpperCase() || '—'}
                  disabled
                  size="large"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              icon={<SaveOutlined />}
              loading={savingProfile}
            >
              Save Changes
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'password',
      label: (
        <Space>
          <KeyOutlined />
          Change Password
        </Space>
      ),
      children: (
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleChangePassword}
        >
          <Row gutter={24}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="currentPassword"
                label="Current Password"
                rules={[{ required: true, message: 'Please enter your current password' }]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: token.colorTextSecondary }} />}
                  placeholder="Current password"
                  size="large"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="newPassword"
                label="New Password"
                rules={[
                  { required: true, message: 'Please enter a new password' },
                  { min: 6, message: 'Password must be at least 6 characters' },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: token.colorTextSecondary }} />}
                  placeholder="New password"
                  size="large"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="confirmPassword"
                label="Confirm New Password"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: 'Please confirm your new password' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Passwords do not match'));
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: token.colorTextSecondary }} />}
                  placeholder="Confirm new password"
                  size="large"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              icon={<KeyOutlined />}
              loading={savingPassword}
              danger
            >
              Update Password
            </Button>
          </Form.Item>
        </Form>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', paddingBottom: 40 }}>
      <PageHeader title="My Profile" />

      {/* Profile Hero Card */}
      <Card style={{ ...cardStyle, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{ position: 'relative' }}>
            <Avatar
              size={96}
              src={currentUser?.avatar}
              icon={<UserOutlined />}
              style={{
                background: `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorInfo})`,
                fontSize: 40,
                boxShadow: `0 0 0 4px ${isDarkMode ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)'}`,
              }}
            />
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
              <Title level={3} style={{ margin: 0 }}>
                {currentUser?.name || currentUser?.fullName || 'User'}
              </Title>
              <Tag color={roleMeta.color} icon={roleMeta.icon} style={{ fontSize: 13, padding: '2px 10px' }}>
                {roleMeta.label}
              </Tag>
            </div>
            <Space size="large" wrap>
              <Space size={6}>
                <MailOutlined style={{ color: token.colorTextSecondary }} />
                <Text type="secondary">{currentUser?.email || '—'}</Text>
              </Space>
              <Space size={6}>
                <TeamOutlined style={{ color: token.colorTextSecondary }} />
                <Text type="secondary">
                  Workspace: <Text strong>{tenantCode?.toUpperCase() || '—'}</Text>
                </Text>
              </Space>
            </Space>
          </div>
        </div>
      </Card>

      {/* Tabs Card */}
      <Card style={cardStyle}>
        <Tabs defaultActiveKey="profile" items={tabItems} size="large" />
      </Card>
    </div>
  );
};

export default ProfilePage;
