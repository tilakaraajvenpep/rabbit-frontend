import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Switch, notification, Space, Typography, Tag, Skeleton } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { superAdminService } from '../../services/superAdminService';
import PageHeader from '../../components/common/PageHeader';

const { Text } = Typography;

const TenantListPage = () => {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchTenants();
  }, []);

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
      title: 'Users',
      dataIndex: 'users',
      key: 'users'
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
      render: (date) => new Date(date).toLocaleDateString()
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
