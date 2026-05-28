import React, { useState, useEffect } from 'react';
import { Card, Table, Avatar, Badge, Spin, Typography, Space, notification, Tooltip, Button } from 'antd';
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
      const tickets  = ticketsRes.data  || [];
      const users    = usersRes.data    || [];

      const detailedProjects = projects.map(p => {
        const projectTickets  = tickets.filter(t => String(t.projectId) === String(p.id || p.projectId));
        const assignedUserIds = [...new Set(projectTickets.map(t => t.assignedToUserId).filter(Boolean))];
        const tlAssignedIds   = p.assignedEmployeeIds && Array.isArray(p.assignedEmployeeIds) ? p.assignedEmployeeIds : [];
        const employees = users.filter(u =>
          (tlAssignedIds.includes(u.id || u.userId) ||
           (tlAssignedIds.length === 0 && assignedUserIds.includes(u.id || u.userId))) &&
          u.role === 'Employee'
        );
        const tlUser = users.find(u => String(u.id || u.userId) === String(p.assignedTeamLeadId));
        return {
          ...p,
          teamLeadName:   p.teamLead || (tlUser ? (tlUser.name || tlUser.fullName) : 'None'),
          teamLeadAvatar: tlUser ? tlUser.avatar : null,
          employees,
          ticketCount: projectTickets.length
        };
      });
      setProjectList(detailedProjects);
    } catch (error) {
      console.error(error);
      notification.error({ message: 'Error Loading Projects', description: 'Could not load project data.' });
    } finally {
      setLoading(false);
    }
  };

  const border = isDarkMode ? '#1e1e2e' : '#e8ecf4';

  const columns = [
    {
      title: 'Project',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ fontSize: 14 }}>{name || record.projectName}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>Code: {record.code}</Text>
        </Space>
      ),
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: 'Approved Hours',
      dataIndex: 'approvedHours',
      key: 'approvedHours',
      render: (hours) => (
        <Space>
          <ClockCircleOutlined style={{ color: '#4f6ef7' }} />
          <Text strong>{hours ? `${Number(hours)} hrs` : '0 hrs'}</Text>
        </Space>
      ),
    },
    {
      title: 'Team Lead',
      dataIndex: 'teamLeadName',
      key: 'teamLeadName',
      render: (name, record) => (
        <Space>
          <Avatar src={record.teamLeadAvatar} icon={<UserOutlined />} style={{ backgroundColor: '#4f6ef7' }} />
          <Text>{name}</Text>
        </Space>
      )
    },
    {
      title: 'Employees Assigned',
      dataIndex: 'employees',
      key: 'employees',
      render: (employees) => {
        if (!employees || employees.length === 0) {
          return <Text type="secondary">None assigned</Text>;
        }
        return (
          <Avatar.Group maxCount={4} maxStyle={{ color: '#f56a00', backgroundColor: '#fde3cf' }}>
            {employees.map(emp => (
              <Tooltip key={emp.id || emp.userId} title={emp.name || emp.fullName}>
                <Avatar src={emp.avatar} icon={<UserOutlined />} style={{ backgroundColor: '#10b981' }} />
              </Tooltip>
            ))}
          </Avatar.Group>
        );
      }
    },
    {
      title: 'Tickets',
      dataIndex: 'ticketCount',
      key: 'ticketCount',
      align: 'center',
      render: (count) => <Badge count={count} style={{ backgroundColor: '#52c41a' }} />
    },
  ];

  return (
    <div>
      <PageHeader
        title="Project Allocations"
        subTitle="View all projects and allocate working hours to assigned employees."
      />
      <Card
        style={{
          borderRadius: 12,
          boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(0,0,0,0.05)',
          border: `1px solid ${border}`
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin size="large" /></div>
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
