import React, { useState, useEffect } from 'react';
import { 
  Row, Col, Card, Typography, Button, Drawer, Space, 
  Skeleton, notification, FloatButton, Tag, Divider,
  Alert
} from 'antd';
import { 
  ClockCircleOutlined, SyncOutlined, PlayCircleOutlined,
  EditOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { ticketService } from '../../services/ticketService';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import PageHeader from '../../components/common/PageHeader';
import PriorityBadge from '../../components/common/PriorityBadge';
import HoursProgress from '../../components/common/HoursProgress';

const { Title, Text, Paragraph } = Typography;

const EmployeeKanbanPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
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
      setTickets(response.data || []);
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

  const getTicketActiveTime = (ticket) => {
    let totalSecs = ticket.timerAccumulatedSeconds || 0;
    if (ticket.status === 'InProgress' && ticket.timerStartedAt) {
      const elapsed = Math.floor((now.getTime() - new Date(ticket.timerStartedAt).getTime()) / 1000);
      totalSecs += Math.max(0, elapsed);
    }
    return totalSecs;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader 
        title="My Work Kanban Board" 
        subtitle="Movable Kanban Board. Drag-and-drop or use quick status actions to sync task updates."
      />

      <Alert 
        message={
          <Text strong style={{ color: '#1d4ed8' }}>
            💡 Drag and drop the tickets from ToDo To Inprogress to start the timer and track the hours.
          </Text>
        }
        type="info"
        showIcon
        style={{ borderRadius: 8, padding: '10px 16px', marginBottom: 8 }}
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
                    minHeight: 520,
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

                            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                              {columnStatus !== 'ToDo' && (
                                <Button 
                                  size="small"
                                  icon={<PlayCircleOutlined />}
                                  onClick={() => handleStatusChange(ticket.id, 'ToDo')}
                                >
                                  To Do
                                </Button>
                              )}
                              {columnStatus !== 'InProgress' && (
                                <Button 
                                  size="small"
                                  type="primary"
                                  icon={<PlayCircleOutlined />}
                                  onClick={() => handleStatusChange(ticket.id, 'InProgress')}
                                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                                >
                                  Start Timer
                                </Button>
                              )}
                              {columnStatus !== 'InReview' && (
                                <Button 
                                  size="small"
                                  icon={<SyncOutlined />}
                                  onClick={() => handleStatusChange(ticket.id, 'InReview')}
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
        title={`Ticket: ${selectedTicket?.code}`}
        placement="right"
        width={500}
        onClose={() => setIsDrawerOpen(false)}
        open={isDrawerOpen}
        extra={
          <Space>
            <Button onClick={() => setIsDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSaveProgress} loading={saving}>
              Save Progress
            </Button>
          </Space>
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
                <Tag color={selectedTicket.status === 'Done' ? 'green' : 'blue'}>
                  {selectedTicket.status}
                </Tag>
              </Col>
            </Row>

            <div>
              <Text type="secondary" block style={{ marginBottom: 6 }}>Estimated Budget vs Actual Consumed</Text>
              <HoursProgress consumed={selectedTicket.consumedHours} total={selectedTicket.estimatedHours} />
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

export default EmployeeKanbanPage;
