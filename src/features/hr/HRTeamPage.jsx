import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Avatar, Badge, Spin, Typography, Space, DatePicker, notification, Input, Statistic, Button, Form, Modal, Select, InputNumber } from 'antd';
import { UserOutlined, TeamOutlined, MailOutlined, CalendarOutlined, SearchOutlined, UserAddOutlined } from '@ant-design/icons';
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

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchText.toLowerCase()) ||
    u.fullName?.toLowerCase().includes(searchText.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: 'Employee Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <Avatar src={record.avatar} icon={<UserOutlined />} style={{ backgroundColor: record.role === 'TeamLead' ? '#87d068' : record.role === 'ProjectManager' ? '#faad14' : '#108ee9' }} />
          <div>
            <Text strong>{text || record.fullName}</Text>
            <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
              <Badge 
                status={record.role === 'TeamLead' ? 'success' : record.role === 'ProjectManager' ? 'warning' : 'processing'} 
                text={record.role === 'TeamLead' ? 'Team Lead' : record.role === 'ProjectManager' ? 'Project Manager' : record.role} 
              />
            </div>
          </div>
        </Space>
      )
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (text) => (
        <Space>
          <MailOutlined style={{ color: '#8c8c8c' }} />
          <Text>{text}</Text>
        </Space>
      )
    },
    {
      title: 'Date of Joining',
      dataIndex: 'dateOfJoining',
      key: 'dateOfJoining',
      render: (dateOfJoining, record) => (
        <DatePicker
          placeholder="Select Join Date"
          style={{ width: 180 }}
          value={dateOfJoining ? dayjs(dateOfJoining) : null}
          onChange={(date, dateString) => handleDateChange(record.id, date, dateString)}
          format="YYYY-MM-DD"
        />
      )
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) => (
        <Badge status={isActive !== false ? 'success' : 'error'} text={isActive !== false ? 'Active' : 'Inactive'} />
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
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader 
        title="Team Directory" 
        subTitle="Manage team profiles, view reporting structure, and configure join dates."
        extra={<Button type="primary" icon={<UserAddOutlined />} onClick={() => setIsModalOpen(true)}>Add User</Button>}
      />

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
              <Statistic 
                title="Team Leads" 
                value={totalTL} 
                prefix={<TeamOutlined style={{ color: '#52c41a' }} />} 
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
              <Statistic 
                title="Employees" 
                value={totalEmp} 
                prefix={<UserOutlined style={{ color: '#1890ff' }} />} 
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
              <Statistic 
                title="Project Managers" 
                value={totalPM} 
                prefix={<UserAddOutlined style={{ color: '#faad14' }} />} 
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
              <Statistic 
                title="Pending DOJ" 
                value={missingDOJ} 
                prefix={<CalendarOutlined style={{ color: '#faad14' }} />} 
                valueStyle={{ color: missingDOJ > 0 ? '#cf1322' : '#3f8600' }}
              />
            </Card>
          </Col>
        </Row>

        <Card 
          style={{ 
            borderRadius: 12,
            boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(0,0,0,0.05)',
            border: isDarkMode ? '1px solid #3f3f46' : '1px solid #e8e8e8'
          }}
        >
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Input
              placeholder="Search by name or email..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 300, borderRadius: 8 }}
            />
          </div>

          <Table
            dataSource={filteredUsers}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: 'No matching team members found.' }}
          />
        </Card>
      </Space>

      <Modal
        title="Add New User"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        okText="Create User"
      >
        <Form form={form} layout="vertical" onFinish={handleInvite}>
          <Form.Item name="fullName" label="Full Name" rules={[{ required: true, message: 'Please enter a name' }]}>
            <Input placeholder="Enter full name" />
          </Form.Item>
          <Form.Item name="email" label="Email Address (Login ID)" rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}>
            <Input placeholder="Enter email address" />
          </Form.Item>
          <Form.Item name="password" label="Initial Password" rules={[{ required: true, min: 6, message: 'Password must be at least 6 characters' }]}>
            <Input.Password placeholder="Set initial password" />
          </Form.Item>
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

          <Form.Item name="costPerHour" label="Cost Per Hour (₹)">
            <InputNumber style={{ width: '100%' }} min={0} placeholder="Enter hourly cost rate (e.g. 500)" />
          </Form.Item>

          <Form.Item name="teamLeadId" label="Reporting Team Lead">
            <Select placeholder="Select Team Lead" allowClear>
              {users.filter(u => u.role === 'TeamLead').map(tl => (
                <Select.Option key={tl.id} value={tl.id}>
                  {tl.name || tl.fullName} ({tl.email})
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
