import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Space, Modal, notification } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';
import { logger } from '../../utils/logger';

const { Title, Text } = Typography;

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const navigate = useNavigate();
  const { login, tenantCode: currentTenantCode } = useAuthStore();
  const [newTenantCode, setNewTenantCode] = useState(currentTenantCode);
  const { control, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const onSubmit = async (data) => {
    setLoading(true);

    await new Promise(resolve => setTimeout(resolve, 1000));

    if (import.meta.env.VITE_USE_MOCK === 'true') {
      // mock logic unused
    } else {
      try {
        const normalizedEmail = data.email.toLowerCase().trim();
        const response = await authService.login(normalizedEmail, data.password, currentTenantCode);

        if (response.success) {
          const { user, accessToken, refreshToken } = response.data;
          login(user, accessToken, refreshToken);
          logger.info('Login successful', user);

          switch (user.role) {
            case 'SuperAdmin': navigate('/superadmin/tenants'); break;
            case 'TenantAdmin': navigate('/admin/users'); break;
            case 'Sales': navigate('/sales/projects'); break;
            case 'Accounts': navigate('/accounts/pending'); break;
            case 'TeamLead': navigate('/teamlead/projects'); break;
            case 'Employee': navigate('/employee/tickets'); break;
            case 'ProjectManager': navigate('/pm/dashboard'); break;
            case 'HR': navigate('/hr/team'); break;
            default: navigate('/');
          }
        } else {
          notification.error({
            message: 'Login Failed',
            description: response.message || 'Invalid credentials'
          });
        }
      } catch (err) {
        const serverMsg = err?.response?.data?.message || '';

        if (serverMsg.toLowerCase().includes('not registered') || serverMsg.toLowerCase().includes('email')) {
          notification.error({
            message: 'Email Not Found',
            description: `The email address is not registered in the "${currentTenantCode.toUpperCase()}" workspace. Please check your email or workspace code.`,
            duration: 6,
          });
        } else if (serverMsg.toLowerCase().includes('incorrect password') || serverMsg.toLowerCase().includes('password')) {
          notification.error({
            message: 'Wrong Password',
            description: 'The password you entered is incorrect. Please try again.',
            duration: 5,
          });
        } else {
          notification.error({
            message: 'Login Error',
            description: serverMsg || 'Unable to connect. Please check that the backend server is running.',
            duration: 5,
          });
        }
      }
    }

    setLoading(false);
  };

  const handleWorkspaceChange = () => {
    useAuthStore.setState({ tenantCode: newTenantCode.toLowerCase().trim() });
    setIsWorkspaceModalOpen(false);
    notification.success({ message: 'Workspace Updated', description: `Switched to ${newTenantCode.toUpperCase()}` });
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: '#ffffff',
    }}>
      <Card style={{ 
        width: '100%', 
        maxWidth: 420, 
        textAlign: 'center',
        margin: '0 16px'
      }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={2} style={{ marginBottom: 0 }}>Rabbit 4.0</Title>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Text type="secondary">{currentTenantCode.toUpperCase()} Workspace</Text>
              <Button type="link" size="small" onClick={() => setIsWorkspaceModalOpen(true)}>Change</Button>
            </div>
          </div>

          <Form layout="vertical" onFinish={handleSubmit(onSubmit)}>
            <Form.Item
              validateStatus={errors.email ? 'error' : ''}
              help={errors.email?.message}
            >
              <Controller
                name="email"
                control={control}
                rules={{
                  required: 'Email is required',
                  pattern: { value: /^\S+@\S+$/i, message: 'Invalid email address' }
                }}
                render={({ field }) => (
                  <Input
                    {...field}
                    prefix={<UserOutlined />}
                    placeholder="Email"
                    size="large"
                  />
                )}
              />
            </Form.Item>

            <Form.Item
              validateStatus={errors.password ? 'error' : ''}
              help={errors.password?.message}
            >
              <Controller
                name="password"
                control={control}
                rules={{
                  required: 'Password is required',
                  minLength: { value: 6, message: 'Minimum 6 characters' }
                }}
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    prefix={<LockOutlined />}
                    placeholder="Password"
                    size="large"
                  />
                )}
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                Sign In
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>

      <Modal
        title="Switch Workspace"
        open={isWorkspaceModalOpen}
        onCancel={() => setIsWorkspaceModalOpen(false)}
        onOk={handleWorkspaceChange}
      >
        <div style={{ marginBottom: '16px' }}>
          <Text type="secondary">Enter the workspace code (e.g., 'venpep', 'dev')</Text>
        </div>
        <Input
          value={newTenantCode}
          onChange={(e) => setNewTenantCode(e.target.value)}
          placeholder="Workspace Code"
          onPressEnter={handleWorkspaceChange}
        />
      </Modal>
    </div>
  );
};

export default LoginPage;
