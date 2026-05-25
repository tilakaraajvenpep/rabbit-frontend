import React, { useState, useEffect, useRef } from 'react';
import { 
  Row, Col, Card, Typography, Button, Drawer, Space, 
  Skeleton, notification, FloatButton, Select, Input, Divider, Tag, Modal, message,
  Table, Segmented, Progress, Alert, Tooltip
} from 'antd';
import { 
  CalendarOutlined, EyeOutlined, EditOutlined, SaveOutlined, DeleteOutlined,
  TableOutlined, AppstoreOutlined, ClockCircleOutlined, SyncOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, PlayCircleOutlined, PauseCircleOutlined, SearchOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { ticketService } from '../../services/ticketService';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
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
  const { isDarkMode } = useThemeStore();
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table'); // Default to 'table' initially
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Table Filters State
  const [tableSearchText, setTableSearchText] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Progress Reporting State
  const [progressState, setProgressState] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Live timer tick state
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetchMyTickets();
  }, [currentUser.id]);

  // Set up live ticking timer interval
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      await ticketService.updateTicketStatus(ticketId, newStatus);
      notification.success({ 
        message: 'Status Updated', 
        description: newStatus === 'InProgress' 
          ? 'Timer started automatically! Good luck with your task!' 
          : 'Timer paused and time recorded successfully!'
      });
      fetchMyTickets();
    } catch (error) {
      notification.error({ message: 'Failed to update status', description: error.response?.data?.message || 'Error' });
    }
  };

  const handleDeleteTicket = (ticket) => {
    Modal.confirm({
      title: 'Cancel Ticket',
      content: `Are you sure you want to cancel/delete ticket "${ticket.code} - ${ticket.title}"?`,
      okText: 'Yes, Cancel',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
          await ticketService.deleteTicket(ticket.id);
          message.success('Ticket cancelled successfully.');
          fetchMyTickets();
        } catch (error) {
          console.error('Failed to cancel ticket', error);
          message.error('Failed to cancel ticket. Please try again.');
        }
      }
    });
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

  // Helper to format seconds into nice text (e.g. 2h 15m 30s)
  const formatTimer = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    const parts = [];
    if (hrs > 0) parts.push(`${hrs}h`);
    if (mins > 0 || hrs > 0) parts.push(`${mins}m`);
    parts.push(`${secs}s`);
    
    return parts.join(' ');
  };

  // Helper to get active accumulated timer for a ticket
  const getTicketActiveTime = (ticket) => {
    let totalSecs = ticket.timerAccumulatedSeconds || 0;
    if (ticket.status === 'InProgress' && ticket.timerStartedAt) {
      const elapsed = Math.floor((now.getTime() - new Date(ticket.timerStartedAt).getTime()) / 1000);
      totalSecs += Math.max(0, elapsed);
    }
    return totalSecs;
  };

  // Redesigned Premium Table Columns for Employee tickets
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
      title: 'Live Tracking Time',
      key: 'timer',
      width: 200,
      render: (_, record) => {
        const seconds = getTicketActiveTime(record);
        const isActive = record.status === 'InProgress';
        return (
          <div style={{ 
            background: isActive ? (isDarkMode ? 'rgba(82, 196, 26, 0.15)' : 'rgba(82, 196, 26, 0.08)') : 'transparent',
            padding: isActive ? '6px 12px' : '0px',
            borderRadius: 8,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8
          }}>
            {isActive ? (
              <span className="pulse-dot" />
            ) : (
              <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
            )}
            <Text strong style={{ color: isActive ? '#52c41a' : 'inherit', fontSize: '13px' }}>
              {formatTimer(seconds)}
            </Text>
            {isActive && <Tag color="success" style={{ margin: 0, borderRadius: 4, fontSize: '10px' }}>Active</Tag>}
          </div>
        );
      }
    },
    {
      title: 'Estimation (Consumed / Budget)',
      key: 'estimation',
      width: 240,
      render: (_, record) => (
        <div style={{ minWidth: 160 }}>
          <HoursProgress consumed={record.consumedHours} total={record.estimatedHours} />
        </div>
      )
    },
    {
      title: 'Status Action Controls',
      key: 'actions',
      width: 340,
      render: (_, record) => {
        const status = record.status;
        return (
          <Space size="middle">
            {status !== 'InProgress' ? (
              <Button 
                type="primary" 
                size="small"
                icon={<PlayCircleOutlined />} 
                style={{ background: '#22c55e', borderColor: '#22c55e', borderRadius: 6, fontWeight: 500 }}
                onClick={() => handleStatusChange(record.id, 'InProgress')}
              >
                Start Timer
              </Button>
            ) : (
              <Button 
                danger 
                size="small"
                icon={<PauseCircleOutlined />} 
                style={{ borderRadius: 6, fontWeight: 500 }}
                onClick={() => handleStatusChange(record.id, 'ToDo')}
              >
                Pause Timer
              </Button>
            )}
            {status !== 'InReview' && (
              <Button 
                size="small" 
                icon={<SyncOutlined />} 
                style={{ borderRadius: 6 }}
                onClick={() => handleStatusChange(record.id, 'InReview')}
              >
                Submit Review
              </Button>
            )}
            {status !== 'Done' && (
              <Button 
                type="primary" 
                ghost
                size="small" 
                icon={<CheckCircleOutlined />} 
                style={{ borderRadius: 6, color: '#3b82f6', borderColor: '#3b82f6' }}
                onClick={() => handleStatusChange(record.id, 'Done')}
              >
                Mark Done
              </Button>
            )}
          </Space>
        );
      }
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
      {/* Premium CSS Keyframe Animation Injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        .pulse-dot {
          width: 8px;
          height: 8px;
          background-color: #22c55e;
          border-radius: 50%;
          display: inline-block;
          box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
          animation: pulse 1.5s infinite ease-in-out;
        }
        @keyframes pulse {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
          }
          70% {
            transform: scale(1.1);
            box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
          }
        }
      ` }} />

      <PageHeader 
        title="My Work Tickets" 
        subtitle="Manage assigned tasks, track work hours via live timer, and update progress"
      />

      {/* View Switcher Segment & Alerts */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Segmented
          options={[
            { label: 'Table View (Default)', value: 'table', icon: <TableOutlined /> },
            { label: 'Kanban Board', value: 'board', icon: <AppstoreOutlined /> }
          ]}
          value={viewMode}
          onChange={setViewMode}
        />
        
        <Alert 
          message={
            <Text strong style={{ color: '#1d4ed8' }}>
              💡 Move a ticket to "In Progress" or click "Start Timer" to automatically track and record your EOD hours!
            </Text>
          }
          type="info"
          showIcon
          style={{ borderRadius: 8, padding: '6px 16px' }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Skeleton active />
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState message="No tickets assigned to you yet." />
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
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
      ) : (
        /* KANBAN BOARD VIEW */
        <Row gutter={16}>
          {['ToDo', 'InProgress', 'InReview', 'Done'].map(columnStatus => {
            const columnTickets = tickets.filter(t => t.status === columnStatus);
            const colLabel = {
              ToDo: 'To Do',
              InProgress: 'In Progress',
              InReview: 'In Review',
              Done: 'Done'
            }[columnStatus];
            
            const colColor = {
              ToDo: '#8c8c8c',
              InProgress: '#1890ff',
              InReview: '#fa8c16',
              Done: '#52c41a'
            }[columnStatus];

            return (
              <Col xs={24} sm={12} lg={6} key={columnStatus}>
                <Card 
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{colLabel}</span>
                      <Tag color={columnStatus === 'InProgress' ? 'processing' : 'default'} style={{ borderRadius: 10 }}>
                        {columnTickets.length}
                      </Tag>
                    </div>
                  }
                  headStyle={{ borderTop: `4px solid ${colColor}`, borderRadius: '8px 8px 0 0' }}
                  style={{ 
                    borderRadius: 12, 
                    background: isDarkMode ? '#1c1c1e' : '#f8fafc',
                    minHeight: 500,
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                    border: '1px dashed transparent',
                    transition: 'all 0.2s'
                  }}
                  bodyStyle={{ padding: '12px' }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = colColor;
                    e.currentTarget.style.background = isDarkMode ? '#242427' : '#f1f5f9';
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.background = isDarkMode ? '#1c1c1e' : '#f8fafc';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.background = isDarkMode ? '#1c1c1e' : '#f8fafc';
                    const ticketId = Number(e.dataTransfer.getData('ticketId'));
                    if (ticketId) {
                      handleStatusChange(ticketId, columnStatus);
                    }
                  }}
                >
                  <Space direction="vertical" style={{ width: '100%' }} size={12}>
                    {columnTickets.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                        Empty / Drop tasks here
                      </div>
                    ) : (
                      columnTickets.map(ticket => {
                        const seconds = getTicketActiveTime(ticket);
                        const isTimerActive = ticket.status === 'InProgress';
                        
                        return (
                          <Card 
                            key={ticket.id}
                            hoverable
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('ticketId', String(ticket.id));
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            style={{ 
                              borderRadius: 10,
                              background: isDarkMode ? '#2c2c2e' : '#ffffff',
                              border: isTimerActive ? '2px solid #52c41a' : '1px solid rgba(0,0,0,0.06)',
                              cursor: 'grab'
                            }}
                            bodyStyle={{ padding: '16px' }}
                            onClick={() => openTicketDetail(ticket)}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                              <Text code strong>{ticket.code}</Text>
                              <PriorityBadge priority={ticket.priority} />
                            </div>
                            
                            <Title level={5} style={{ margin: '0 0 8px 0', fontSize: 14 }}>
                              {ticket.title}
                            </Title>
                            
                            <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 12 }}>
                              Project: {ticket.projectName || 'General'}
                            </Text>

                            {/* TIMER COMPONENT */}
                            <div style={{ 
                              background: isTimerActive ? 'rgba(82, 196, 26, 0.08)' : 'rgba(0,0,0,0.02)',
                              padding: '8px 12px',
                              borderRadius: 8,
                              marginBottom: 12,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <Space size={6}>
                                <ClockCircleOutlined style={{ color: isTimerActive ? '#52c41a' : '#8c8c8c' }} />
                                <Text strong style={{ fontSize: 12, color: isTimerActive ? '#52c41a' : 'inherit' }}>
                                  {formatTimer(seconds)}
                                </Text>
                              </Space>
                              {isTimerActive ? (
                                <Tag color="success" style={{ margin: 0 }}>Timer Active</Tag>
                              ) : (
                                <Text type="secondary" style={{ fontSize: 10 }}>Paused</Text>
                              )}
                            </div>

                            <Divider style={{ margin: '10px 0' }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <HoursProgress consumed={ticket.consumedHours} total={ticket.estimatedHours} />
                            </div>

                            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                              {columnStatus !== 'ToDo' && (
                                <Button 
                                  size="small"
                                  icon={<PlayCircleOutlined />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusChange(ticket.id, 'ToDo');
                                  }}
                                >
                                  To Do
                                </Button>
                              )}
                              {columnStatus !== 'InProgress' && (
                                <Button 
                                  size="small"
                                  type="primary"
                                  icon={<PlayCircleOutlined />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusChange(ticket.id, 'InProgress');
                                  }}
                                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                                >
                                  Start Timer
                                </Button>
                              )}
                              {columnStatus !== 'InReview' && (
                                <Button 
                                  size="small"
                                  icon={<SyncOutlined />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusChange(ticket.id, 'InReview');
                                  }}
                                >
                                  Review
                                </Button>
                              )}
                            </div>
                          </Card>
                        );
                      })
                    )}
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Today's EOD Report Floating Action Button */}
      <FloatButton
        icon={<EditOutlined />}
        type="primary"
        style={{ right: 24, bottom: 24 }}
        tooltip={<div>Submit Today's EOD Report</div>}
        onClick={() => navigate('/employee/report')}
      />

      {/* Ticket Details Drawer */}
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
            
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
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
                  <Select.Option value="Done">Done</Select.Option>
                </Select>
              </Space>
            </div>

            <Divider style={{ margin: '8px 0' }} />

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
              <Text strong>Live Tracking Stats</Text>
              <Text>
                Accumulated Time: <Text strong>{formatTimer(getTicketActiveTime(selectedTicket))}</Text>
              </Text>
              <Text>
                Consumed in EOD: <Text strong>{selectedTicket.consumedHours} hrs</Text>
              </Text>
              <Text>
                Est. Limit: <Text strong>{selectedTicket.estimatedHours} hrs</Text>
              </Text>
            </Space>

            <Space direction="vertical">
              <Text strong>Due Date</Text>
              <Text>{selectedTicket.dueDate ? dayjs(selectedTicket.dueDate).format('DD MMM YYYY') : 'No Due Date'}</Text>
            </Space>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default MyTicketsPage;
