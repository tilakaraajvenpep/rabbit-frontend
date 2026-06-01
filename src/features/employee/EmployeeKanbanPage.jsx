import React, { useState, useEffect } from 'react';
import { 
  Row, Col, Card, Typography, Button, Drawer, Space, 
  Skeleton, notification, FloatButton, Tag, Divider,
  Alert, Select, Avatar
} from 'antd';
import { 
  ClockCircleOutlined, SyncOutlined, PlayCircleOutlined,
  EditOutlined, UserOutlined, LockOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { ticketService } from '../../services/ticketService';
import { projectService } from '../../services/projectService';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import PageHeader from '../../components/common/PageHeader';
import PriorityBadge from '../../components/common/PriorityBadge';
import HoursProgress from '../../components/common/HoursProgress';

const { Title, Text, Paragraph } = Typography;

const DEFAULT_COLUMNS = [
  { key: 'ToDo', title: 'To Do' },
  { key: 'InProgress', title: 'In Progress' },
  { key: 'InReview', title: 'In Review' },
  { key: 'Done', title: 'Done' },
];

const deriveColumnConfig = (kanbanColumns) => {
  if (!kanbanColumns) return DEFAULT_COLUMNS;
  if (Array.isArray(kanbanColumns)) return kanbanColumns;
  return Object.entries(kanbanColumns).map(([key, title]) => ({ key, title }));
};

const EmployeeKanbanPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Project selector state
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  
  // Progress Reporting State
  const [progressState, setProgressState] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Live timer tick state
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetchMyTickets();
    fetchProjects();
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchMyTickets();
        fetchProjects();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [currentUser.userId || currentUser.id]);

  const fetchProjects = async () => {
    try {
      const response = await projectService.getProjects();
      setProjects(response.data || []);
    } catch (err) {
      console.error('Failed to load projects', err);
    }
  };

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
      let ticketsData = response.data || [];
      
      // Filter out backlog tickets (overdue and not completed)
      ticketsData = ticketsData.filter(t => {
        const isBacklog = t.dueDate && dayjs(t.dueDate).isBefore(dayjs(), 'day') && t.status !== 'Done';
        return !isBacklog;
      });

      // Filter only tickets assigned to the logged-in user for TL / PM roles
      if (currentUser && currentUser.role !== 'Employee') {
        const myUserId = currentUser.userId || currentUser.id;
        ticketsData = ticketsData.filter(t => t.assignedToUserId === myUserId);
      }

      setTickets(ticketsData);
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load tickets.' });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (ticketId, newStatus) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (newStatus === 'Done' && currentUser.role === 'Employee') {
      if (ticket && !ticket.approvedForDone) {
        notification.error({
          message: 'Action Blocked',
          description: 'You can move a ticket to Done stage only after your Team Leader gives permission/approval.'
        });
        return;
      }
    }

    try {
      await ticketService.updateTicketStatus(ticketId, newStatus);
      notification.success({ 
        message: 'Status Updated', 
        description: `Ticket status successfully changed to ${newStatus}.`
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
        title={currentUser?.role === 'Employee' ? "My Work Kanban Board" : "My Personal Kanban Board"} 
        subTitle="Movable Kanban Board. Drag-and-drop or use quick status actions to sync task updates."
      />

      <Alert 
        message={
          <Text strong style={{ color: '#1d4ed8' }}>
            💡 Drag and drop the tickets across columns to update their status.
          </Text>
        }
        type="info"
        showIcon
        style={{ borderRadius: 8, padding: '10px 16px', marginBottom: 8 }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Text strong>Filter by Project:</Text>
        <Select
          style={{ width: 350 }}
          value={selectedProjectId}
          onChange={(val) => setSelectedProjectId(val)}
          options={[
            { value: 'all', label: '📂 All Projects (Default Columns)' },
            ...projects.map(p => ({
              value: String(p.id),
              label: `📁 ${p.name} (${p.code})`
            }))
          ]}
          placeholder="Select Project Name"
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Skeleton active />
        </div>
      ) : (
        /* KANBAN BOARD VIEW */
        (() => {
          const filteredTickets = selectedProjectId === 'all'
            ? tickets
            : tickets.filter(t => String(t.projectId) === String(selectedProjectId));

          const selectedProject = projects.find(p => String(p.id) === String(selectedProjectId));
          const activeColumns = selectedProject ? deriveColumnConfig(selectedProject.kanbanColumns) : DEFAULT_COLUMNS;

          return (
            <div className="kanban-board-container" style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16, width: '100%' }}>
              {activeColumns.map((col, idx) => {
                const columnStatus = col.key;
                const columnTickets = filteredTickets.filter(t => t.status === columnStatus);
                const colLabel = col.title;
                
                const colColors = {
                  ToDo: '#8c8c8c',
                  InProgress: '#1890ff',
                  InReview: '#fa8c16',
                  Done: '#52c41a'
                };
                const colColor = colColors[columnStatus] || `hsl(${(idx * 75) % 360}, 70%, 50%)`;

                return (
                  <div key={columnStatus} style={{ width: 280, minWidth: 260, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
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
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                      bodyStyle={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}
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
                      <Space direction="vertical" style={{ width: '100%', flex: 1 }} size={12}>
                        {columnTickets.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                            Empty / Drop tasks here
                          </div>
                        ) : (
                          columnTickets.map(ticket => {
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
                                  border: '1px solid rgba(0,0,0,0.06)',
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

                                <Divider style={{ margin: '10px 0' }} />

                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                  <Avatar size="small" src={currentUser?.avatar} icon={<UserOutlined />} />
                                  <span 
                                    style={{ 
                                      fontSize: '12px', 
                                      fontWeight: 600, 
                                      color: isDarkMode ? '#e4e4e7' : '#3f3f46',
                                      maxWidth: '120px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      display: 'inline-block'
                                    }}
                                  >
                                    {currentUser?.name || currentUser?.fullName}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  {ticket.status === 'InReview' && (
                                    <div style={{ marginTop: 4 }}>
                                      {ticket.approvedForDone ? (
                                        <Tag color="success" style={{ fontWeight: 600, fontSize: 11 }}>
                                          ✓ Approved for Done
                                        </Tag>
                                      ) : (
                                        <Tag color="warning" style={{ fontWeight: 600, fontSize: 11 }}>
                                          ⚠ Awaiting TL Approval
                                        </Tag>
                                      )}
                                    </div>
                                  )}
                                </div>


                              </Card>
                            );
                          })
                        )}
                      </Space>
                    </Card>
                  </div>
                );
              })}
            </div>
          );
        })()
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

            {currentUser.role === 'Employee' && (
              <div>
                <Text type="secondary" block style={{ marginBottom: 6 }}>Team Leader Approval Status</Text>
                {selectedTicket.approvedForDone ? (
                  <Tag color="success" style={{ fontWeight: 600 }}>✓ Approved for Done stage</Tag>
                ) : (
                  <Tag color="warning" style={{ fontWeight: 600 }}>⚠ Awaiting Team Leader Approval (InReview)</Tag>
                )}
              </div>
            )}



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
