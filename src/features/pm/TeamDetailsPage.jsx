import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Avatar, Badge, Spin, Typography, Space, notification, Select } from 'antd';
import { UserOutlined, TeamOutlined, DollarOutlined, MailOutlined } from '@ant-design/icons';
import { adminService } from '../../services/adminService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

const TeamDetailsPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
  const { isDarkMode } = useThemeStore();
  const { currentUser, role } = useAuthStore();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await adminService.getUsers();
      setUsers(res.data || []);
    } catch (error) {
      notification.error({
        message: 'Error',
        description: 'Failed to load team and employee details.'
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  // Filter based on active status filter
  const filteredUsers = users.filter(u => {
    if (statusFilter === 'active') return u.isActive !== false;
    if (statusFilter === 'inactive') return u.isActive === false;
    return true;
  });

  // Filter Team Leads (If TeamLead is logged in, restrict to only themselves)
  const teamLeads = filteredUsers.filter(u => {
    const isTL = u.role === 'TeamLead';
    if (role === 'TeamLead') {
      return isTL && String(u.id || u.userId) === String(currentUser?.id || currentUser?.userId);
    }
    return isTL;
  });
  
  // Filter Employees and PMs/Admins not in TL list
  const getEmployeesForTL = (tlId) => {
    return filteredUsers.filter(u => u.role === 'Employee' && String(u.teamLeadId) === String(tlId));
  };

  const columns = [
    {
      title: 'Employee Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <Avatar size="small" src={record.avatar} icon={<UserOutlined />} />
          <Text strong>{text || record.fullName}</Text>
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
      title: 'Cost per Hour',
      dataIndex: 'costPerHour',
      key: 'costPerHour',
      render: (cost) => (
        <Space>
          <DollarOutlined style={{ color: '#52c41a' }} />
          <Text strong style={{ color: '#52c41a' }}>
            ₹ {Number(cost || 0).toLocaleString('en-IN')}/hr
          </Text>
        </Space>
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

  return (
    <div>
      <PageHeader 
        title={role === 'TeamLead' ? "My Team Directory" : "Team Lead & Employee Details"} 
        subTitle={role === 'TeamLead' ? "View employees working under your leadership." : "View current organizational breakdown and rate cards."}
        extra={
          <Space>
            <span style={{ fontWeight: 600, color: isDarkMode ? '#e4e4e7' : '#3f3f46' }}>Status Filter:</span>
            <Select 
              value={statusFilter} 
              onChange={setStatusFilter} 
              style={{ width: 160 }}
              options={[
                { label: 'All Statuses', value: 'all' },
                { label: 'Active Only', value: 'active' },
                { label: 'Inactive Only', value: 'inactive' },
              ]}
            />
          </Space>
        }
      />

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {teamLeads.map(tl => {
          const team = getEmployeesForTL(tl.id);
          return (
            <Card
              key={tl.id}
              style={{
                borderRadius: 12,
                boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(0,0,0,0.05)',
                border: isDarkMode ? '1px solid #3f3f46' : '1px solid #e8e8e8'
              }}
              title={
                <Space style={{ padding: '8px 0' }}>
                  <Avatar size="large" src={tl.avatar} icon={<UserOutlined />} style={{ border: '2px solid #1890ff' }} />
                  <div>
                    <Space>
                      <Title level={4} style={{ margin: 0 }}>{tl.name || tl.fullName}</Title>
                      <Badge status={tl.isActive !== false ? 'success' : 'error'} text={tl.isActive !== false ? 'Active' : 'Inactive'} />
                    </Space>
                    <Text type="secondary" style={{ display: 'block', fontSize: '13px' }}>
                      Team Lead | Cost per Hour: ₹ {Number(tl.costPerHour || 0).toLocaleString('en-IN')}/hr
                    </Text>
                  </div>
                </Space>
              }
              extra={
                <Badge count={`${team.length} Members`} style={{ backgroundColor: '#1890ff' }} />
              }
            >
              <Table
                dataSource={team}
                columns={columns}
                rowKey="id"
                pagination={false}
                locale={{ emptyText: 'No employees found matching the current status.' }}
              />
            </Card>
          );
        })}

        {/* Unassigned Employees section */}
        {role !== 'TeamLead' && filteredUsers.filter(u => u.role === 'Employee' && (!u.teamLeadId || !teamLeads.some(tl => String(tl.id) === String(u.teamLeadId)))).length > 0 && (
          <Card
            style={{
              borderRadius: 12,
              boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(0,0,0,0.05)',
              border: isDarkMode ? '1px solid #3f3f46' : '1px solid #e8e8e8',
              backgroundColor: isDarkMode ? '#1e1b4b' : '#f8fafc'
            }}
            title={
              <Space style={{ padding: '8px 0' }}>
                <Avatar size="large" icon={<UserOutlined />} style={{ border: '2px solid #64748b', backgroundColor: '#cbd5e1' }} />
                <div>
                  <Title level={4} style={{ margin: 0 }}>Unassigned Employees</Title>
                  <Text type="secondary" style={{ fontSize: '13px' }}>
                    Employees not currently assigned to any Team Lead
                  </Text>
                </div>
              </Space>
            }
            extra={
              <Badge 
                count={`${filteredUsers.filter(u => u.role === 'Employee' && (!u.teamLeadId || !teamLeads.some(tl => String(tl.id) === String(u.teamLeadId)))).length} Members`} 
                style={{ backgroundColor: '#64748b' }} 
              />
            }
          >
            <Table
              dataSource={filteredUsers.filter(u => u.role === 'Employee' && (!u.teamLeadId || !teamLeads.some(tl => String(tl.id) === String(u.teamLeadId))))}
              columns={columns}
              rowKey="id"
              pagination={false}
              locale={{ emptyText: 'No unassigned employees found matching the current status.' }}
            />
          </Card>
        )}

        {teamLeads.length === 0 && filteredUsers.filter(u => u.role === 'Employee').length === 0 && (
          <Card style={{ textAlign: 'center', padding: '40px 0' }}>
            <TeamOutlined style={{ fontSize: '48px', color: '#bfbfbf', marginBottom: 16 }} />
            <Title level={4} type="secondary">No Team Members Found</Title>
            <Text type="secondary">No team members match the current status filter criteria.</Text>
          </Card>
        )}
      </Space>
    </div>
  );
};

export default TeamDetailsPage;
