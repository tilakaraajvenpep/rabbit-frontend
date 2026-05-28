import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layout, Typography, Card, Badge, Avatar, Tooltip, Space, Button, 
  Drawer, Select, theme, Modal, message, Input, Alert, Form, DatePicker, InputNumber, Tag 
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
import { PlusOutlined, UserOutlined, CalendarOutlined, DeleteOutlined, EditOutlined, TeamOutlined, MinusCircleOutlined, HolderOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ticketService } from '../../services/ticketService';
import { projectService } from '../../services/projectService';
import { adminService } from '../../services/adminService';
import { useAuthStore } from '../../store/authStore';
import { mockUsers } from '../../mocks/mockUsers';
import { useThemeStore } from '../../store/themeStore';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import PriorityBadge from '../../components/common/PriorityBadge';
import CreateTicketModal from './CreateTicketModal';

const { Content } = Layout;
const { Title, Text } = Typography;

const DEFAULT_COLUMNS = [
  { key: 'ToDo', title: 'To Do' },
  { key: 'InProgress', title: 'In Progress' },
  { key: 'InReview', title: 'In Review' },
  { key: 'Done', title: 'Done' },
];

// Derive column config from stored project.kanbanColumns (array or legacy object)
const deriveColumnConfig = (kanbanColumns) => {
  if (!kanbanColumns) return DEFAULT_COLUMNS;
  if (Array.isArray(kanbanColumns)) return kanbanColumns;
  // Legacy object format: { ToDo: 'title', ... }
  return Object.entries(kanbanColumns).map(([key, title]) => ({ key, title }));
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

// Sortable Column Item component for Modifying Kanban Column Headings
const SortableColumnItem = ({ col, idx, onTitleChange, onRemove, length }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: col.key });
  
  const itemStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: 'rgba(128,128,128,0.05)',
    border: '1px solid rgba(128,128,128,0.1)',
    borderRadius: 8,
    marginBottom: 8
  };

  return (
    <div ref={setNodeRef} style={itemStyle}>
      <div {...attributes} {...listeners} style={{ cursor: 'grab', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
        <HolderOutlined style={{ color: '#8c8c8c', fontSize: 16 }} />
      </div>
      <Text style={{ minWidth: 90, flexShrink: 0, fontWeight: 500 }}>
        Column {idx + 1}
      </Text>
      <Input
        value={col.title}
        onChange={(e) => onTitleChange(idx, e.target.value)}
        placeholder={`Column ${idx + 1}`}
        style={{ flex: 1 }}
      />
      <Button
        type="text"
        danger
        icon={<MinusCircleOutlined />}
        onClick={() => onRemove(idx)}
        disabled={length <= 1}
        title="Remove column"
      />
    </div>
  );
};

// Sortable Ticket Card
const SortableTicket = ({ ticket, onClick, user, onDelete, onEdit, canEdit, isDarkMode, isDragDisabled }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ 
    id: ticket.id,
    disabled: isDragDisabled
  });

  const style = { 
    transform: CSS.Transform.toString(transform), 
    transition, 
    marginBottom: 12, 
    cursor: isDragDisabled ? 'not-allowed' : 'pointer' 
  };
  const isOverdue = ticket.dueDate && new Date(ticket.dueDate) < new Date() && ticket.status !== 'Done';

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card 
        size="small" 
        hoverable 
        style={{ 
          borderLeft: `4px solid ${getPriorityColor(ticket.priority)}`,
          borderRadius: 12,
          boxShadow: isDarkMode 
            ? '0 4px 12px rgba(0, 0, 0, 0.4)' 
            : '0 4px 12px rgba(0, 0, 0, 0.03)',
          background: isDarkMode ? '#1f1f23' : '#ffffff',
          border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        bodyStyle={{ padding: '14px 16px' }}
        onClick={() => onClick(ticket)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
          <Tag color={isDarkMode ? 'zinc' : 'default'} style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 11, borderRadius: 4, margin: 0 }}>
            {ticket.ticketCode || ticket.code}
          </Tag>
          <Space size={6}>
            <PriorityBadge priority={ticket.priority} />
            {canEdit && (
              <Space size={2} onClick={e => e.stopPropagation()}>
                <Button
                  size="small" type="text" icon={<EditOutlined />}
                  style={{ padding: '0 4px', height: 'auto', color: '#6366f1' }}
                  onClick={() => onEdit(ticket)}
                />
                <Button
                  size="small" type="text" danger icon={<DeleteOutlined />}
                  style={{ padding: '0 4px', height: 'auto' }}
                  onClick={() => onDelete(ticket)}
                />
              </Space>
            )}
          </Space>
        </div>
        <Title level={5} style={{ margin: '0 0 12px 0', fontSize: '13.5px', fontWeight: 600, lineHeight: 1.4 }} ellipsis={{ rows: 2 }}>
          {ticket.title}
        </Title>
        {user?.role === 'ProjectManager' && (
          <div style={{ marginBottom: 12 }}>
            <Tag color="gold" style={{ fontSize: '11px', fontWeight: 600, borderRadius: 4 }}>
              👑 Assigned to PM ({user?.name || user?.fullName})
            </Tag>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size={8}>
            <Tooltip title={user ? `${user.name || user.fullName} (${user.role})` : 'Unassigned'}>
              <Avatar size="small" src={user?.avatar} icon={<UserOutlined />} />
            </Tooltip>
            {user ? (
              <span 
                style={{ 
                  fontSize: '12px', 
                  fontWeight: 600, 
                  color: isDarkMode ? '#e4e4e7' : '#3f3f46',
                  maxWidth: '120px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                  verticalAlign: 'middle'
                }}
              >
                {user.name || user.fullName}
              </span>
            ) : (
              <span style={{ fontSize: '11px', color: '#a1a1aa', fontStyle: 'italic' }}>
                Not Assigned
              </span>
            )}
            <Tag color="purple" style={{ fontSize: '10px', borderRadius: 4, margin: 0, fontWeight: 500 }}>
              {ticket.estimatedHours}h
            </Tag>
          </Space>
          {ticket.dueDate && (
            <Tag 
              color={isOverdue ? 'red' : 'default'} 
              style={{ 
                fontSize: '10px', 
                borderRadius: 4, 
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <CalendarOutlined style={{ color: isOverdue ? '#ef4444' : '#8c8c8c' }} />
              <span style={{ color: isOverdue ? '#ef4444' : '#64748b', fontWeight: 500 }}>
                {dayjs(ticket.dueDate).format('DD MMM')}
              </span>
            </Tag>
          )}
        </div>
      </Card>
    </div>
  );
};

// Droppable Column Component — receives displayTitle directly
const DroppableColumn = ({ colId, displayTitle, tickets, openTicketDetail, onDeleteTicket, onEditTicket, isDarkMode, token, users, canEdit, authRole }) => {
  const { setNodeRef } = useDroppable({ id: colId });

  const colColors = {
    ToDo: '#64748b',
    InProgress: '#6366f1',
    InReview: '#f59e0b',
    Done: '#10b981'
  };
  const borderTopColor = colColors[colId] || '#d9d9d9';

  return (
    <div style={{ 
      width: 300, minWidth: 300, 
      background: isDarkMode ? '#131316' : '#f8fafc', 
      borderRadius: 14, padding: 14,
      border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'}`,
      borderTop: `4px solid ${borderTopColor}`,
      boxShadow: isDarkMode 
        ? '0 10px 15px -3px rgba(0,0,0,0.3)' 
        : '0 4px 6px -1px rgba(0,0,0,0.02)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center', padding: '0 4px' }}>
        <span style={{ fontSize: '14.5px', fontWeight: 700, color: isDarkMode ? '#f4f4f5' : '#1e293b' }}>
          {displayTitle}
        </span>
        <Badge 
          count={tickets.length} 
          style={{ 
            backgroundColor: borderTopColor, 
            color: '#ffffff',
            fontWeight: 'bold',
            borderRadius: 8
          }} 
        />
      </div>
      <SortableContext id={colId} items={tickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} style={{ minHeight: 450, height: '100%', paddingBottom: 20 }}>
          {tickets.map(ticket => {
            const user = users.find(u => u.id === ticket.assignedToUserId) || mockUsers.find(u => u.id === ticket.assignedToUserId);
            const isDragDisabled = user?.role === 'ProjectManager' && authRole === 'TeamLead';
            return (
              <SortableTicket 
                key={ticket.id} 
                ticket={ticket} 
                onClick={openTicketDetail} 
                onDelete={onDeleteTicket} 
                onEdit={onEditTicket} 
                user={user} 
                canEdit={canEdit}
                isDarkMode={isDarkMode}
                isDragDisabled={isDragDisabled}
              />
            );
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
  const { currentUser: authUser, role: authRole } = useAuthStore();

  const [allProjects, setAllProjects] = useState([]);
  const [allTickets, setAllTickets] = useState([]);  // local ticket state — drives board rendering
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [users, setUsers] = useState([]);

  // Submit to TL states
  const [selectedTLForSubmit, setSelectedTLForSubmit] = useState(null);
  const [submittingTL, setSubmittingTL] = useState(false);

  // Edit Headings states
  const [isHeadingsModalOpen, setIsHeadingsModalOpen] = useState(false);
  const [columnList, setColumnList] = useState(DEFAULT_COLUMNS); // [{key, title}]
  const [savingHeadings, setSavingHeadings] = useState(false);

  // Edit Ticket states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [editForm] = Form.useForm();
  const [savingTicket, setSavingTicket] = useState(false);

  const isManager = authRole === 'ProjectManager' || authRole === 'TenantAdmin'
    || authUser?.role === 'ProjectManager' || authUser?.role === 'TenantAdmin';
  const canEdit = authRole === 'ProjectManager' || authRole === 'TenantAdmin' || authRole === 'TeamLead'
    || authUser?.role === 'ProjectManager' || authUser?.role === 'TenantAdmin' || authUser?.role === 'TeamLead';
  const project = allProjects.find(p => String(p.id) === String(projectId));

  // Effective column config — from saved project data or defaults
  const effectiveColumnList = useMemo(() => deriveColumnConfig(project?.kanbanColumns), [project]);

  const nonBacklogTickets = useMemo(() => {
    return allTickets.filter(t => {
      const isOverdue = t.dueDate && dayjs(t.dueDate).isBefore(dayjs(), 'day') && t.status !== 'Done';
      return !isOverdue;
    });
  }, [allTickets]);

  // Filter tickets by selected assignee
  const filteredTickets = useMemo(() => {
    if (selectedAssigneeId === 'all') return nonBacklogTickets;
    return nonBacklogTickets.filter(t => String(t.assignedToUserId) === String(selectedAssigneeId));
  }, [nonBacklogTickets, selectedAssigneeId]);

  // Local kanban columns derived from filteredTickets + effectiveColumnList
  const localColumns = useMemo(() => {
    const result = {};
    effectiveColumnList.forEach(({ key }) => {
      result[key] = filteredTickets.filter(t => t.status === key);
    });
    return result;
  }, [filteredTickets, effectiveColumnList]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    fetchProjects();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (projectId && !isNaN(Number(projectId))) {
      loadTickets(projectId);
      setSelectedAssigneeId('all');
    }
  }, [projectId]);

  const fetchProjects = async () => {
    try {
      const res = await projectService.getProjects();
      setAllProjects(res.data);
      if ((!projectId || isNaN(Number(projectId))) && res.data && res.data.length > 0) {
        const routePrefix = (authRole === 'ProjectManager' || authRole === 'TenantAdmin' || authUser?.role === 'ProjectManager' || authUser?.role === 'TenantAdmin') ? 'pm' : 'teamlead';
        navigate(`/${routePrefix}/projects/${res.data[0].id}/kanban`, { replace: true });
      }
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

  const loadTickets = async (pid) => {
    try {
      const res = await ticketService.getTickets(pid || projectId);
      setAllTickets(res.data);
    } catch (err) {
      console.error('Failed to load tickets', err);
    }
  };

  const handleProjectChange = (id) => {
    const routePrefix = isManager ? 'pm' : 'teamlead';
    navigate(`/${routePrefix}/projects/${id}/kanban`);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const ticketId = active.id;

    // Block Team Lead from dragging tickets assigned to the PM
    if (authRole === 'TeamLead') {
      const activeTicket = allTickets.find(t => t.id === ticketId);
      if (activeTicket) {
        const assigneeObj = users.find(u => (u.id || u.userId) === activeTicket.assignedToUserId) || mockUsers.find(u => (u.id || u.userId) === activeTicket.assignedToUserId);
        if (assigneeObj?.role === 'ProjectManager') {
          message.error('Team Leads cannot move tickets assigned to the Project Manager.');
          return;
        }
      }
    }

    const overId = over.id;
    const allColKeys = effectiveColumnList.map(c => c.key);

    let toCol = '';
    if (allColKeys.includes(overId)) {
      toCol = overId;
    } else {
      for (const col of allColKeys) {
        if (localColumns[col]?.find(t => t.id === overId)) {
          toCol = col;
          break;
        }
      }
    }

    let fromCol = '';
    for (const col of allColKeys) {
      if (localColumns[col]?.find(t => t.id === ticketId)) {
        fromCol = col;
        break;
      }
    }

    if (fromCol && toCol && fromCol !== toCol) {
      // Optimistic update
      setAllTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: toCol } : t));
      try {
        await ticketService.updateTicketStatus(ticketId, toCol);
      } catch (err) {
        // Revert on failure
        setAllTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: fromCol } : t));
        message.error('Failed to move ticket.');
      }
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
          loadTickets(projectId);
        } catch (error) {
          message.error('Failed to delete ticket. Please try again.');
        }
      }
    });
  };

  const handleSubmitToTeamLead = async () => {
    if (!selectedTLForSubmit) return;
    setSubmittingTL(true);
    try {
      await projectService.updateProjectStatus(projectId, {
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

  // --- Dynamic Headings Modal ---
  const handleOpenHeadingsModal = () => {
    setColumnList(effectiveColumnList.length > 0 ? [...effectiveColumnList] : [...DEFAULT_COLUMNS]);
    setIsHeadingsModalOpen(true);
  };

  const handleAddColumn = () => {
    const newKey = `col_${Date.now()}`;
    setColumnList(prev => [...prev, { key: newKey, title: `Column ${prev.length + 1}` }]);
  };

  const handleRemoveColumn = (idx) => {
    if (columnList.length <= 1) {
      message.warning('You must have at least one column.');
      return;
    }
    setColumnList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleColumnTitleChange = (idx, value) => {
    setColumnList(prev => prev.map((col, i) => i === idx ? { ...col, title: value } : col));
  };

  const handleSaveHeadings = async () => {
    const hasEmpty = columnList.some(c => !c.title.trim());
    if (hasEmpty) {
      message.error('All column titles must be non-empty.');
      return;
    }
    setSavingHeadings(true);
    try {
      await projectService.updateProjectStatus(projectId, {
        kanbanColumns: columnList,   // stored as array
        status: project.status
      });
      message.success('Kanban column headings updated!');
      setIsHeadingsModalOpen(false);
      fetchProjects();
    } catch (err) {
      console.error('Save headings error:', err);
      message.error('Failed to save Kanban column headings.');
    } finally {
      setSavingHeadings(false);
    }
  };

  const handleHeadingsDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = columnList.findIndex(c => c.key === active.id);
    const newIndex = columnList.findIndex(c => c.key === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      setColumnList(prev => {
        const next = [...prev];
        const [moved] = next.splice(oldIndex, 1);
        next.splice(newIndex, 0, moved);
        return next;
      });
    }
  };

  // --- Edit Ticket ---
  const handleEditTicket = (ticket) => {
    setEditingTicket(ticket);
    editForm.setFieldsValue({
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      estimatedHours: Number(ticket.estimatedHours) || 0,
      dueDate: ticket.dueDate ? dayjs(ticket.dueDate) : null,
      assignedToUserId: ticket.assignedToUserId || null,
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    try {
      const values = await editForm.validateFields();
      setSavingTicket(true);
      await ticketService.updateTicket(editingTicket.id || editingTicket.ticketId, {
        title: values.title,
        description: values.description,
        priority: values.priority,
        estimatedHours: values.estimatedHours,
        dueDate: values.dueDate ? values.dueDate.toISOString() : null,
        assignedToUserId: values.assignedToUserId || null,
      });
      message.success('Ticket updated successfully!');
      setIsEditModalOpen(false);
      loadTickets(projectId);
    } catch (err) {
      if (err?.errorFields) return; // form validation error
      message.error('Failed to update ticket.');
    } finally {
      setSavingTicket(false);
    }
  };

  const currentAssignee = selectedTicket
    ? (users.find(u => u.id === selectedTicket.assignedToUserId) || mockUsers.find(u => u.id === selectedTicket.assignedToUserId))
    : null;

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
            {projectId && (
              <Select
                placeholder="Filter by Team Member"
                style={{ width: 230 }}
                value={selectedAssigneeId}
                onChange={setSelectedAssigneeId}
                options={(() => {
                  const myUserId = authUser?.id || authUser?.userId;
                  let filteredUsers = users;
                  if (authRole === 'TeamLead' || authUser?.role === 'TeamLead') {
                    filteredUsers = users.filter(u => 
                      (u.role === 'Employee' && String(u.teamLeadId) === String(myUserId)) ||
                      String(u.id || u.userId) === String(myUserId)
                    );
                  }
                  return [
                    { label: 'All Team Members', value: 'all' },
                    ...filteredUsers.map(u => ({ label: `${u.name || u.fullName} (${u.role})`, value: String(u.id || u.userId) }))
                  ];
                })()}
              />
            )}
            {projectId && (
              <Space>
                {canEdit && (
                  <Button icon={<EditOutlined />} onClick={handleOpenHeadingsModal}>
                    Edit Headings
                  </Button>
                )}
              </Space>
            )}
            {projectId && canEdit && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>Create Ticket</Button>
            )}
          </Space>
        }
      />

      {/* Submit to Team Lead banner */}
      {projectId && project?.status === 'Approved' && isManager && (
        <Alert
          message={<Text strong style={{ fontSize: '15px' }}>📢 Project Approved & Tickets Auto-Generated</Text>}
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
                  type="primary" icon={<TeamOutlined />} 
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
             {effectiveColumnList.map(({ key: colId, title }) => (
              <DroppableColumn
                key={colId}
                colId={colId}
                displayTitle={title}
                tickets={localColumns[colId] || []}
                openTicketDetail={openTicketDetail}
                onDeleteTicket={handleDeleteTicket}
                onEditTicket={handleEditTicket}
                isDarkMode={isDarkMode}
                token={token}
                users={users}
                canEdit={canEdit}
                authRole={authRole}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <Card style={{ textAlign: 'center', padding: '40px 0' }}>
          <Text type="secondary">Please select a project to load the Kanban board.</Text>
        </Card>
      )}

      {/* Ticket Detail Drawer */}
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
        project={project}
        onSuccess={() => loadTickets(projectId)} 
      />

      {/* Dynamic Edit Headings Modal */}
      <Modal
        title="Modify Kanban Column Headings"
        open={isHeadingsModalOpen}
        onCancel={() => setIsHeadingsModalOpen(false)}
        onOk={handleSaveHeadings}
        okText="Save Headings"
        confirmLoading={savingHeadings}
        width={500}
      >
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleHeadingsDragEnd}>
          <SortableContext items={columnList.map(c => c.key)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
              {columnList.map((col, idx) => (
                <SortableColumnItem
                  key={col.key}
                  col={col}
                  idx={idx}
                  onTitleChange={handleColumnTitleChange}
                  onRemove={handleRemoveColumn}
                  length={columnList.length}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={handleAddColumn}
          style={{ marginTop: 8 }}
          block
        >
          Add Column
        </Button>

        <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
          Note: Tickets in removed columns will retain their status but won't be visible on the board.
        </Text>
      </Modal>

      {/* Edit Ticket Modal */}
      <Modal
        title={`Edit Ticket — ${editingTicket?.ticketCode || editingTicket?.code || ''}`}
        open={isEditModalOpen}
        onCancel={() => { setIsEditModalOpen(false); editForm.resetFields(); }}
        onOk={handleSaveEdit}
        okText="Save Changes"
        confirmLoading={savingTicket}
        width={560}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title is required' }]}>
            <Input placeholder="Ticket title" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Description (optional)" />
          </Form.Item>

          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="priority" label="Priority" style={{ flex: 1 }} rules={[{ required: true }]}>
              <Select options={[
                { value: 'Critical', label: '🔴 Critical' },
                { value: 'High', label: '🟠 High' },
                { value: 'Medium', label: '🔵 Medium' },
                { value: 'Low', label: '🟢 Low' },
              ]} />
            </Form.Item>

            <Form.Item name="estimatedHours" label="Estimated Hours" style={{ flex: 1 }} rules={[{ required: true }]}>
              <InputNumber min={0} step={0.5} style={{ width: '100%' }} addonAfter="hrs" />
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="dueDate" label="Due Date" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>

            <Form.Item name="assignedToUserId" label="Assign To" style={{ flex: 1 }}>
              <Select
                allowClear
                placeholder="Unassigned"
                options={(() => {
                  if (authRole === 'ProjectManager' || authRole === 'TenantAdmin') {
                    const pmId = authUser?.userId || authUser?.id;
                    const pmName = authUser?.fullName || authUser?.name || 'Project Manager';
                    return [{
                      value: pmId,
                      label: pmName
                    }];
                  }
                  const projectTLId = project?.assignedTeamLeadId;
                  const eligibleUsers = users.filter(u => {
                    if (!projectTLId) return u.role === 'Employee' || u.role === 'TeamLead';
                    if (u.role === 'TeamLead' && u.id === projectTLId) return true;
                    if (u.role === 'Employee' && u.teamLeadId === projectTLId) return true;
                    return false;
                  });

                  // Ensure the currently assigned user (e.g. PM) is included in the options list for TL
                  const currentAssigneeId = editingTicket?.assignedToUserId;
                  if (currentAssigneeId) {
                    const exists = eligibleUsers.some(u => (u.id || u.userId) === currentAssigneeId);
                    if (!exists) {
                      const assignedUserObj = users.find(u => (u.id || u.userId) === currentAssigneeId);
                      if (assignedUserObj) {
                        eligibleUsers.push(assignedUserObj);
                      }
                    }
                  }

                  return eligibleUsers.map(u => ({
                    value: u.id || u.userId,
                    label: u.role === 'ProjectManager' ? `👑 ${u.name || u.fullName} (PM)` : (u.name || u.fullName)
                  }));
                })()}
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default KanbanBoard;
