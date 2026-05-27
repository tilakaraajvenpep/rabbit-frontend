import React, { useState, useEffect } from 'react';
import { 
  Row, Col, Card, Typography, Space, Button, Popconfirm, Tabs,
  Skeleton, notification, Tag, Select, Input, Table, Avatar
} from 'antd';
import { 
  SearchOutlined, CalendarOutlined, UserOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ticketService } from '../../services/ticketService';
import { projectService } from '../../services/projectService';
import { adminService } from '../../services/adminService';
import { useThemeStore } from '../../store/themeStore';
import PageHeader from '../../components/common/PageHeader';
import PriorityBadge from '../../components/common/PriorityBadge';
import StatusBadge from '../../components/common/StatusBadge';

const { Text } = Typography;

const HRTaskTrackingPage = () => {
  const { isDarkMode } = useThemeStore();
  
  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Table Filters State
  const [tableSearchText, setTableSearchText] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [projRes, usersRes, ticketsRes] = await Promise.all([
        projectService.getProjects(),
        adminService.getUsers(),
        ticketService.getTickets()
      ]);
      setProjects(projRes.data || []);
      setUsers(usersRes.data || []);
      setTickets(ticketsRes.data || []);
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load task tracking data.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (ticketId) => {
    try {
      await ticketService.updateTicketStatus(ticketId, 'Done');
      notification.success({
        message: 'Task Acknowledged',
        description: 'The backlog task has been acknowledged and marked as Done.'
      });
      fetchInitialData();
    } catch (e) {
      notification.error({
        message: 'Action Failed',
        description: 'Failed to acknowledge the backlog task.'
      });
    }
  };

  const handleDelete = async (ticketId) => {
    try {
      await ticketService.deleteTicket(ticketId);
      notification.success({
        message: 'Task Deleted',
        description: 'The backlog task has been deleted successfully.'
      });
      fetchInitialData();
    } catch (e) {
      notification.error({
        message: 'Action Failed',
        description: 'Failed to delete the backlog task.'
      });
    }
  };

  // Backlog criteria: dueDate is in the past (before today) and status !== 'Done'
  const backlogTickets = tickets.filter(t => {
    return t.dueDate && dayjs(t.dueDate).isBefore(dayjs(), 'day') && t.status !== 'Done';
  });

  // Acknowledged criteria: status === 'Done'
  const acknowledgedTickets = tickets.filter(t => {
    return t.status === 'Done';
  });

  const filteredBacklogTickets = backlogTickets.filter(t => {
    const matchesSearch = (t.title || '').toLowerCase().includes(tableSearchText.toLowerCase()) || 
                          (t.code || '').toLowerCase().includes(tableSearchText.toLowerCase());
    const matchesProject = projectFilter === 'all' || String(t.projectId) === String(projectFilter);
    return matchesSearch && matchesProject;
  });

  const filteredAcknowledgedTickets = acknowledgedTickets.filter(t => {
    const matchesSearch = (t.title || '').toLowerCase().includes(tableSearchText.toLowerCase()) || 
                          (t.code || '').toLowerCase().includes(tableSearchText.toLowerCase());
    const matchesProject = projectFilter === 'all' || String(t.projectId) === String(projectFilter);
    return matchesSearch && matchesProject;
  });

  const tableColumns = [
    {
      title: 'Ticket Code',
      dataIndex: 'code',
      key: 'code',
      width: 130,
      render: (code) => <Tag color="red" style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13, padding: '4px 10px', borderRadius: 6 }}>{code}</Tag>
    },
    {
      title: 'Task Name',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Text strong style={{ fontSize: '14px' }}>
            {title}
          </Text>
          <Text type="secondary" style={{ fontSize: '11px', marginTop: 4 }}>
            Project: <Tag style={{ borderRadius: 4, margin: 0, fontSize: 10 }}>{record.projectName || projects.find(p => String(p.id) === String(record.projectId))?.name || 'General'}</Tag>
          </Text>
        </div>
      )
    },
    {
      title: 'Assignee',
      key: 'assignee',
      width: 160,
      render: (_, record) => {
        const user = users.find(u => u.id === record.assignedToUserId);
        return (
          <Space>
            <Avatar size="small" src={user?.avatar} icon={<UserOutlined />} />
            <Text style={{ fontSize: 13 }}>{user?.name || 'Unassigned'}</Text>
          </Space>
        );
      }
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority) => <PriorityBadge priority={priority} />
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <StatusBadge status={status} />
    },
    {
      title: 'Original Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 150,
      render: (date) => (
        <Space style={{ color: '#ef4444' }}>
          <CalendarOutlined />
          <Text style={{ color: '#ef4444', fontSize: '12px' }}>
            {dayjs(date).format('DD MMM YYYY')}
          </Text>
        </Space>
      )
    },
    {
      title: 'Action',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="primary" 
            size="small" 
            onClick={() => handleAcknowledge(record.id)}
            style={{ background: '#10b981', borderColor: '#10b981', borderRadius: 6 }}
          >
            Acknowledge
          </Button>
          <Popconfirm
            title="Delete Overdue Task"
            description="Are you sure you want to delete this backlog task?"
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button 
              danger 
              type="primary" 
              size="small"
              style={{ borderRadius: 6 }}
            >
              Delete
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // Acknowledged tickets shouldn't show actions (they are already completed/acknowledged)
  const acknowledgedColumns = tableColumns.filter(c => c.key !== 'action');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader 
        title="Employee Task Tracking" 
        subTitle="Monitor incomplete task backlogs and missed deadlines across all employees."
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Skeleton active />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Table Filters Toolbar */}
          <Card 
            style={{ 
              borderRadius: 12, 
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
              background: isDarkMode ? '#1c1c1e' : '#ffffff' 
            }} 
            bodyStyle={{ padding: '16px 24px' }}
          >
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} md={12}>
                <Input 
                  placeholder="Quick search by ticket code, task title..." 
                  value={tableSearchText} 
                  onChange={e => setTableSearchText(e.target.value)}
                  prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                  allowClear
                  style={{ borderRadius: 8, padding: '8px 12px' }}
                />
              </Col>
              <Col xs={24} md={12} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Text strong type="secondary">Filter Project:</Text>
                <Select
                  value={projectFilter}
                  onChange={setProjectFilter}
                  style={{ width: 220 }}
                  options={[
                    { label: 'All Projects', value: 'all' },
                    ...projects.map(p => ({ label: p.name, value: String(p.id) }))
                  ]}
                />
              </Col>
            </Row>
          </Card>

          {/* Backlogs & Acknowledged Tabs Card */}
          <Card 
            style={{ 
              borderRadius: 16, 
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)',
              background: isDarkMode ? '#1c1c1e' : '#ffffff'
            }}
          >
            <Tabs defaultActiveKey="pending" type="line">
              <Tabs.TabPane 
                tab={
                  <Space>
                    <span>Pending Backlogs</span>
                    <Tag color="red" style={{ borderRadius: '10px', fontSize: '11px', margin: 0 }}>
                      {filteredBacklogTickets.length}
                    </Tag>
                  </Space>
                } 
                key="pending"
              >
                <Table 
                  columns={tableColumns} 
                  dataSource={filteredBacklogTickets} 
                  rowKey="id" 
                  pagination={{ pageSize: 8, showSizeChanger: true }}
                  locale={{ emptyText: 'No pending backlog tickets found.' }}
                />
              </Tabs.TabPane>
              
              <Tabs.TabPane 
                tab={
                  <Space>
                    <span>Acknowledged Tasks</span>
                    <Tag color="green" style={{ borderRadius: '10px', fontSize: '11px', margin: 0 }}>
                      {filteredAcknowledgedTickets.length}
                    </Tag>
                  </Space>
                } 
                key="acknowledged"
              >
                <Table 
                  columns={acknowledgedColumns} 
                  dataSource={filteredAcknowledgedTickets} 
                  rowKey="id" 
                  pagination={{ pageSize: 8, showSizeChanger: true }}
                  locale={{ emptyText: 'No acknowledged tickets found.' }}
                />
              </Tabs.TabPane>
            </Tabs>
          </Card>
        </div>
      )}
    </div>
  );
};

export default HRTaskTrackingPage;
