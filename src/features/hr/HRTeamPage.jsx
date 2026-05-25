import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Avatar, Badge, Spin, Typography, Space, DatePicker, notification, Input, Statistic } from 'antd';
import { UserOutlined, TeamOutlined, MailOutlined, CalendarOutlined, SearchOutlined } from '@ant-design/icons';
import { adminService } from '../../services/adminService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const HRTeamPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const { isDarkMode } = useThemeStore();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await adminService.getUsers();
      // Only keep Team Leads and Employees
      const filtered = (res.data || []).filter(u => u.role === 'TeamLead' || u.role === 'Employee');
      setUsers(filtered);
    } catch (error) {
      notification.error({
        message: 'Error',
        description: 'Failed to load team and employee details.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = async (userId, date, dateString) => {
    try {
      await adminService.updateDateOfJoining(userId, dateString || null);
      notification.success({
        message: 'Success',
        description: 'Date of Joining updated successfully.'
      });
      // Update local state to prevent a full reload spin
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
          <Avatar src={record.avatar} icon={<UserOutlined />} style={{ backgroundColor: record.role === 'TeamLead' ? '#87d068' : '#108ee9' }} />
          <div>
            <Text strong>{text || record.fullName}</Text>
            <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
              <Badge status={record.role === 'TeamLead' ? 'success' : 'processing'} text={record.role === 'TeamLead' ? 'Team Lead' : 'Employee'} />
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
      />

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
              <Statistic 
                title="Total Team Leads" 
                value={totalTL} 
                prefix={<TeamOutlined style={{ color: '#52c41a' }} />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
              <Statistic 
                title="Total Employees" 
                value={totalEmp} 
                prefix={<UserOutlined style={{ color: '#1890ff' }} />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
              <Statistic 
                title="Pending DOJ Configuration" 
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
    </div>
  );
};

export default HRTeamPage;
