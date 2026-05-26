import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Avatar, Badge, Spin, Typography, Space, notification } from 'antd';
import { UserOutlined, TeamOutlined, DollarOutlined, MailOutlined } from '@ant-design/icons';
import { adminService } from '../../services/adminService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Title, Text } = Typography;

const TeamDetailsPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isDarkMode } = useThemeStore();

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

  // Filter Team Leads
  const teamLeads = users.filter(u => u.role === 'TeamLead');
  
  // Filter Employees and PMs/Admins not in TL list
  const getEmployeesForTL = (tlId) => {
    return users.filter(u => u.role === 'Employee' && String(u.teamLeadId) === String(tlId));
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
        title="Team Lead & Employee Details" 
        subTitle="View current organizational breakdown and rate cards."
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
                    <Title level={4} style={{ margin: 0 }}>{tl.name || tl.fullName}</Title>
                    <Text type="secondary" style={{ fontSize: '13px' }}>
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
                locale={{ emptyText: 'No employee assigned to this Team Lead.' }}
              />
            </Card>
          );
        })}

        {/* Unassigned Employees section */}
        {users.filter(u => u.role === 'Employee' && (!u.teamLeadId || !teamLeads.some(tl => String(tl.id) === String(u.teamLeadId)))).length > 0 && (
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
                count={`${users.filter(u => u.role === 'Employee' && (!u.teamLeadId || !teamLeads.some(tl => String(tl.id) === String(u.teamLeadId)))).length} Members`} 
                style={{ backgroundColor: '#64748b' }} 
              />
            }
          >
            <Table
              dataSource={users.filter(u => u.role === 'Employee' && (!u.teamLeadId || !teamLeads.some(tl => String(tl.id) === String(u.teamLeadId))))}
              columns={columns}
              rowKey="id"
              pagination={false}
            />
          </Card>
        )}

        {teamLeads.length === 0 && users.filter(u => u.role === 'Employee').length === 0 && (
          <Card style={{ textAlign: 'center', padding: '40px 0' }}>
            <TeamOutlined style={{ fontSize: '48px', color: '#bfbfbf', marginBottom: 16 }} />
            <Title level={4} type="secondary">No Teams Found</Title>
            <Text type="secondary">You can invite and assign users under the Users feature.</Text>
          </Card>
        )}
      </Space>
    </div>
  );
};

export default TeamDetailsPage;
