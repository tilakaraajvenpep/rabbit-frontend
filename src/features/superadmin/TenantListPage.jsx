import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Switch, notification, Space, Typography, Tag, Skeleton, Popconfirm } from 'antd';
import { PlusOutlined, SearchOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { superAdminService } from '../../services/superAdminService';
import PageHeader from '../../components/common/PageHeader';
import { useAuthStore } from '../../store/authStore';

const { Text } = Typography;

const TenantListPage = () => {
  const navigate = useNavigate();
  const { token, isAuthenticated } = useAuthStore();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!token || !isAuthenticated) return;
    fetchTenants();
  }, [token, isAuthenticated]);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await superAdminService.getTenants();
      setTenants(res.data);
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load tenants.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values) => {
    try {
      await superAdminService.createTenant(values);
      notification.success({ message: 'Success', description: 'Tenant created successfully.' });
      setIsModalOpen(false);
      form.resetFields();
      fetchTenants();
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to create tenant.' });
    }
  };

  const handleStatusToggle = async (id, currentStatus) => {
    try {
      await superAdminService.toggleTenantStatus(id, currentStatus);
      notification.success({ message: 'Status Updated' });
      fetchTenants();
    } catch (error) {
      notification.error({ message: 'Update Failed' });
    }
  };

  const handleNotificationToggle = async (id, field, value) => {
    try {
      await superAdminService.updateTenant(id, { [field]: value });
      const label = field === 'isEmailNotificationEnabled' ? 'Email Notifications' : 'In-App Notifications';
      notification.success({ 
        message: `${label} Updated`,
        description: `${label} are now ${value ? 'ENABLED' : 'DISABLED'} for this tenant.` 
      });
      fetchTenants();
    } catch (error) {
      notification.error({ message: 'Update Failed', description: 'Failed to update notification settings.' });
    }
  };

  const handleDelete = async (id) => {
    try {
      await superAdminService.deleteTenant(id);
      notification.success({ message: 'Success', description: 'Tenant deleted successfully.' });
      fetchTenants();
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to delete tenant.' });
    }
  };

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  const columns = [
    {
      title: 'Tenant Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Button type="link" onClick={() => navigate(`/superadmin/tenants/${record.id}`)} style={{ padding: 0 }}>
          <Text strong>{text}</Text>
        </Button>
      )
    },
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (text) => <code>{text}</code>
    },
    {
      title: 'Plan',
      dataIndex: 'plan',
      key: 'plan',
      render: (plan) => <Tag color="blue">{plan}</Tag>
    },
    {
      title: 'Email Notifs',
      key: 'isEmailNotificationEnabled',
      render: (_, record) => (
        <Space>
          <Switch 
            size="small" 
            checked={record.isEmailNotificationEnabled !== false} 
            onChange={(checked) => handleNotificationToggle(record.id, 'isEmailNotificationEnabled', checked)} 
          />
          <Tag color={record.isEmailNotificationEnabled !== false ? 'green' : 'red'}>
            {record.isEmailNotificationEnabled !== false ? 'Enabled' : 'Disabled'}
          </Tag>
        </Space>
      )
    },
    {
      title: 'In-App Notifs',
      key: 'isInAppNotificationEnabled',
      render: (_, record) => (
        <Space>
          <Switch 
            size="small" 
            checked={record.isInAppNotificationEnabled !== false} 
            onChange={(checked) => handleNotificationToggle(record.id, 'isInAppNotificationEnabled', checked)} 
          />
          <Tag color={record.isInAppNotificationEnabled !== false ? 'green' : 'red'}>
            {record.isInAppNotificationEnabled !== false ? 'Enabled' : 'Disabled'}
          </Tag>
        </Space>
      )
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => (
        <Space>
          <Switch 
            size="small" 
            checked={record.status === 'Active'} 
            onChange={() => handleStatusToggle(record.id, record.status)} 
          />
          <Tag color={record.status === 'Active' ? 'green' : 'red'}>{record.status}</Tag>
        </Space>
      )
    },
    {
      title: 'Created',
      dataIndex: 'created',
      key: 'created',
      render: (date) => (date ? new Date(date).toLocaleDateString() : 'N/A')
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Popconfirm
          title="Delete Tenant"
          description="Are you sure you want to delete this tenant?"
          onConfirm={() => handleDelete(record.id)}
          okText="Yes, Delete"
          cancelText="No"
          okButtonProps={{ danger: true }}
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            Delete
          </Button>
        </Popconfirm>
      )
    }
  ];

  return (
    <div>
      <PageHeader 
        title="All Tenants" 
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>Create Tenant</Button>}
      />

      <div style={{ marginBottom: 16 }}>
        <Input prefix={<SearchOutlined />} placeholder="Search tenants..." style={{ width: 300 }} />
      </div>

      <Table dataSource={tenants} columns={columns} rowKey="id" />

      <Modal
        title="Create New Tenant"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="Tenant Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Acme Corp" />
          </Form.Item>
          <Form.Item name="code" label="Tenant Code (Subdomain)" rules={[{ required: true }]}>
            <Input placeholder="e.g. acme" />
          </Form.Item>
          <Form.Item name="plan" label="Subscription Plan" rules={[{ required: true }]}>
            <Select placeholder="Select a plan">
              <Select.Option value="Starter">Starter</Select.Option>
              <Select.Option value="Pro">Pro</Select.Option>
              <Select.Option value="Enterprise">Enterprise</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TenantListPage;
