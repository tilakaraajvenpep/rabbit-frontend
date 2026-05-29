import React, { useState, useEffect } from 'react';
import { 
  Row, Col, Card, Typography, Button, Drawer, Space, 
  Skeleton, notification, Tag, Select, Input, Table, Modal, Tooltip, Avatar
} from 'antd';
import { 
  ClockCircleOutlined, SearchOutlined, PlayCircleOutlined, ProjectOutlined,
  CalendarOutlined, UserOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ticketService } from '../../services/ticketService';
import { projectService } from '../../services/projectService';
import { adminService } from '../../services/adminService';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import PageHeader from '../../components/common/PageHeader';
import PriorityBadge from '../../components/common/PriorityBadge';
import StatusBadge from '../../components/common/StatusBadge';

const { Title, Text, Paragraph } = Typography;

const TicketBacklogsPage = () => {
  const { currentUser, role } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  
  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Table Filters State
  const [tableSearchText, setTableSearchText] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [projRes, usersRes] = await Promise.all([
        projectService.getProjects(),
        adminService.getUsers()
      ]);
      setProjects(projRes.data || []);
      setUsers(usersRes.data || []);
      
      await fetchBacklogTickets();
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load initial data.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchBacklogTickets = async () => {
    try {
      const response = await ticketService.getTickets();
      let ticketsData = response.data || [];
      if (role === 'Employee') {
        const myUserId = currentUser?.userId || currentUser?.id;
        ticketsData = ticketsData.filter(t => 
          (t.assignedToUserId && String(t.assignedToUserId) === String(myUserId)) || 
          (t.assignedTo && String(t.assignedTo) === String(myUserId))
        );
      }
      setTickets(ticketsData);
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to fetch tickets.' });
    }
  };

  const handleMoveToKanban = async (ticket) => {
    setActionLoadingId(ticket.id);
    try {
      // 1. Move to Kanban ToDo
      await ticketService.updateTicketStatus(ticket.id, 'ToDo');
      // 2. Clear due date so there is "no time concept for the tickets in the kanban"
      await ticketService.updateTicket(ticket.id, {
        title: ticket.title,
        description: ticket.description,
        priority: ticket.priority,
        estimatedHours: ticket.estimatedHours,
        dueDate: null,
        assignedToUserId: ticket.assignedToUserId
      });

      notification.success({
        message: 'Restored to Kanban',
        description: `Ticket "${ticket.code} - ${ticket.title}" has been moved to ToDo with due date cleared.`
      });

      await fetchBacklogTickets();
    } catch (error) {
      notification.error({
        message: 'Operation Failed',
        description: 'Could not restore the ticket back to Kanban.'
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Backlog criteria: dueDate is in the past (before today) and status !== 'Done'
  const backlogTickets = tickets.filter(t => {
    const isOverdue = t.dueDate && dayjs(t.dueDate).isBefore(dayjs(), 'day') && t.status !== 'Done';
    return isOverdue;
  });

  const filteredTickets = backlogTickets.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(tableSearchText.toLowerCase()) || 
                          t.code.toLowerCase().includes(tableSearchText.toLowerCase());
    const matchesProject = projectFilter === 'all' || String(t.projectId) === String(projectFilter);
    return matchesSearch && matchesProject;
  });

  const tableColumns = [
    {
      title: 'Ticket Code',
      dataIndex: 'code',
      key: 'code',
      width: 140,
      render: (code) => <Tag color="red" style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13, padding: '4px 10px', borderRadius: 6 }}>{code}</Tag>
    },
    {
      title: 'Task Name',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <a onClick={() => { setSelectedTicket(record); setIsDrawerOpen(true); }} style={{ fontWeight: 600, fontSize: '14px', color: '#dc2626' }}>
            {title}
          </a>
          <Text type="secondary" style={{ fontSize: '11px', marginTop: 4 }}>
            Project: <Tag style={{ borderRadius: 4, margin: 0, fontSize: 10 }}>{record.projectName || 'General'}</Tag>
          </Text>
        </div>
      )
    },
    {
      title: 'Assignee',
      key: 'assignee',
      width: 180,
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
      width: 110,
      render: (priority) => <PriorityBadge priority={priority} />
    },
    {
      title: 'Original Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 160,
      render: (date) => (
        <Space style={{ color: '#ef4444' }}>
          <CalendarOutlined />
          <Text delete style={{ color: '#ef4444', fontSize: '12px' }}>
            {dayjs(date).format('DD MMM YYYY')}
          </Text>
        </Space>
      )
    },
    {
      title: 'Action',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Button 
          type="primary"
          size="small"
          icon={<PlayCircleOutlined />}
          loading={actionLoadingId === record.id}
          onClick={() => handleMoveToKanban(record)}
          style={{ background: '#10b981', borderColor: '#10b981', borderRadius: 6 }}
        >
          Restore to Kanban
        </Button>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader 
        title="Ticket Backlogs" 
        subtitle="View tickets that missed their deadline. Restore them to the active Kanban board with no time concept."
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

          {/* Backlogs Table */}
          <Card 
            style={{ 
              borderRadius: 16, 
              overflow: 'hidden', 
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)',
              background: isDarkMode ? '#1c1c1e' : '#ffffff'
            }}
          >
            <Table 
              columns={tableColumns} 
              dataSource={filteredTickets} 
              rowKey="id" 
              pagination={{ pageSize: 8, showSizeChanger: true }}
              locale={{ emptyText: 'No backlog tickets found.' }}
            />
          </Card>
        </div>
      )}

      {/* Ticket Details Drawer */}
      <Drawer
        title={`Ticket Details: ${selectedTicket?.code}`}
        placement="right"
        width={460}
        onClose={() => setIsDrawerOpen(false)}
        open={isDrawerOpen}
        extra={
          <Button onClick={() => setIsDrawerOpen(false)}>Close</Button>
        }
      >
        {selectedTicket && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Title level={4} style={{ margin: 0, color: '#dc2626' }}>{selectedTicket.title}</Title>
              <Text type="secondary">Project: {selectedTicket.projectName || 'General'}</Text>
            </div>

            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Text type="secondary" block>Priority</Text>
                <PriorityBadge priority={selectedTicket.priority} />
              </Col>
              <Col span={12}>
                <Text type="secondary" block>Status</Text>
                <StatusBadge status={selectedTicket.status} />
              </Col>
            </Row>

            <div>
              <Text type="secondary" block style={{ marginBottom: 6 }}>Missed Deadline Date</Text>
              <Text strong style={{ color: '#ef4444' }}>
                {dayjs(selectedTicket.dueDate).format('DD MMM YYYY')}
              </Text>
            </div>



            {selectedTicket.description && (
              <div>
                <Text type="secondary" block style={{ marginBottom: 6 }}>Description</Text>
                <Paragraph>{selectedTicket.description}</Paragraph>
              </div>
            )}
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default TicketBacklogsPage;
