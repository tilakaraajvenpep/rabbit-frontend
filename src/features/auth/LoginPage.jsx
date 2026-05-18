import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space, ConfigProvider, theme, Modal, notification } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';
import { logger } from '../../utils/logger';

const { Title, Text } = Typography;

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
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
    setError(null);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (import.meta.env.VITE_USE_MOCK === 'true') {
      // (Keep mock logic just in case, but usually we'll use the real API now)
    } else {
      try {
        const response = await authService.login(data.email, data.password, currentTenantCode);
        
        if (response.success) {
          const { user, accessToken, refreshToken } = response.data;
          login(user, accessToken, refreshToken);
          logger.info('Login successful', user);
          
          // Redirect based on role
          switch (user.role) {
            case 'SuperAdmin': navigate('/superadmin/tenants'); break;
            case 'TenantAdmin': navigate('/admin/users'); break;
            case 'Sales': navigate('/sales/projects'); break;
            case 'Accounts': navigate('/accounts/pending'); break;
            case 'TeamLead': navigate('/teamlead/projects'); break;
            case 'Employee': navigate('/employee/tickets'); break;
            case 'ProjectManager': navigate('/pm/dashboard'); break;
            default: navigate('/');
          }
        } else {
          setError(response.message || 'Login failed');
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Connection error. Is the backend running?');
      }
    }
    
    setLoading(false);
  };

  const handleWorkspaceChange = () => {
    useAuthStore.setState({ tenantCode: newTenantCode.toLowerCase() });
    setIsWorkspaceModalOpen(false);
    notification.success({ message: 'Workspace Updated', description: `Switched to ${newTenantCode.toUpperCase()}` });
  };

  return (
    <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
      <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: '#f0f2f5' 
    }}>
      <Card style={{ width: 400, textAlign: 'center', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={2} style={{ marginBottom: 0 }}>Rabbit 4.0</Title>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Text type="secondary">{currentTenantCode.toUpperCase()} Workspace</Text>
              <Button type="link" size="small" onClick={() => setIsWorkspaceModalOpen(true)}>Change</Button>
            </div>
          </div>

          {error && <Alert message={error} type="error" showIcon />}

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

          <Text type="secondary" style={{ fontSize: '12px' }}>
            Multi-tenant Project Management & Automation
          </Text>
        </Space>
      </Card>
      </div>
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
        />
      </Modal>
    </ConfigProvider>
  );
};

export default LoginPage;
