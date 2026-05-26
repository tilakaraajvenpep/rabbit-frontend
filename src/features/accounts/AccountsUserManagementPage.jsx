import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Switch, notification, Space, Typography, Tag, Skeleton, Popconfirm, InputNumber } from 'antd';
import { UserAddOutlined, SearchOutlined, DeleteOutlined } from '@ant-design/icons';
import { adminService } from '../../services/adminService';
import { projectService } from '../../services/projectService';
import PageHeader from '../../components/common/PageHeader';

const { Text } = Typography;

const AccountsUserManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, projectsRes] = await Promise.all([
        adminService.getUsers(),
        projectService.getProjects()
      ]);
      setUsers(usersRes.data || []);
      setProjects(projectsRes.data || []);
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load user management data.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = () => fetchData();

  const handleInvite = async (values) => {
    try {
      await adminService.inviteUser(values);
      notification.success({ 
        message: 'User Created', 
        description: `Successfully created user ${values.fullName} (${values.email}).` 
      });
      setIsModalOpen(false);
      form.resetFields();
      fetchUsers();
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to create user.' });
    }
  };

  const handleRoleChange = async (userId, role) => {
    try {
      await adminService.updateUserRole(userId, role);
      notification.success({ message: 'Role Updated' });
      fetchUsers();
    } catch (error) {
      notification.error({ message: 'Update Failed' });
    }
  };

  const handleTeamLeadChange = async (userId, teamLeadId) => {
    try {
      await adminService.updateUserTeamLead(userId, teamLeadId || null);
      notification.success({ message: 'Team Lead Updated' });
      fetchUsers();
    } catch (error) {
      notification.error({ message: 'Update Failed' });
    }
  };

  const handleStatusToggle = async (userId) => {
    try {
      await adminService.toggleUserStatus(userId);
      notification.success({ message: 'Status Updated' });
      fetchUsers();
    } catch (error) {
      notification.error({ message: 'Update Failed' });
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await adminService.deleteUser(userId);
      notification.success({ message: 'User Deleted successfully' });
      fetchUsers();
    } catch (error) {
      notification.error({ message: 'Delete Failed', description: 'Failed to delete user.' });
    }
  };

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  const columns = [
    {
      title: 'Full Name',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <Text strong>{text || '-'}</Text>
    },
    {
      title: 'Email Address',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role, record) => (
        <Select 
          value={role} 
          style={{ width: 140 }} 
          onChange={(newRole) => handleRoleChange(record.id, newRole)}
        >
          <Select.Option value="Sales">Sales</Select.Option>
          <Select.Option value="Accounts">Accounts</Select.Option>
          <Select.Option value="TeamLead">Team Lead</Select.Option>
          <Select.Option value="Employee">Employee</Select.Option>
          <Select.Option value="ProjectManager">PM</Select.Option>
          <Select.Option value="HR">HR</Select.Option>
        </Select>
      )
    },
    {
      title: 'Reporting TL',
      dataIndex: 'teamLeadId',
      key: 'teamLead',
      render: (tlId, record) => {
        if (record.role !== 'Employee') return <Text type="secondary">N/A (Non-Employee)</Text>;
        return (
          <Select
            value={tlId || undefined}
            placeholder="No Team Lead"
            style={{ width: 180 }}
            allowClear
            onChange={(newTlId) => handleTeamLeadChange(record.id, newTlId)}
          >
            {users.filter(u => u.role === 'TeamLead').map(tl => (
              <Select.Option key={tl.id} value={tl.id}>
                {tl.name}
              </Select.Option>
            ))}
          </Select>
        );
      }
    },
    {
      title: 'Cost/Hour',
      dataIndex: 'costPerHour',
      key: 'costPerHour',
      render: (val) => <Text>₹{Number(val || 0).toLocaleString('en-IN')}/hr</Text>
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      render: (isActive, record) => (
        <Switch 
          checked={isActive !== false} 
          onChange={() => handleStatusToggle(record.id)} 
          checkedChildren="Active" 
          unCheckedChildren="Inactive"
        />
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Popconfirm
          title="Delete User"
          description="Are you sure you want to delete this user? This will delete all dependencies."
          onConfirm={() => handleDeleteUser(record.id)}
          okText="Yes, Delete"
          cancelText="No"
          okButtonProps={{ danger: true }}
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      )
    }
  ];

  return (
    <div>
      <PageHeader 
        title="User Management (Accounts)"
        subtitle="Manage platform users, roles, cost rates and reporting relationships"
        extra={<Button type="primary" icon={<UserAddOutlined />} onClick={() => setIsModalOpen(true)}>Add User</Button>}
      />

      <div style={{ marginBottom: 16 }}>
        <Input 
          prefix={<SearchOutlined />} 
          placeholder="Search users by name, email or role..." 
          style={{ width: 300 }} 
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      <Table 
        dataSource={users.filter(user => {
          const term = searchText.toLowerCase();
          const name = (user.name || user.fullName || '').toLowerCase();
          const email = (user.email || '').toLowerCase();
          const role = (user.role || '').toLowerCase();
          return name.includes(term) || email.includes(term) || role.includes(term);
        })} 
        columns={columns} 
        rowKey="id" 
        pagination={{ pageSize: 10 }} 
      />

      <Modal
        title="Add New User"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        okText="Create User"
      >
        <Form form={form} layout="vertical" onFinish={handleInvite}>
          <Form.Item name="fullName" label="Full Name" rules={[{ required: true }]}>
            <Input placeholder="Enter full name" />
          </Form.Item>
          <Form.Item name="email" label="Email Address (Login ID)" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="Enter email address" />
          </Form.Item>
          <Form.Item name="password" label="Initial Password" rules={[{ required: true, min: 6 }]}>
            <Input.Password placeholder="Set initial password" />
          </Form.Item>
          <Form.Item name="role" label="Assigned Role" rules={[{ required: true }]}>
            <Select placeholder="Select a role">
              <Select.Option value="Sales">Sales</Select.Option>
              <Select.Option value="Accounts">Accounts</Select.Option>
              <Select.Option value="TeamLead">Team Lead</Select.Option>
              <Select.Option value="Employee">Employee</Select.Option>
              <Select.Option value="ProjectManager">PM</Select.Option>
              <Select.Option value="HR">HR</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="costPerHour" label="Cost Per Hour (₹)">
            <InputNumber style={{ width: '100%' }} min={0} placeholder="Enter hourly cost rate (e.g. 500)" />
          </Form.Item>

          <Form.Item name="teamLeadId" label="Reporting Team Lead">
            <Select placeholder="Select Team Lead" allowClear>
              {users.filter(u => u.role === 'TeamLead').map(tl => (
                <Select.Option key={tl.id} value={tl.id}>
                  {tl.name} ({tl.email})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="projectId" label="Assign to Project (Optional)">
            <Select placeholder="Select a project" allowClear>
              {projects.map(p => (
                <Select.Option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AccountsUserManagementPage;
