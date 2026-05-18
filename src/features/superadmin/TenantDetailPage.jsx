import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Form, Input, Select, Switch, Button, Typography, Skeleton, notification, Table, Tag, Divider, Progress, Result, Tabs, Modal } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, UserAddOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { superAdminService } from '../../services/superAdminService';
import PageHeader from '../../components/common/PageHeader';

const { Title, Text } = Typography;

const TenantDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [userForm] = Form.useForm();

  useEffect(() => {
    fetchTenant();
    fetchUsers();
  }, [id]);

  const fetchTenant = async () => {
    setLoading(true);
    try {
      const res = await superAdminService.getTenantById(id);
      setTenant(res.data);
      form.setFieldsValue(res.data);
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load tenant details.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await superAdminService.getTenantUsers(id);
      setUsers(res.data);
    } catch (error) {
      console.error('Failed to load users', error);
    }
  };

  const handleSave = async (values) => {
    setUpdating(true);
    try {
      await superAdminService.createTenant(values);
      notification.success({ message: 'Success', description: 'Tenant updated successfully.' });
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to update tenant.' });
    } finally {
      setUpdating(false);
    }
  };

  const handleCreateUser = async (values) => {
    try {
      await superAdminService.createTenantUser(id, values);
      notification.success({ message: 'User Created', description: 'The user has been added to this tenant.' });
      setIsUserModalOpen(false);
      userForm.resetFields();
      fetchUsers();
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to create user.' });
    }
  };

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  if (!tenant) {
    return (
      <Result
        status="404"
        title="Tenant Not Found"
        subTitle="The tenant you are looking for does not exist or has been deleted."
        extra={<Button type="primary" onClick={() => navigate('/superadmin/tenants')}>Back to List</Button>}
      />
    );
  }

  const items = [
    {
      key: '1',
      label: 'Configuration',
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Card title="Edit Tenant Information">
              <Form form={form} layout="vertical" onFinish={handleSave}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="name" label="Tenant Name" required>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="code" label="Tenant Code" required>
                      <Input disabled />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="plan" label="Subscription Plan" required>
                      <Select>
                        <Select.Option value="Starter">Starter</Select.Option>
                        <Select.Option value="Pro">Pro</Select.Option>
                        <Select.Option value="Enterprise">Enterprise</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="isActive" label="Account Status" valuePropName="checked">
                      <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="customDomain" label="Custom Domain">
                      <Input placeholder="e.g. rabbit.acme.com" />
                    </Form.Item>
                  </Col>
                </Row>
                <Button type="primary" htmlType="submit" loading={updating} icon={<SaveOutlined />}>
                  Save Changes
                </Button>
              </Form>
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Card title="Usage Statistics">
              <div style={{ marginBottom: 20 }}>
                <Text type="secondary">Users</Text>
                <Progress percent={75} status="active" />
                <Text type="secondary" style={{ fontSize: '12px' }}>150 / 200 users</Text>
              </div>
              <div style={{ marginBottom: 20 }}>
                <Text type="secondary">Projects</Text>
                <Progress percent={45} status="active" />
                <Text type="secondary" style={{ fontSize: '12px' }}>45 / 100 projects</Text>
              </div>
              <div style={{ marginBottom: 20 }}>
                <Text type="secondary">Storage</Text>
                <Progress percent={30} status="active" />
                <Text type="secondary" style={{ fontSize: '12px' }}>300 GB / 1 TB</Text>
              </div>
            </Card>
          </Col>
        </Row>
      )
    },
    {
      key: '2',
      label: 'Users',
      children: (
        <Card 
          title="Tenant Users" 
          extra={<Button type="primary" icon={<UserAddOutlined />} onClick={() => setIsUserModalOpen(true)}>Add User</Button>}
        >
          <Table 
            dataSource={users} 
            columns={[
              { title: 'Full Name', dataIndex: 'name', key: 'name' },
              { title: 'Email', dataIndex: 'email', key: 'email' },
              { title: 'Role', dataIndex: 'role', key: 'role', render: r => <Tag color="blue">{r}</Tag> },
              { title: 'Status', dataIndex: 'isActive', key: 'isActive', render: active => <Tag color={active ? 'green' : 'red'}>{active ? 'Active' : 'Inactive'}</Tag> }
            ]} 
            rowKey="id" 
          />
        </Card>
      )
    },
    {
      key: '3',
      label: 'Activity Log',
      children: (
        <Card title="Recent Activity">
          <Table 
            size="small"
            pagination={false}
            dataSource={[
              { key: '1', action: 'Plan Upgraded', user: 'Admin', date: '2024-04-10' },
              { key: '2', action: 'New User Invited', user: 'Tenant Admin', date: '2024-04-12' },
              { key: '3', action: 'Domain Verified', user: 'System', date: '2024-04-15' }
            ]}
            columns={[
              { title: 'Action', dataIndex: 'action', key: 'action' },
              { title: 'User', dataIndex: 'user', key: 'user' },
              { title: 'Date', dataIndex: 'date', key: 'date', render: d => new Date(d).toLocaleDateString() }
            ]}
          />
        </Card>
      )
    }
  ];

  return (
    <div>
      <PageHeader 
        title={`Tenant: ${tenant?.name || 'Loading...'}`} 
        extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Back</Button>}
      />

      <Tabs defaultActiveKey="1" items={items} />

      <Modal
        title="Create User for Tenant"
        open={isUserModalOpen}
        onCancel={() => setIsUserModalOpen(false)}
        onOk={() => userForm.submit()}
      >
        <Form form={userForm} layout="vertical" onFinish={handleCreateUser}>
          <Form.Item name="fullName" label="Full Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Initial Password" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="TenantAdmin">Tenant Admin</Select.Option>
              <Select.Option value="Sales">Sales</Select.Option>
              <Select.Option value="Accounts">Accounts</Select.Option>
              <Select.Option value="ProjectManager">Project Manager</Select.Option>
              <Select.Option value="TeamLead">Team Lead</Select.Option>
              <Select.Option value="Employee">Employee</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TenantDetailPage;
