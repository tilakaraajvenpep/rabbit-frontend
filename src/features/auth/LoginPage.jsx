import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Space, Modal, notification } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';
import { logger } from '../../utils/logger';
import { useThemeStore } from '../../store/themeStore';

const { Title, Text } = Typography;

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const navigate = useNavigate();
  const { login, tenantCode: currentTenantCode } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  const [newTenantCode, setNewTenantCode] = useState(currentTenantCode);
  
  const { control, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const onSubmit = async (data) => {
    setLoading(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (import.meta.env.VITE_USE_MOCK === 'true') {
      // (Mock logic if needed, but not used since USE_MOCK is false)
    } else {
      try {
        // Lowercase the email to support any casing
        const normalizedEmail = data.email.toLowerCase().trim();
        const response = await authService.login(normalizedEmail, data.password, currentTenantCode);
        
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
            case 'HR': navigate('/hr/team'); break;
            default: navigate('/');
          }
        } else {
          // Toast error message
          notification.error({
            message: 'Login Failed',
            description: response.message || 'Invalid credentials'
          });
        }
      } catch (err) {
        const serverMsg = err?.response?.data?.message || '';

        // Map specific backend messages to user-friendly toasts
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
      background: isDarkMode ? 'linear-gradient(135deg, #0f172a, #1e1b4b)' : 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
      width: '100vw',
      transition: 'all 0.3s ease'
    }}>
      <Card style={{ 
        width: 420, 
        textAlign: 'center', 
        borderRadius: 20, 
        background: isDarkMode ? '#1e293b' : '#ffffff',
        border: isDarkMode ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid #e2e8f0',
        boxShadow: isDarkMode ? '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2)' : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        padding: '12px 10px'
      }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={2} style={{ marginBottom: 4, color: isDarkMode ? '#ffffff' : '#0f172a' }}>Rabbit 4.0</Title>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 13 }}>
                {currentTenantCode.toUpperCase()} Workspace
              </Text>
              <Button type="link" size="small" onClick={() => setIsWorkspaceModalOpen(true)} style={{ color: '#6366f1', fontWeight: 600 }}>Change</Button>
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
                    prefix={<UserOutlined style={{ color: isDarkMode ? '#64748b' : '#bfbfbf' }} />} 
                    placeholder="Email" 
                    size="large" 
                    style={{
                      background: isDarkMode ? '#0f172a' : '#ffffff',
                      color: isDarkMode ? '#ffffff' : '#000000',
                      borderColor: isDarkMode ? '#334155' : '#d9d9d9',
                      borderRadius: 10,
                      height: 48
                    }}
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
                    prefix={<LockOutlined style={{ color: isDarkMode ? '#64748b' : '#bfbfbf' }} />} 
                    placeholder="Password" 
                    size="large" 
                    style={{
                      background: isDarkMode ? '#0f172a' : '#ffffff',
                      color: isDarkMode ? '#ffffff' : '#000000',
                      borderColor: isDarkMode ? '#334155' : '#d9d9d9',
                      borderRadius: 10,
                      height: 48
                    }}
                  />
                )}
              />
            </Form.Item>

            <Form.Item style={{ marginTop: 24 }}>
              <Button 
                type="primary" 
                htmlType="submit" 
                size="large" 
                block 
                loading={loading}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  border: 'none',
                  height: 48,
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 16,
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                }}
              >
                Sign In
              </Button>
            </Form.Item>
          </Form>

         
        </Space>
      </Card>

      <Modal
        title={<span style={{ color: isDarkMode ? '#ffffff' : '#0f172a' }}>Switch Workspace</span>}
        open={isWorkspaceModalOpen}
        onCancel={() => setIsWorkspaceModalOpen(false)}
        onOk={handleWorkspaceChange}
        styles={{
          content: {
            background: isDarkMode ? '#1e293b' : '#ffffff',
            color: isDarkMode ? '#ffffff' : '#000000',
            borderRadius: 16
          }
        }}
      >
        <div style={{ marginBottom: '16px', marginTop: '12px' }}>
          <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>Enter the workspace code (e.g., 'venpep', 'dev')</Text>
        </div>
        <Input 
          value={newTenantCode} 
          onChange={(e) => setNewTenantCode(e.target.value)} 
          placeholder="Workspace Code"
          onPressEnter={handleWorkspaceChange}
          style={{
            background: isDarkMode ? '#0f172a' : '#ffffff',
            color: isDarkMode ? '#ffffff' : '#000000',
            borderColor: isDarkMode ? '#334155' : '#d9d9d9',
            borderRadius: 8,
            height: 40
          }}
        />
      </Modal>
    </div>
  );
};

export default LoginPage;
