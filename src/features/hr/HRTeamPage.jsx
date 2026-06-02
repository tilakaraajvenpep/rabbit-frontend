import React, { useState, useEffect } from 'react';
import { 
  Card, Row, Col, Table, Avatar, Badge, Spin, Typography, Space, 
  DatePicker, notification, Input, Statistic, Button, Form, Modal, 
  Select, InputNumber, Switch, Tooltip, Popconfirm
} from 'antd';
import { 
  UserOutlined, TeamOutlined, MailOutlined, CalendarOutlined, 
  SearchOutlined, UserAddOutlined, DeleteOutlined, KeyOutlined, 
  DollarOutlined, CheckCircleOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import { adminService } from '../../services/adminService';
import { projectService } from '../../services/projectService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const HRTeamPage = () => {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [roleFilter, setRoleFilter] = useState('all'); // 'all', 'Employee', 'TeamLead', 'ProjectManager', etc.
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const { isDarkMode } = useThemeStore();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [usersRes, projectsRes] = await Promise.all([
        adminService.getUsers(),
        projectService.getProjects()
      ]);
      // Keep all roles for HR directory view except SuperAdmin
      const filtered = (usersRes.data || []).filter(u => u.role !== 'SuperAdmin');
      setUsers(filtered);
      setProjects(projectsRes.data || []);
    } catch (error) {
      notification.error({
        message: 'Error',
        description: 'Failed to load team and employee details.'
      });
    } finally {
      setLoading(false);
    }
  };

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
      notification.error({ message: 'Error', description: error.response?.data?.message || 'Failed to create user.' });
    }
  };

  const handleDateChange = async (userId, date, dateString) => {
    try {
      await adminService.updateDateOfJoining(userId, dateString || null);
      notification.success({
        message: 'Success',
        description: 'Date of Joining updated successfully.'
      });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, dateOfJoining: dateString || null } : u));
    } catch (error) {
      notification.error({
        message: 'Error',
        description: 'Failed to update Date of Joining.'
      });
    }
  };

  const handleTeamLeadChange = async (userId, teamLeadId) => {
    try {
      await adminService.updateUserTeamLead(userId, teamLeadId || null);
      notification.success({
        message: 'Success',
        description: 'Reporting Team Lead updated successfully.'
      });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, teamLeadId: teamLeadId || null } : u));
    } catch (error) {
      notification.error({
        message: 'Error',
        description: 'Failed to update Reporting Team Lead.'
      });
    }
  };

  const handleProjectManagerChange = async (userId, projectManagerId) => {
    try {
      await adminService.updateUserProjectManager(userId, projectManagerId || null);
      notification.success({
        message: 'Success',
        description: 'Reporting Project Manager updated successfully.'
      });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, projectManagerId: projectManagerId || null } : u));
    } catch (error) {
      notification.error({
        message: 'Error',
        description: 'Failed to update Project Manager.'
      });
    }
  };

  const handleDeleteUser = (record) => {
    Modal.confirm({
      title: 'Delete User',
      content: `Are you sure you want to delete ${record.name || record.fullName}? This action cannot be undone.`,
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
          await adminService.deleteUser(record.id);
          notification.success({
            message: 'Success',
            description: 'User deleted successfully.'
          });
          fetchUsers();
        } catch (error) {
          notification.error({
            message: 'Error',
            description: error.response?.data?.message || 'Failed to delete user.'
          });
        }
      }
    });
  };

  const handleToggleStatus = async (userId, currentIsActive) => {
    try {
      await adminService.toggleUserStatus(userId);
      notification.success({
        message: 'Success',
        description: `User status changed to ${currentIsActive !== false ? 'Inactive' : 'Active'}.`
      });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: currentIsActive === false } : u));
    } catch (error) {
      notification.error({
        message: 'Error',
        description: 'Failed to toggle user status.'
      });
    }
  };

  const filteredUsers = users.filter(u => {
    const nameStr = (u.name || u.fullName || '').toLowerCase();
    const emailStr = (u.email || '').toLowerCase();
    const query = searchText.toLowerCase();
    const matchesSearch = nameStr.includes(query) || emailStr.includes(query);
    const matchesStatus = statusFilter === 'all' || 
                          (statusFilter === 'active' && u.isActive !== false) ||
                          (statusFilter === 'inactive' && u.isActive === false);
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  const columns = [
    {
      title: 'Employee Name',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (text, record) => {
        let avatarBg = '#108ee9';
        if (record.role === 'TeamLead') avatarBg = '#87d068';
        if (record.role === 'ProjectManager') avatarBg = '#faad14';
        if (record.role === 'HR') avatarBg = '#eb2f96';

        return (
          <Space size="middle" style={{ whiteSpace: 'nowrap' }}>
            <Avatar src={record.avatar} icon={<UserOutlined />} style={{ backgroundColor: avatarBg, border: '2px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
            <div>
              <Text strong style={{ fontSize: '14px', display: 'block' }}>{text || record.fullName}</Text>
              <Badge 
                status={record.role === 'TeamLead' ? 'success' : record.role === 'ProjectManager' ? 'warning' : 'processing'} 
                text={record.role === 'TeamLead' ? 'Team Lead' : record.role === 'ProjectManager' ? 'Project Manager' : record.role} 
                style={{ fontSize: '11px', marginTop: 2 }}
              />
            </div>
          </Space>
        );
      }
    },
    {
      title: 'Email Address',
      dataIndex: 'email',
      key: 'email',
      width: 240,
      render: (text) => (
        <div style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
          <MailOutlined style={{ color: '#8c8c8c' }} />
          <Text style={{ fontSize: '13px' }}>{text}</Text>
        </div>
      )
    },
    {
      title: 'Date of Joining',
      dataIndex: 'dateOfJoining',
      key: 'dateOfJoining',
      width: 180,
      render: (dateOfJoining, record) => (
        <DatePicker
          placeholder="Select Join Date"
          style={{ width: '100%', borderRadius: 6 }}
          value={dateOfJoining ? dayjs(dateOfJoining) : null}
          onChange={(date, dateString) => handleDateChange(record.id, date, dateString)}
          format="YYYY-MM-DD"
        />
      )
    },
    {
      title: 'Reporting Team Lead',
      dataIndex: 'teamLeadId',
      key: 'teamLeadId',
      width: 200,
      render: (teamLeadId, record) => {
        if (record.role !== 'Employee') {
          return <span style={{ color: '#8c8c8c', fontStyle: 'italic', fontSize: '12px' }}>N/A (Non-Employee)</span>;
        }
        const teamLeads = users.filter(u => u.role === 'TeamLead' && String(u.id) !== String(record.id));
        return (
          <Select
            placeholder="Select Team Lead"
            style={{ width: '100%' }}
            dropdownStyle={{ minWidth: 200 }}
            value={teamLeadId || undefined}
            onChange={(val) => handleTeamLeadChange(record.id, val)}
            allowClear
          >
            {teamLeads.map(tl => (
              <Select.Option key={tl.id} value={tl.id}>
                {tl.name || tl.fullName}
              </Select.Option>
            ))}
          </Select>
        );
      }
    },
    {
      title: 'Project Manager',
      dataIndex: 'projectManagerId',
      key: 'projectManagerId',
      width: 200,
      render: (projectManagerId, record) => {
        if (record.role !== 'Employee' && record.role !== 'TeamLead') {
          return <span style={{ color: '#8c8c8c', fontStyle: 'italic', fontSize: '12px' }}>N/A (Management)</span>;
        }
        const pms = users.filter(u => (u.role === 'ProjectManager' || u.role === 'TenantAdmin') && String(u.id) !== String(record.id));
        return (
          <Select
            placeholder="Select PM"
            style={{ width: '100%' }}
            dropdownStyle={{ minWidth: 200 }}
            value={projectManagerId || undefined}
            onChange={(val) => handleProjectManagerChange(record.id, val)}
            allowClear
          >
            {pms.map(pm => (
              <Select.Option key={pm.id} value={pm.id}>
                {pm.name || pm.fullName}
              </Select.Option>
            ))}
          </Select>
        );
      }
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 130,
      render: (isActive, record) => (
        <Switch
          checked={isActive !== false}
          onChange={() => handleToggleStatus(record.id, isActive)}
          checkedChildren="Active"
          unCheckedChildren="Inactive"
        />
      )
    }
  ];

  const totalTL = users.filter(u => u.role === 'TeamLead').length;
  const totalEmp = users.filter(u => u.role === 'Employee').length;
  const totalPM = users.filter(u => u.role === 'ProjectManager').length;
  const missingDOJ = users.filter(u => !u.dateOfJoining).length;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" tip="Loading team directory..." />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader 
        title="Team Directory" 
        subTitle="Manage team profiles, view reporting structure, and configure join dates."
        extra={
          <Button 
            type="primary" 
            icon={<UserAddOutlined />} 
            onClick={() => setIsModalOpen(true)}
            size="large"
            style={{ borderRadius: 8, boxShadow: '0 4px 6px rgba(24, 144, 255, 0.2)' }}
          >
            Add User
          </Button>
        }
      />

      {/* Stats Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card 
            hoverable
            style={{ 
              borderRadius: 16, 
              border: isDarkMode ? '1px solid #3f3f46' : '1px solid #e5e7eb',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
              background: isDarkMode ? '#1f2937' : '#ffffff'
            }}
          >
            <Statistic 
              title={<span style={{ fontWeight: 600, fontSize: '14px', color: '#8c8c8c' }}>Team Leads</span>}
              value={totalTL} 
              prefix={<TeamOutlined style={{ color: '#52c41a', marginRight: 8 }} />} 
              valueStyle={{ fontWeight: 700, fontSize: '24px' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card 
            hoverable
            style={{ 
              borderRadius: 16, 
              border: isDarkMode ? '1px solid #3f3f46' : '1px solid #e5e7eb',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
              background: isDarkMode ? '#1f2937' : '#ffffff'
            }}
          >
            <Statistic 
              title={<span style={{ fontWeight: 600, fontSize: '14px', color: '#8c8c8c' }}>Employees</span>}
              value={totalEmp} 
              prefix={<UserOutlined style={{ color: '#1890ff', marginRight: 8 }} />} 
              valueStyle={{ fontWeight: 700, fontSize: '24px' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card 
            hoverable
            style={{ 
              borderRadius: 16, 
              border: isDarkMode ? '1px solid #3f3f46' : '1px solid #e5e7eb',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
              background: isDarkMode ? '#1f2937' : '#ffffff'
            }}
          >
            <Statistic 
              title={<span style={{ fontWeight: 600, fontSize: '14px', color: '#8c8c8c' }}>Project Managers</span>}
              value={totalPM} 
              prefix={<UserAddOutlined style={{ color: '#faad14', marginRight: 8 }} />} 
              valueStyle={{ fontWeight: 700, fontSize: '24px' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card 
            hoverable
            style={{ 
              borderRadius: 16, 
              border: isDarkMode ? '1px solid #3f3f46' : '1px solid #e5e7eb',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
              background: isDarkMode ? '#1f2937' : '#ffffff'
            }}
          >
            <Statistic 
              title={<span style={{ fontWeight: 600, fontSize: '14px', color: '#8c8c8c' }}>Pending DOJ</span>}
              value={missingDOJ} 
              prefix={<CalendarOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />} 
              valueStyle={{ fontWeight: 700, fontSize: '24px', color: missingDOJ > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Toolbar & Filters Card */}
      <Card 
        style={{ 
          borderRadius: 16,
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
          border: isDarkMode ? '1px solid #3f3f46' : '1px solid #e8e8e8',
          background: isDarkMode ? '#1f2937' : '#ffffff'
        }}
      >
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col xs={24} md={6}>
            <Title level={4} style={{ margin: 0, fontWeight: 700, fontSize: '18px' }}>
              Directory List ({filteredUsers.length} members)
            </Title>
          </Col>
          <Col xs={24} md={18}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Select 
                value={roleFilter} 
                onChange={setRoleFilter} 
                style={{ width: 160 }}
                options={[
                  { label: 'All Roles', value: 'all' },
                  { label: 'Employee', value: 'Employee' },
                  { label: 'Team Lead', value: 'TeamLead' },
                  { label: 'Project Manager', value: 'ProjectManager' },
                  { label: 'Accounts', value: 'Accounts' },
                  { label: 'Sales', value: 'Sales' },
                  { label: 'HR', value: 'HR' },
                ]}
              />
              <Select 
                value={statusFilter} 
                onChange={setStatusFilter} 
                style={{ width: 140 }}
                options={[
                  { label: 'All Statuses', value: 'all' },
                  { label: 'Active', value: 'active' },
                  { label: 'Inactive', value: 'inactive' },
                ]}
              />
              <Input
                placeholder="Search by name or email..."
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                style={{ width: 280, borderRadius: 8 }}
                allowClear
              />
            </div>
          </Col>
        </Row>

        <div style={{ marginTop: 20 }}>
          <Table
            dataSource={filteredUsers}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 10, showSizeChanger: true }}
            scroll={{ x: 'max-content' }}
            bordered
            locale={{ emptyText: 'No matching team members found.' }}
          />
        </div>
      </Card>

      {/* Add User Modal */}
      <Modal
        title={
          <div style={{ paddingBottom: 12, borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserAddOutlined style={{ color: '#1890ff', fontSize: '20px' }} />
            <span style={{ fontSize: '18px', fontWeight: 700 }}>Add New User</span>
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        okText="Create User"
        width={520}
        style={{ top: 60 }}
        bodyStyle={{ paddingTop: 16 }}
      >
        <Form form={form} layout="vertical" onFinish={handleInvite}>
          <Form.Item name="fullName" label="Full Name" rules={[{ required: true, message: 'Please enter a name' }]}>
            <Input placeholder="Enter full name" prefix={<UserOutlined style={{ color: '#bfbfbf' }} />} style={{ borderRadius: 6 }} />
          </Form.Item>
          
          <Form.Item name="email" label="Email Address (Login ID)" rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}>
            <Input placeholder="Enter email address" prefix={<MailOutlined style={{ color: '#bfbfbf' }} />} style={{ borderRadius: 6 }} />
          </Form.Item>
          
          <Form.Item name="password" label="Initial Password" rules={[{ required: true, min: 6, message: 'Password must be at least 6 characters' }]}>
            <Input.Password placeholder="Set initial password" prefix={<KeyOutlined style={{ color: '#bfbfbf' }} />} style={{ borderRadius: 6 }} />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="role" label="Assigned Role" rules={[{ required: true, message: 'Please select a role' }]}>
                <Select placeholder="Select a role">
                  <Select.Option value="Sales">Sales</Select.Option>
                  <Select.Option value="Accounts">Accounts</Select.Option>
                  <Select.Option value="TeamLead">Team Lead</Select.Option>
                  <Select.Option value="Employee">Employee</Select.Option>
                  <Select.Option value="ProjectManager">PM</Select.Option>
                  <Select.Option value="HR">HR</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="costPerHour" label="Cost Per Hour (₹)">
                <InputNumber 
                  style={{ width: '100%', borderRadius: 6 }} 
                  min={0} 
                  placeholder="e.g. 500" 
                  prefix={<DollarOutlined style={{ color: '#bfbfbf' }} />}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="teamLeadId" label="Reporting Team Lead">
            <Select placeholder="Select Team Lead" allowClear>
              {users.filter(u => u.role === 'TeamLead').map(tl => (
                <Select.Option key={tl.id} value={tl.id}>
                  {tl.name || tl.fullName} ({tl.email})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="projectManagerId" label="Reporting Project Manager">
            <Select placeholder="Select PM" allowClear>
              {users.filter(u => u.role === 'ProjectManager' || u.role === 'TenantAdmin').map(pm => (
                <Select.Option key={pm.id} value={pm.id}>
                  {pm.name || pm.fullName} ({pm.email})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="projectId" label="Assign to Project (Optional)">
            <Select placeholder="Select a project" allowClear>
              {projects.map(p => (
                <Select.Option key={p.id} value={p.id}>
                  {p.projectCode || p.code} - {p.projectName || p.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default HRTeamPage;
