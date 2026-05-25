import React, { useState, useEffect } from 'react';
import { 
  Row, Col, Card, Typography, Button, Drawer, Space, 
  Skeleton, notification, Tag, Select, Input, Table
} from 'antd';
import { 
  ClockCircleOutlined, SearchOutlined
} from '@ant-design/icons';
import { ticketService } from '../../services/ticketService';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import PageHeader from '../../components/common/PageHeader';
import PriorityBadge from '../../components/common/PriorityBadge';
import HoursProgress from '../../components/common/HoursProgress';

const { Title, Text, Paragraph } = Typography;

const MyTicketsPage = () => {
  const { currentUser } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Table Filters State
  const [tableSearchText, setTableSearchText] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');

  useEffect(() => {
    fetchMyTickets();
  }, [currentUser.id]);

  const fetchMyTickets = async () => {
    setLoading(true);
    try {
      const response = await ticketService.getTickets();
      setTickets(response.data || []);
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load tickets.' });
    } finally {
      setLoading(false);
    }
  };

  const openTicketDetail = (ticket) => {
    setSelectedTicket(ticket);
    setIsDrawerOpen(true);
  };

  const formatTimer = (totalSeconds) => {
    if (!totalSeconds) return '0s';
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    const parts = [];
    if (hrs > 0) parts.push(`${hrs}h`);
    if (mins > 0 || hrs > 0) parts.push(`${mins}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(' ');
  };

  // Read-only Table Columns: strictly details and time consumed, no actions
  const tableColumns = [
    {
      title: 'Ticket Code',
      dataIndex: 'code',
      key: 'code',
      width: 140,
      render: (code) => <Tag color="blue" style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13, padding: '4px 10px', borderRadius: 6 }}>{code}</Tag>
    },
    {
      title: 'Task Name',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <a onClick={() => openTicketDetail(record)} style={{ fontWeight: 600, fontSize: '14px', color: '#1d4ed8' }}>
            {title}
          </a>
          <Text type="secondary" style={{ fontSize: '11px', marginTop: 4 }}>
            Project: <Tag style={{ borderRadius: 4, margin: 0, fontSize: 10 }}>{record.projectName || 'General'}</Tag>
          </Text>
        </div>
      )
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 120,
      render: (priority) => <PriorityBadge priority={priority} />
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const color = status === 'Done' ? 'success' : status === 'InProgress' ? 'processing' : 'default';
        return <Tag color={color} style={{ textTransform: 'capitalize', fontWeight: 500 }}>{status === 'InProgress' ? 'In Progress' : status}</Tag>;
      }
    },
    {
      title: 'Total Time Consumed',
      key: 'timer',
      width: 200,
      render: (_, record) => {
        const seconds = record.timerAccumulatedSeconds || 0;
        return (
          <Space>
            <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
            <Text strong style={{ fontSize: '13px' }}>
              {formatTimer(seconds)}
            </Text>
          </Space>
        );
      }
    },
    {
      title: 'Estimation (Budget Hours)',
      key: 'estimation',
      width: 240,
      render: (_, record) => (
        <div style={{ minWidth: 160 }}>
          <HoursProgress consumed={record.consumedHours} total={record.estimatedHours} />
        </div>
      )
    }
  ];

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(tableSearchText.toLowerCase()) || 
                          t.code.toLowerCase().includes(tableSearchText.toLowerCase()) ||
                          (t.projectName && t.projectName.toLowerCase().includes(tableSearchText.toLowerCase()));
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader 
        title="My Assigned Tickets" 
        subtitle="A read-only log of your assigned tasks, details, and accumulated timesheet progress."
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Skeleton active />
        </div>
      ) : tickets.length === 0 ? (
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '60px 0' }}>
          <Text type="secondary" style={{ fontSize: 16 }}>No tickets assigned to you yet.</Text>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Table Filters Toolbar */}
          <Card style={{ borderRadius: 12, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }} bodyStyle={{ padding: '16px 24px' }}>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} md={12}>
                <Input 
                  placeholder="Quick search by ticket code, task title, project..." 
                  value={tableSearchText} 
                  onChange={e => setTableSearchText(e.target.value)}
                  prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                  allowClear
                  style={{ borderRadius: 8, padding: '8px 12px' }}
                />
              </Col>
              <Col xs={24} md={12} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                <Text strong type="secondary">Filter Priority:</Text>
                <Select
                  value={priorityFilter}
                  onChange={setPriorityFilter}
                  style={{ width: 160 }}
                  options={[
                    { label: 'All Priorities', value: 'all' },
                    { label: '🔴 High', value: 'High' },
                    { label: '🟡 Medium', value: 'Medium' },
                    { label: '🟢 Low', value: 'Low' }
                  ]}
                />
              </Col>
            </Row>
          </Card>

          {/* Table Card (No Actions, Clean Details) */}
          <Card style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
            <Table 
              columns={tableColumns} 
              dataSource={filteredTickets} 
              rowKey="id" 
              pagination={{ pageSize: 8, showSizeChanger: true }}
              locale={{ emptyText: 'No tickets match the search filters.' }}
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
              <Title level={4} style={{ margin: 0 }}>{selectedTicket.title}</Title>
              <Text type="secondary">Project: {selectedTicket.projectName || 'General'}</Text>
            </div>

            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Text type="secondary" block>Priority</Text>
                <PriorityBadge priority={selectedTicket.priority} />
              </Col>
              <Col span={12}>
                <Text type="secondary" block>Status</Text>
                <Tag color={selectedTicket.status === 'Done' ? 'green' : 'blue'} style={{ textTransform: 'capitalize' }}>
                  {selectedTicket.status}
                </Tag>
              </Col>
            </Row>

            <div>
              <Text type="secondary" block style={{ marginBottom: 6 }}>Estimated Budget vs Actual Consumed</Text>
              <HoursProgress consumed={selectedTicket.consumedHours} total={selectedTicket.estimatedHours} />
            </div>

            <div>
              <Text type="secondary" block style={{ marginBottom: 6 }}>Timesheet Record</Text>
              <Text strong style={{ fontSize: 16 }}>{formatTimer(selectedTicket.timerAccumulatedSeconds)} consumed</Text>
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

export default MyTicketsPage;
