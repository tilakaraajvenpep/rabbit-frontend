import React, { useState, useEffect } from 'react';
import { Card, Table, Avatar, Badge, Spin, Typography, Space, notification, Tooltip } from 'antd';
import { UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { projectService } from '../../services/projectService';
import { ticketService } from '../../services/ticketService';
import { adminService } from '../../services/adminService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Text } = Typography;

const HRProjectsPage = () => {
  const [loading, setLoading] = useState(true);
  const [projectList, setProjectList] = useState([]);
  const { isDarkMode } = useThemeStore();

  useEffect(() => {
    fetchData();
    const onVisible = () => { if (document.visibilityState === 'visible') fetchData(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projectsRes, ticketsRes, usersRes] = await Promise.all([
        projectService.getProjects(),
        ticketService.getTickets(),
        adminService.getUsers()
      ]);

      const projects = projectsRes.data || [];
      const tickets = ticketsRes.data || [];
      const users = usersRes.data || [];

      // Map projects with their team lead and unique working employees
      const detailedProjects = projects.map(p => {
        // Find tickets for this project
        const projectTickets = tickets.filter(t => String(t.projectId) === String(p.id || p.projectId));
        
        // Find unique user IDs assigned to those tickets
        const assignedUserIds = [...new Set(projectTickets.map(t => t.assignedToUserId).filter(Boolean))];
        
        // Lookup employees assigned (role === 'Employee')
        const employees = users.filter(u => 
          assignedUserIds.includes(u.id || u.userId) && u.role === 'Employee'
        );

        // Find Team Lead assigned to project
        const tlUser = users.find(u => String(u.id || u.userId) === String(p.assignedTeamLeadId));

        return {
          ...p,
          teamLeadName: p.teamLead || (tlUser ? (tlUser.name || tlUser.fullName) : 'None'),
          teamLeadAvatar: tlUser ? tlUser.avatar : null,
          employees,
          ticketCount: projectTickets.length
        };
      });

      setProjectList(detailedProjects);
    } catch (error) {
      console.error(error);
      notification.error({
        message: 'Error Loading Projects',
        description: 'Could not load projects, tickets, or user allocations.'
      });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Project Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ fontSize: '15px' }}>{name || record.projectName}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>Code: {record.code}</Text>
        </Space>
      ),
      sorter: (a, b) => (a.name || a.projectName || '').localeCompare(b.name || b.projectName || ''),
    },
    {
      title: 'Approved Hours',
      dataIndex: 'approvedHours',
      key: 'approvedHours',
      render: (hours) => (
        <Space>
          <ClockCircleOutlined style={{ color: '#1890ff' }} />
          <Text strong>{hours ? `${Number(hours)} hrs` : '0 hrs'}</Text>
        </Space>
      ),
      sorter: (a, b) => Number(a.approvedHours || 0) - Number(b.approvedHours || 0),
    },
    {
      title: 'Assigned Team Lead',
      dataIndex: 'teamLeadName',
      key: 'teamLeadName',
      render: (name, record) => (
        <Space>
          <Avatar 
            src={record.teamLeadAvatar} 
            icon={<UserOutlined />} 
            style={{ backgroundColor: '#1890ff' }}
          />
          <Text strong>{name}</Text>
        </Space>
      )
    },
    {
      title: 'Employees Working',
      dataIndex: 'employees',
      key: 'employees',
      render: (employees) => {
        if (!employees || employees.length === 0) {
          return <Text type="secondary">No employees assigned</Text>;
        }
        return (
          <Avatar.Group maxCount={4} maxStyle={{ color: '#f56a00', backgroundColor: '#fde3cf' }}>
            {employees.map(emp => (
              <Tooltip key={emp.id || emp.userId} title={`${emp.name || emp.fullName}`}>
                <Avatar 
                  src={emp.avatar} 
                  icon={<UserOutlined />} 
                  style={{ backgroundColor: '#87d068' }}
                />
              </Tooltip>
            ))}
          </Avatar.Group>
        );
      }
    },
    {
      title: 'Total Tickets',
      dataIndex: 'ticketCount',
      key: 'ticketCount',
      align: 'center',
      render: (count) => (
        <Badge count={count} style={{ backgroundColor: '#52c41a' }} />
      )
    }
  ];

  return (
    <div>
      <PageHeader 
        title="Project Allocations" 
        subTitle="Track projects, approved hours, team lead mappings, and active employees."
      />

      <Card 
        style={{ 
          borderRadius: 12,
          boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(0,0,0,0.05)',
          border: isDarkMode ? '1px solid #3f3f46' : '1px solid #e8e8e8'
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <Spin size="large" />
          </div>
        ) : (
          <Table 
            dataSource={projectList}
            columns={columns}
            rowKey={(record) => String(record.id || record.projectId)}
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: 'No projects found.' }}
          />
        )}
      </Card>
    </div>
  );
};

export default HRProjectsPage;
