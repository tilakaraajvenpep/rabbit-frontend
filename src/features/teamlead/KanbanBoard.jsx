import React, { useState, useEffect } from 'react';
import { 
  Layout, Typography, Card, Badge, Avatar, Tooltip, Space, Button, 
  Drawer, Skeleton, Select, theme, Modal, message, Form, Input, Alert 
} from 'antd';
import { 
  DndContext, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  closestCorners,
  useDroppable
} from '@dnd-kit/core';
import { 
  SortableContext, 
  verticalListSortingStrategy, 
  useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useParams, useNavigate } from 'react-router-dom';
import { PlusOutlined, UserOutlined, CalendarOutlined, DeleteOutlined, EditOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ticketService } from '../../services/ticketService';
import { projectService } from '../../services/projectService';
import { adminService } from '../../services/adminService';
import { useTicketStore } from '../../store/ticketStore';
import { useAuthStore } from '../../store/authStore';
import { mockUsers } from '../../mocks/mockUsers';
import { useThemeStore } from '../../store/themeStore';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import PriorityBadge from '../../components/common/PriorityBadge';
import CreateTicketModal from './CreateTicketModal';

const { Content } = Layout;
const { Title, Text } = Typography;

// Sortable Ticket Card
const SortableTicket = ({ ticket, onClick, user, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: ticket.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginBottom: 12,
    cursor: 'pointer'
  };

  const isOverdue = ticket.dueDate && new Date(ticket.dueDate) < new Date() && ticket.status !== 'Done';

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card 
        size="small" 
        hoverable 
        style={{ borderLeft: `4px solid ${getPriorityColor(ticket.priority)}` }}
        onClick={() => onClick(ticket)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: '12px' }}><code>{ticket.ticketCode || ticket.code}</code></Text>
          <Space size={4}>
            <PriorityBadge priority={ticket.priority} />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              style={{ padding: '0 4px', height: 'auto' }}
              onClick={(e) => { e.stopPropagation(); onDelete(ticket); }}
            />
          </Space>
        </div>
        <Title level={5} style={{ margin: '0 0 12px 0' }} ellipsis={{ rows: 2 }}>{ticket.title}</Title>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Tooltip title={user?.name || 'Unassigned'}>
              <Avatar size="small" src={user?.avatar} icon={<UserOutlined />} />
            </Tooltip>
            <Text type="secondary" style={{ fontSize: '12px' }}>{ticket.estimatedHours}h</Text>
          </Space>
          {ticket.dueDate && (
            <Space>
              <CalendarOutlined style={{ color: isOverdue ? '#ff4d4f' : '#8c8c8c' }} />
              <Text style={{ fontSize: '11px', color: isOverdue ? '#ff4d4f' : '#8c8c8c' }}>
                {dayjs(ticket.dueDate).format('DD MMM YYYY')}
              </Text>
            </Space>
          )}
        </div>
      </Card>
    </div>
  );
};

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'Critical': return '#ff4d4f';
    case 'High': return '#fa8c16';
    case 'Medium': return '#1890ff';
    case 'Low': return '#52c41a';
    default: return '#d9d9d9';
  }
};

// Droppable Column Component
const DroppableColumn = ({ colId, tickets, openTicketDetail, onDeleteTicket, isDarkMode, token, users, customTitles }) => {
  const { setNodeRef } = useDroppable({ id: colId });
  const displayTitle = customTitles?.[colId] || colId.replace(/([A-Z])/g, ' $1').trim();

  return (
    <div style={{ 
      width: 300, 
      minWidth: 300, 
      background: isDarkMode ? '#18181b' : '#f5f5f5', 
      borderRadius: 8, 
      padding: 12,
      border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
        <Title level={5} style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
          {displayTitle}
        </Title>
        <Badge count={tickets.length} style={{ backgroundColor: isDarkMode ? '#3f3f46' : '#bfbfbf', color: isDarkMode ? '#f4f4f5' : undefined }} />
      </div>

      <SortableContext id={colId} items={tickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} style={{ minHeight: 400, height: '100%', paddingBottom: 20 }}>
          {tickets.map(ticket => {
            const user = users.find(u => u.id === ticket.assignedToUserId) || mockUsers.find(u => u.id === ticket.assignedToUserId);
            return <SortableTicket key={ticket.id} ticket={ticket} onClick={openTicketDetail} onDelete={onDeleteTicket} user={user} />;
          })}
        </div>
      </SortableContext>
    </div>
  );
};

const KanbanBoard = () => {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const { isDarkMode } = useThemeStore();
  const { user: authUser } = useAuthStore();
  const { kanbanColumns, setTickets, moveTicket } = useTicketStore();

  const [allProjects, setAllProjects] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [users, setUsers] = useState([]);

  // Submit to TL states
  const [selectedTLForSubmit, setSelectedTLForSubmit] = useState(null);
  const [submittingTL, setSubmittingTL] = useState(false);

  // Edit Headings states
  const [isHeadingsModalOpen, setIsHeadingsModalOpen] = useState(false);
  const [headingsForm] = Form.useForm();

  const isManager = authUser?.role === 'ProjectManager' || authUser?.role === 'TenantAdmin';
  const project = allProjects.find(p => String(p.id) === String(projectId));

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchProjects();
    fetchUsers();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await projectService.getProjects();
      setAllProjects(res.data);
    } catch (error) {
      console.error('Failed to fetch projects');
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await adminService.getUsers();
      setUsers(res.data);
    } catch (error) {
      console.error('Failed to fetch users');
    }
  };

  useEffect(() => {
    if (projectId) {
      loadTickets();
    }
  }, [projectId]);

  const loadTickets = async () => {
    const res = await ticketService.getTickets(projectId);
    setTickets(res.data);
  };

  const handleProjectChange = (id) => {
    const routePrefix = isManager ? 'pm' : 'teamlead';
    navigate(`/${routePrefix}/projects/${id}/kanban`);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const ticketId = active.id;
    const overId = over.id;

    // Find which column the overId belongs to
    let toCol = '';
    if (['ToDo', 'InProgress', 'InReview', 'Done'].includes(overId)) {
      toCol = overId;
    } else {
      // Find column containing the target ticket
      for (const col in kanbanColumns) {
        if (kanbanColumns[col].find(t => t.id === overId)) {
          toCol = col;
          break;
        }
      }
    }

    // Find original column
    let fromCol = '';
    for (const col in kanbanColumns) {
      if (kanbanColumns[col].find(t => t.id === ticketId)) {
        fromCol = col;
        break;
      }
    }

    if (fromCol && toCol && fromCol !== toCol) {
      moveTicket(ticketId, fromCol, toCol);
      await ticketService.updateTicketStatus(ticketId, toCol);
    }
  };

  const openTicketDetail = (ticket) => {
    setSelectedTicket(ticket);
    setIsDrawerOpen(true);
  };

  const handleDeleteTicket = (ticket) => {
    Modal.confirm({
      title: 'Delete this ticket?',
      content: `Permanently delete ticket "${ticket.ticketCode || ticket.code} - ${ticket.title}"? This cannot be undone.`,
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
          await ticketService.deleteTicket(ticket.id);
          message.success('Ticket deleted successfully.');
          loadTickets();
        } catch (error) {
          console.error('Failed to delete ticket', error);
          message.error('Failed to delete ticket. Please try again.');
        }
      }
    });
  };

  const handleSubmitToTeamLead = async () => {
    if (!selectedTLForSubmit) return;
    setSubmittingTL(true);
    try {
      await projectService.updateStatus(projectId, {
        status: 'InProgress',
        assignedTeamLeadId: Number(selectedTLForSubmit),
        note: 'Project assigned and active.'
      });
      message.success('Project successfully submitted to the selected Team Lead!');
      fetchProjects();
    } catch (err) {
      message.error('Failed to submit project to Team Lead.');
    } finally {
      setSubmittingTL(false);
    }
  };

  const handleOpenHeadingsModal = () => {
    const currentTitles = project?.kanbanColumns || {
      ToDo: 'To Do',
      InProgress: 'In Progress',
      InReview: 'In Review',
      Done: 'Done'
    };
    headingsForm.setFieldsValue(currentTitles);
    setIsHeadingsModalOpen(true);
  };

  const handleSaveHeadings = async (values) => {
    try {
      await projectService.updateStatus(projectId, {
        kanbanColumns: values,
        status: project.status
      });
      message.success('Kanban headings updated successfully!');
      setIsHeadingsModalOpen(false);
      fetchProjects();
    } catch (err) {
      message.error('Failed to save Kanban column headings.');
    }
  };

  const currentAssignee = selectedTicket ? (
    users.find(u => u.id === selectedTicket.assignedToUserId) || 
    mockUsers.find(u => u.id === selectedTicket.assignedToUserId)
  ) : null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader 
        title="Kanban Board" 
        extra={
          <Space>
            <Select
              placeholder="Select Project"
              style={{ width: 250 }}
              value={projectId ? String(projectId) : undefined}
              onChange={handleProjectChange}
              options={allProjects.map(p => ({ label: p.name, value: String(p.id) }))}
            />
            {projectId && isManager && (
              <Button icon={<EditOutlined />} onClick={handleOpenHeadingsModal}>
                Edit Headings
              </Button>
            )}
            {projectId && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>Create Ticket</Button>
            )}
          </Space>
        }
      />

      {/* Submit to Team Lead banner */}
      {projectId && project?.status === 'Approved' && isManager && (
        <Alert
          message={
            <Text strong style={{ fontSize: '15px' }}>
              📢 Project Approved & Tickets Auto-Generated
            </Text>
          }
          description={
            <div style={{ marginTop: 8 }}>
              <p style={{ margin: '0 0 12px 0' }}>
                Please review the auto-generated tickets in the board below. Once ready, select a Team Lead to assign and activate the project.
              </p>
              <Space>
                <Select
                  placeholder="Select Team Lead"
                  style={{ width: 250 }}
                  onChange={setSelectedTLForSubmit}
                  options={users.filter(u => u.role === 'TeamLead').map(u => ({ label: u.name || u.fullName, value: u.id }))}
                />
                <Button 
                  type="primary" 
                  icon={<TeamOutlined />} 
                  onClick={handleSubmitToTeamLead}
                  disabled={!selectedTLForSubmit}
                  loading={submittingTL}
                >
                  Submit to Team Lead
                </Button>
              </Space>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 20, borderRadius: 8 }}
        />
      )}

      {projectId ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', flex: 1, paddingBottom: 16 }}>
            {Object.entries(kanbanColumns).map(([colId, tickets]) => (
              <DroppableColumn
                key={colId}
                colId={colId}
                tickets={tickets}
                openTicketDetail={openTicketDetail}
                onDeleteTicket={handleDeleteTicket}
                isDarkMode={isDarkMode}
                token={token}
                users={users}
                customTitles={project?.kanbanColumns}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <Card style={{ textAlign: 'center', padding: '40px 0' }}>
          <Text type="secondary">Please select a project to load the Kanban board.</Text>
        </Card>
      )}

      <Drawer
        title={selectedTicket?.ticketCode || selectedTicket?.code}
        placement="right"
        width={480}
        onClose={() => setIsDrawerOpen(false)}
        open={isDrawerOpen}
      >
        {selectedTicket && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Title level={4}>{selectedTicket.title}</Title>
              <Text type="secondary">{selectedTicket.description}</Text>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Space direction="vertical">
                <Text strong>Priority</Text>
                <PriorityBadge priority={selectedTicket.priority} />
              </Space>
              <Space direction="vertical">
                <Text strong>Status</Text>
                <StatusBadge status={selectedTicket.status} />
              </Space>
            </div>

            <Space direction="vertical">
              <Text strong>Assignee</Text>
              <Space>
                <Avatar src={currentAssignee?.avatar} icon={<UserOutlined />} />
                <Text>{currentAssignee?.name || 'Unassigned'}</Text>
              </Space>
            </Space>

            <Space direction="vertical">
              <Text strong>Estimated Hours</Text>
              <Text>{selectedTicket.estimatedHours} hrs</Text>
            </Space>

            <Space direction="vertical">
              <Text strong>Due Date</Text>
              <Text>
                {selectedTicket.dueDate 
                  ? dayjs(selectedTicket.dueDate).format('DD MMM YYYY') 
                  : 'No Due Date'
                }
              </Text>
            </Space>
          </Space>
        )}
      </Drawer>

      <CreateTicketModal 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        projectId={projectId} 
        onSuccess={loadTickets} 
      />

      {/* Edit Headings Modal */}
      <Modal
        title="Modify Kanban Column Headings"
        open={isHeadingsModalOpen}
        onCancel={() => setIsHeadingsModalOpen(false)}
        onOk={() => headingsForm.submit()}
        okText="Save Headings"
      >
        <Form
          form={headingsForm}
          layout="vertical"
          onFinish={handleSaveHeadings}
        >
          <Form.Item name="ToDo" label="To Do Column Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="InProgress" label="In Progress Column Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="InReview" label="In Review Column Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="Done" label="Done Column Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default KanbanBoard;
