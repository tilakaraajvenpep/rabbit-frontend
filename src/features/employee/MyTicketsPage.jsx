import React, { useState, useEffect } from 'react';
import { 
  Row, Col, Card, Typography, Tabs, Button, Drawer, Space, 
  Skeleton, notification, FloatButton, Select, Input, Divider, Tag 
} from 'antd';
import { CalendarOutlined, EyeOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { ticketService } from '../../services/ticketService';
import { projectService } from '../../services/projectService';
import { useAuthStore } from '../../store/authStore';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import PriorityBadge from '../../components/common/PriorityBadge';
import HoursProgress from '../../components/common/HoursProgress';
import EmptyState from '../../components/common/EmptyState';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const MyTicketsPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Progress Reporting State
  const [progressState, setProgressState] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMyTickets();
  }, [currentUser.id]);

  const fetchMyTickets = async () => {
    setLoading(true);
    try {
      const response = await ticketService.getTickets();
      setTickets(response.data);
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load tickets.' });
    } finally {
      setLoading(false);
    }
  };

  const openTicketDetail = (ticket) => {
    setSelectedTicket(ticket);
    setProgressState(ticket.progressState || 'InProgress');
    setStatusNotes(ticket.statusNotes || '');
    setIsDrawerOpen(true);
  };

  const handleSaveProgress = async () => {
    setSaving(true);
    try {
      await ticketService.updateTicketProgress(selectedTicket.id, {
        progressState,
        statusNotes
      });
      notification.success({ message: 'Progress Updated', description: 'Your status has been shared with the PM.' });
      fetchMyTickets();
      setIsDrawerOpen(false);
    } catch (error) {
      notification.error({ message: 'Update Failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      await ticketService.updateTicketStatus(ticketId, newStatus);
      notification.success({ message: 'Status Updated' });
      fetchMyTickets();
    } catch (error) {
      notification.error({ message: 'Failed to update status', description: error.response?.data?.message || 'Error' });
    }
  };

  const filteredTickets = tickets.filter(t => {
    if (activeTab === 'All') return true;
    return t.status === activeTab;
  });

  const tabItems = [
    { key: 'All', label: 'All' },
    { key: 'ToDo', label: 'To Do' },
    { key: 'InProgress', label: 'In Progress' },
    { key: 'InReview', label: 'In Review' },
    { key: 'Done', label: 'Done' },
  ];

  return (
    <div>
      <PageHeader title="My Tickets" />

      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab} 
        items={tabItems}
        style={{ marginBottom: 24 }}
      />

      {loading ? (
        <Row gutter={[16, 16]}>
          {[1, 2, 3].map(i => (
            <Col xs={24} sm={12} md={8} key={i}>
              <Card><Skeleton active /></Card>
            </Col>
          ))}
        </Row>
      ) : filteredTickets.length > 0 ? (
        <Row gutter={[16, 16]}>
          {filteredTickets.map(ticket => {
            const isOverdue = new Date(ticket.dueDate) < new Date() && ticket.status !== 'Done';
            return (
              <Col xs={24} sm={12} md={8} key={ticket.id}>
                <Card 
                  hoverable
                  actions={[
                    <Button type="link" icon={<EyeOutlined />} onClick={() => openTicketDetail(ticket)}>View Details</Button>
                  ]}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Space direction="vertical" size={0}>
                      <Text code strong>{ticket.code}</Text>
                      {ticket.progressState && <Tag color="processing">{ticket.progressState}</Tag>}
                    </Space>
                    <PriorityBadge priority={ticket.priority} />
                  </div>
                  <Title level={5} ellipsis={{ rows: 2 }} style={{ margin: '0 0 8px 0' }}>{ticket.title}</Title>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Project: {ticket.projectName || 'General'}</Text>
                  
                  <div style={{ marginBottom: 16 }}>
                    <StatusBadge status={ticket.status} />
                  </div>

                  <HoursProgress consumed={ticket.consumedHours} total={ticket.estimatedHours} />

                  <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CalendarOutlined style={{ color: isOverdue ? '#ff4d4f' : '#8c8c8c' }} />
                    <Text type={isOverdue ? 'danger' : 'secondary'} style={{ fontSize: '12px' }}>
                      Due: {dayjs(ticket.dueDate).format('DD MMM YYYY')}
                    </Text>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      ) : (
        <EmptyState message="No tickets found in this category." />
      )}

      <FloatButton
        icon={<EditOutlined />}
        type="primary"
        style={{ right: 24, bottom: 24 }}
        tooltip={<div>Submit Today's Report</div>}
        onClick={() => navigate('/employee/report')}
      />

      <Drawer
        title={selectedTicket?.code}
        placement="right"
        width={480}
        onClose={() => setIsDrawerOpen(false)}
        open={isDrawerOpen}
        extra={
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSaveProgress}>
            Save Status
          </Button>
        }
      >
        {selectedTicket && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Title level={4}>{selectedTicket.title}</Title>
              <Paragraph type="secondary">{selectedTicket.description}</Paragraph>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Space direction="vertical">
                <Text strong>Priority</Text>
                <PriorityBadge priority={selectedTicket.priority} />
              </Space>
              <Space direction="vertical" style={{ flex: 1 }}>
                <Text strong>Work Flow</Text>
                <Select 
                  style={{ width: '100%' }} 
                  value={selectedTicket.status}
                  onChange={(val) => handleStatusChange(selectedTicket.id, val)}
                >
                  <Select.Option value="ToDo">To Do</Select.Option>
                  <Select.Option value="InProgress">In Progress</Select.Option>
                  <Select.Option value="InReview">In Review</Select.Option>
                  <Select.Option value="Done" disabled>Done</Select.Option>
                </Select>
              </Space>
            </div>

            <Divider style={{ margin: '8px 0' }} />

            {/* NEW Progress Reporting Section */}
            <div style={{ background: '#f9f9f9', padding: 16, borderRadius: 8 }}>
              <Title level={5}>PM Status Update</Title>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <div>
                  <Text type="secondary">Current Progress State</Text>
                  <Select 
                    style={{ width: '100%', marginTop: 8 }} 
                    value={progressState}
                    onChange={setProgressState}
                  >
                    <Select.Option value="InProgress">In Progress</Select.Option>
                    <Select.Option value="Delay">Delay</Select.Option>
                    <Select.Option value="Deployment">Deployment</Select.Option>
                  </Select>
                </div>
                <div>
                  <Text type="secondary">Status Notes for PM</Text>
                  <TextArea 
                    rows={4} 
                    style={{ marginTop: 8 }}
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    placeholder="Provide a brief update for the Project Manager..."
                  />
                </div>
              </Space>
            </div>

            <Divider style={{ margin: '8px 0' }} />

            <Space direction="vertical">
              <Text strong>Estimated vs Consumed</Text>
              <Text>{selectedTicket.consumedHours} / {selectedTicket.estimatedHours} hrs</Text>
            </Space>

            <Space direction="vertical">
              <Text strong>Due Date</Text>
              <Text>{dayjs(selectedTicket.dueDate).format('DD MMM YYYY')}</Text>
            </Space>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default MyTicketsPage;
