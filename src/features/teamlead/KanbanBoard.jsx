import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layout, Typography, Card, Badge, Avatar, Tooltip, Space, Button, 
  Drawer, Select, theme, Modal, message, Input, Alert, Form, DatePicker, InputNumber, Tag, Tabs, List, Popconfirm 
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
import { PlusOutlined, UserOutlined, CalendarOutlined, DeleteOutlined, EditOutlined, TeamOutlined, MinusCircleOutlined, HolderOutlined, LockOutlined, CheckCircleOutlined, BookOutlined, CopyOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ticketService } from '../../services/ticketService';
import { projectService } from '../../services/projectService';
import { adminService } from '../../services/adminService';
import { ticketTemplateService } from '../../services/ticketTemplateService';
import { useAuthStore } from '../../store/authStore';
import { timerRequestService } from '../../services/timerRequestService';
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
const SortableTicket = ({ ticket, onClick, user, onDelete, onEdit, canEdit, isDarkMode, isDragDisabled, isTLOrPM, onApproveToggle }) => {
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

          </Space>
          <Space size={4}>
            <Tag 
              color="processing" 
              style={{ 
                fontSize: '10px', 
                borderRadius: 4, 
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                fontWeight: 600
              }}
            >
              {(() => {
                const totalHours = Number(ticket.estimatedHours) || 0;
                const h = Math.floor(totalHours);
                const m = Math.round((totalHours - h) * 60);
                if (h > 0 && m > 0) {
                  return `${h}h ${m}m`;
                } else if (m > 0) {
                  return `${m}m`;
                } else {
                  return `${h}h`;
                }
              })()}
            </Tag>
            {ticket.startDate && (
              <Tag 
                style={{ 
                  fontSize: '10px', 
                  borderRadius: 4, 
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <CalendarOutlined style={{ color: '#8c8c8c' }} />
                <span style={{ color: '#64748b', fontWeight: 500 }}>
                  Start: {dayjs(ticket.startDate).format('DD MMM')}
                </span>
              </Tag>
            )}
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
                  Due: {dayjs(ticket.dueDate).format('DD MMM')}
                </span>
              </Tag>
            )}
          </Space>
        </div>
        
        {ticket.status === 'InReview' && (
          <div style={{ marginTop: 10 }} onClick={e => e.stopPropagation()}>
            {ticket.approvedForDone ? (
              <Button
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => isTLOrPM && onApproveToggle(ticket)}
                style={{
                  width: '100%',
                  background: '#f6ffed',
                  borderColor: '#52c41a',
                  color: '#389e0d',
                  fontWeight: 600,
                  fontSize: 11,
                  cursor: isTLOrPM ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  borderRadius: 6,
                }}
              >
                Approved — Click to Revoke
              </Button>
            ) : (
              isTLOrPM ? (
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => onApproveToggle(ticket)}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    borderColor: '#059669',
                    fontWeight: 600,
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    borderRadius: 6,
                    boxShadow: '0 2px 6px rgba(16,185,129,0.35)',
                  }}
                >
                  Approve for Done
                </Button>
              ) : (
                <Tag color="warning" style={{ fontWeight: 600, fontSize: 11 }}>
                  ⚠ Awaiting TL Approval
                </Tag>
              )
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

// Droppable Column Component — receives displayTitle directly
const DroppableColumn = ({ colId, displayTitle, tickets, openTicketDetail, onDeleteTicket, onEditTicket, isDarkMode, token, users, canEdit, authRole, isTLOrPM, onApproveToggle }) => {
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
                isTLOrPM={isTLOrPM}
                onApproveToggle={onApproveToggle}
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
  const [isEditingTL, setIsEditingTL] = useState(false);
  const [tempSelectedTL, setTempSelectedTL] = useState(null);

  // Edit Headings states
  const [isHeadingsModalOpen, setIsHeadingsModalOpen] = useState(false);
  const [columnList, setColumnList] = useState(DEFAULT_COLUMNS); // [{key, title}]
  const [savingHeadings, setSavingHeadings] = useState(false);

  // Edit Ticket states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [editForm] = Form.useForm();
  const [savingTicket, setSavingTicket] = useState(false);
  const [editAssignedEmployees, setEditAssignedEmployees] = useState([]);

  // Templates states
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [templateForm] = Form.useForm();

  // Request Additional Hours states
  const [isRequestHoursModalOpen, setIsRequestHoursModalOpen] = useState(false);
  const [requestHoursForm] = Form.useForm();
  const [submittingHoursRequest, setSubmittingHoursRequest] = useState(false);

  const isManager = authRole === 'ProjectManager' || authRole === 'TenantAdmin'
    || authUser?.role === 'ProjectManager' || authUser?.role === 'TenantAdmin';
  const canEdit = authRole === 'ProjectManager' || authRole === 'TenantAdmin' || authRole === 'TeamLead'
    || authUser?.role === 'ProjectManager' || authUser?.role === 'TenantAdmin' || authUser?.role === 'TeamLead';
  const isTLOrPM = authRole === 'TeamLead' || authRole === 'ProjectManager' || authRole === 'TenantAdmin'
    || authUser?.role === 'TeamLead' || authUser?.role === 'ProjectManager' || authUser?.role === 'TenantAdmin';
  const project = allProjects.find(p => String(p.id) === String(projectId));
  const pmUser = users.find(u => String(u.id || u.userId) === String(project?.assignedProjectManagerId));
  const pmName = pmUser ? (pmUser.name || pmUser.fullName) : '';

  // Effective column config — from saved project data or defaults
  const effectiveColumnList = useMemo(() => deriveColumnConfig(project?.kanbanColumns), [project]);

  const totalTicketHours = useMemo(() => {
    return allTickets.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
  }, [allTickets]);

  const otherTicketsHours = useMemo(() => {
    if (!editingTicket) return 0;
    const editingId = editingTicket.id || editingTicket.ticketId;
    return allTickets
      .filter(t => (t.id || t.ticketId) !== editingId)
      .reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
  }, [allTickets, editingTicket]);

  const isHoursExceeded = useMemo(() => {
    if (!projectId || !project) return false;
    return totalTicketHours > Number(project.totalHours || project.approvedHours || 0);
  }, [projectId, project, totalTicketHours]);

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

  const handleApproveToggle = async (ticket) => {
    try {
      const newApproved = !ticket.approvedForDone;
      await ticketService.updateTicket(ticket.id || ticket.ticketId, { approvedForDone: newApproved });
      message.success(newApproved ? 'Ticket approved for Done stage!' : 'Ticket approval revoked.');
      loadTickets(projectId);
    } catch (err) {
      message.error('Failed to update ticket approval status.');
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
      const ticket = allTickets.find(t => t.id === ticketId);


      // Optimistic update
      setAllTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: toCol } : t));
      try {
        await ticketService.updateTicketStatus(ticketId, toCol);
      } catch (err) {
        // Revert on failure
        setAllTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: fromCol } : t));
        message.error(err.response?.data?.message || 'Failed to move ticket.');
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
    const existingEmployees = (Array.isArray(ticket.assignedEmployees) ? ticket.assignedEmployees : (ticket.assignedToUserId ? [{
      userId: Number(ticket.assignedToUserId),
      name: users.find(u => String(u.id || u.userId) === String(ticket.assignedToUserId))?.name || 'Employee',
      hours: Number(ticket.estimatedHours) || 0
    }] : [])).map(emp => {
      const h = Number(emp.hours) || 0;
      return {
        ...emp,
        hoursVal: Math.floor(h),
        minutesVal: Math.round((h - Math.floor(h)) * 60)
      };
    });
    setEditAssignedEmployees(existingEmployees);

    editForm.setFieldsValue({
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      startDate: ticket.startDate ? dayjs(ticket.startDate) : null,
      dueDate: ticket.dueDate ? dayjs(ticket.dueDate) : null,
      assignedTo: existingEmployees.map(emp => emp.userId),
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    try {
      const values = await editForm.validateFields();
      
      const missingHours = editAssignedEmployees.some(emp => !emp.hours || emp.hours <= 0);
      if (missingHours) {
        message.error('Please assign valid hours for all selected employees.');
        return;
      }

      const totalEditHours = editAssignedEmployees.reduce((sum, emp) => sum + emp.hours, 0);
      const projectTotalHours = Number(project?.totalHours || project?.approvedHours || 0);
      if (otherTicketsHours + totalEditHours > projectTotalHours) {
        Modal.confirm({
          title: 'Project Hours Limit Exceeded',
          content: (
            <div>
              <p>The total estimated hours across all tickets would exceed the project's allotted limit.</p>
              <p>Other ticket hours on board: <strong>{otherTicketsHours}h</strong></p>
              <p>This ticket hours: <strong>{totalEditHours}h</strong></p>
              <p>Project allotted limit: <strong>{projectTotalHours}h</strong></p>
              <p>Please request additional hours before assigning more tasks.</p>
            </div>
          ),
          okText: 'Request Additional Hours',
          cancelText: 'Close',
          onOk: () => {
            setIsEditModalOpen(false);
            setIsRequestHoursModalOpen(true);
          }
        });
        return;
      }

      setSavingTicket(true);
      await ticketService.updateTicket(editingTicket.id || editingTicket.ticketId, {
        title: values.title,
        description: values.description,
        priority: values.priority,
        estimatedHours: editAssignedEmployees.reduce((sum, emp) => sum + emp.hours, 0),
        assignedToUserId: editAssignedEmployees[0]?.userId || null,
        assignedEmployees: editAssignedEmployees,
        startDate: values.startDate ? values.startDate.toISOString() : null,
        dueDate: values.dueDate ? values.dueDate.toISOString() : null,
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

  // --- Templates ---
  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await ticketTemplateService.getTemplates();
      setTemplates(res.data || []);
    } catch (err) {
      console.error('Failed to fetch templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleOpenTemplatesModal = () => {
    fetchTemplates();
    templateForm.resetFields();
    setIsTemplatesModalOpen(true);
  };

  const handleSaveTemplate = async () => {
    try {
      const values = await templateForm.validateFields();
      let templateTickets = [];

      if (values.source === 'current') {
        if (allTickets.length === 0) {
          message.warning('No tickets in the current project board to save.');
          return;
        }
        templateTickets = allTickets.map(t => ({
          title: t.title,
          description: t.description,
          priority: t.priority,
          estimatedHours: Number(t.estimatedHours) || 0,
          milestone: t.milestone || ''
        }));
      } else {
        templateTickets = (values.customTickets || []).map(t => ({
          title: t.title,
          description: t.description || '',
          priority: t.priority || 'Medium',
          estimatedHours: Number(t.estimatedHours) || 0,
          milestone: t.milestone || ''
        }));
        if (templateTickets.length === 0) {
          message.warning('Please add at least one ticket to the template.');
          return;
        }
      }

      await ticketTemplateService.createTemplate({
        templateName: values.templateName,
        department: values.department || null,
        projectName: values.projectName || null,
        tickets: templateTickets
      });

      message.success('Ticket template saved successfully!');
      templateForm.resetFields();
      fetchTemplates();
    } catch (err) {
      if (err?.errorFields) return;
      message.error('Failed to save ticket template.');
    }
  };

  const handleApplyTemplate = async (tpl) => {
    if (!projectId) return;
    setApplyingTemplate(true);
    try {
      const ticketsToCreate = tpl.tickets || [];
      await Promise.all(ticketsToCreate.map(async (t) => {
        await ticketService.createTicket(projectId, {
          title: t.title,
          description: t.description,
          priority: t.priority,
          estimatedHours: Number(t.estimatedHours) || 0,
          milestone: t.milestone,
          assignedToUserId: null,
          assignedEmployees: []
        });
      }));
      message.success(`Successfully applied template "${tpl.templateName}"! Created ${ticketsToCreate.length} tickets.`);
      setIsTemplatesModalOpen(false);
      loadTickets(projectId);
    } catch (err) {
      message.error('Failed to apply template tickets.');
    } finally {
      setApplyingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    try {
      await ticketTemplateService.deleteTemplate(templateId);
      message.success('Template deleted.');
      fetchTemplates();
    } catch (err) {
      message.error('Failed to delete template.');
    }
  };

  const handleRequestHoursSubmit = async () => {
    try {
      const values = await requestHoursForm.validateFields();
      setSubmittingHoursRequest(true);
      
      await timerRequestService.createRequest({
        ticketId: values.ticketId,
        requestType: 'ExceededLimit',
        requestedHours: values.requestedHours,
        reason: values.reason,
      });

      message.success('Additional hours request submitted successfully!');
      setIsRequestHoursModalOpen(false);
      requestHoursForm.resetFields();
    } catch (err) {
      console.error(err);
      message.error(err?.response?.data?.message || 'Failed to submit hours request.');
    } finally {
      setSubmittingHoursRequest(false);
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
            {projectId && canEdit && (
              <Space>
                <Button icon={<BookOutlined />} onClick={handleOpenTemplatesModal}>
                  Templates
                </Button>
                <Button icon={<EditOutlined />} onClick={handleOpenHeadingsModal}>
                  Edit Headings
                </Button>
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

      {/* Edit/View Team Lead Assignment for PM */}
      {projectId && project?.status !== 'Approved' && isManager && (
        <Alert
          message={<Text strong style={{ fontSize: '15px' }}>💼 Project Assigned Team Leader</Text>}
          description={
            <div style={{ marginTop: 8 }}>
              {!isEditingTL ? (
                <Space size="middle">
                  <span>
                    Current Team Lead: <strong>{project?.teamLead || users.find(u => u.id === project?.assignedTeamLeadId)?.fullName || 'None'}</strong>
                  </span>
                  <Button 
                    type="link" 
                    icon={<EditOutlined />} 
                    onClick={() => {
                      setTempSelectedTL(project?.assignedTeamLeadId);
                      setIsEditingTL(true);
                    }}
                  >
                    Edit Assignment
                  </Button>
                </Space>
              ) : (
                <Space>
                  <Select
                    placeholder="Select Team Lead"
                    style={{ width: 250 }}
                    value={tempSelectedTL}
                    onChange={setTempSelectedTL}
                    options={users.filter(u => u.role === 'TeamLead').map(u => ({ label: u.name || u.fullName, value: u.id }))}
                  />
                  <Button 
                    type="primary" 
                    icon={<SaveOutlined />} 
                    onClick={async () => {
                      if (!tempSelectedTL) return;
                      setSubmittingTL(true);
                      try {
                        await projectService.updateProjectStatus(projectId, {
                          assignedTeamLeadId: Number(tempSelectedTL),
                          status: project.status
                        });
                        message.success('Team Lead assignment updated successfully!');
                        setIsEditingTL(false);
                        fetchProjects();
                      } catch (err) {
                        message.error('Failed to update Team Lead assignment.');
                      } finally {
                        setSubmittingTL(false);
                      }
                    }}
                    loading={submittingTL}
                  >
                    Save
                  </Button>
                  <Button 
                    onClick={() => setIsEditingTL(false)}
                  >
                    Cancel
                  </Button>
                </Space>
              )}
            </div>
          }
          type="success"
          showIcon
          style={{ marginBottom: 20, borderRadius: 8 }}
        />
      )}

      {/* Exceeded project hours limit alert */}
      {isHoursExceeded && (
        <Alert
          type="warning"
          showIcon
          message={<span style={{ fontWeight: 700 }}>Project Hours Limit Exceeded</span>}
          description={
            <div style={{ marginTop: 4 }}>
              <div style={{ marginBottom: 8 }}>
                Total estimated hours allocated to tickets on this board (<strong>{totalTicketHours}h</strong>) exceeds the project's overall allocated hours (<strong>{Number(project?.totalHours || project?.approvedHours || 0)}h</strong>).
              </div>
              {canEdit && (
                <Button 
                  type="primary" 
                  size="small" 
                  onClick={() => setIsRequestHoursModalOpen(true)}
                  style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', borderRadius: 6 }}
                >
                  Request Additional Hours
                </Button>
              )}
            </div>
          }
          style={{ marginBottom: 20, borderRadius: 8 }}
        />
      )}

      {projectId ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <div className="kanban-board-container" style={{ display: 'flex', gap: 16, overflowX: 'auto', flex: 1, paddingBottom: 16 }}>
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
                isTLOrPM={isTLOrPM}
                onApproveToggle={handleApproveToggle}
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
              <Text strong>Start Date</Text>
              <Text>
                {selectedTicket.startDate 
                  ? dayjs(selectedTicket.startDate).format('DD MMM YYYY') 
                  : 'No Start Date'
                }
              </Text>
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

            <Space direction="vertical">
              <Text strong>In Progress Date</Text>
              <Text style={{ color: '#16a34a', fontWeight: 600 }}>
                {selectedTicket.inProgressDate 
                  ? dayjs(selectedTicket.inProgressDate).format('DD MMM YYYY HH:mm') 
                  : 'Not Started'
                }
              </Text>
            </Space>

            {isTLOrPM && selectedTicket.status === 'InReview' && (
              <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
                <Text strong>Team Leader Approval</Text>
                <Button 
                  type={selectedTicket.approvedForDone ? 'default' : 'primary'}
                  danger={selectedTicket.approvedForDone}
                  icon={selectedTicket.approvedForDone ? <LockOutlined /> : <CheckCircleOutlined />}
                  onClick={async () => {
                    await handleApproveToggle(selectedTicket);
                    setSelectedTicket(prev => prev ? { ...prev, approvedForDone: !prev.approvedForDone } : null);
                  }}
                  block
                >
                  {selectedTicket.approvedForDone ? 'Revoke Done Approval' : 'Approve for Done Stage'}
                </Button>
              </Space>
            )}
          </Space>
        )}
      </Drawer>

      <CreateTicketModal 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        projectId={projectId} 
        project={project}
        allTickets={allTickets}
        onRequestHours={() => setIsRequestHoursModalOpen(true)}
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
          {pmName && (
            <Form.Item label="Project Manager" style={{ marginBottom: 16 }}>
              <Input value={pmName} disabled style={{ color: '#333', fontWeight: 600, backgroundColor: '#f5f5f5' }} />
            </Form.Item>
          )}
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title is required' }]}>
            <Input placeholder="Ticket title" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Description (optional)" />
          </Form.Item>

          <Form.Item name="priority" label="Priority" rules={[{ required: true }]}>
            <Select options={[
              { value: 'Critical', label: '🔴 Critical' },
              { value: 'High', label: '🟠 High' },
              { value: 'Medium', label: '🔵 Medium' },
              { value: 'Low', label: '🟢 Low' },
            ]} />
          </Form.Item>

          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="startDate" label="Start Date" rules={[{ required: true, message: 'Start date is required' }]} style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
            <Form.Item name="dueDate" label="Due Date" rules={[{ required: true, message: 'Due date is required' }]} style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
          </div>

          <Form.Item name="assignedTo" label="Assign Employees" rules={[{ required: true, message: 'Please assign at least one employee' }]}>
            <Select 
              mode="multiple"
              style={{ width: '100%' }} 
              placeholder="Select employees"
              onChange={(val) => {
                const newAssigned = val.map(id => {
                  const existing = editAssignedEmployees.find(emp => String(emp.userId) === String(id));
                  if (existing) return existing;
                  const user = users.find(u => String(u.id || u.userId) === String(id));
                  return {
                    userId: Number(id),
                    name: user ? (user.name || user.fullName) : `Employee ${id}`,
                    hours: 0,
                    hoursVal: 0,
                    minutesVal: 0
                  };
                });
                setEditAssignedEmployees(newAssigned);
              }}
            >
              {(() => {
                const projectTLId = project?.assignedTeamLeadId;
                const pmId = authUser?.userId || authUser?.id;
                const pmUser = users.find(u => String(u.id || u.userId) === String(project?.assignedProjectManagerId));
                let eligibleUsers = users.filter(u => {
                  if (authRole === 'ProjectManager' || authRole === 'TenantAdmin' || authUser?.role === 'ProjectManager' || authUser?.role === 'TenantAdmin') {
                    if (u.role !== 'Employee' && u.role !== 'TeamLead') return false;
                    if (authRole === 'ProjectManager' || authUser?.role === 'ProjectManager') {
                      if (u.role === 'TeamLead') {
                        return String(u.projectManagerId) === String(pmId);
                      }
                      if (u.role === 'Employee') {
                        if (String(u.projectManagerId) === String(pmId)) return true;
                        if (u.teamLeadId) {
                          const tl = users.find(tlUser => String(tlUser.id || tlUser.userId) === String(u.teamLeadId));
                          if (tl && String(tl.projectManagerId) === String(pmId)) return true;
                        }
                        return false;
                      }
                    }
                    return true;
                  }
                  if (!projectTLId) return u.role === 'Employee' || u.role === 'TeamLead';
                  if (u.role === 'TeamLead' && u.id === projectTLId) return true;
                  if (u.role === 'Employee' && u.teamLeadId === projectTLId) return true;
                  return false;
                });
                
                if (pmUser && !eligibleUsers.some(u => String(u.id) === String(pmUser.id))) {
                  eligibleUsers.push(pmUser);
                }

                return eligibleUsers.map(u => (
                  <Select.Option key={u.id} value={u.id}>
                    {u.name || u.fullName} ({u.role})
                  </Select.Option>
                ));
              })()}
            </Select>
          </Form.Item>

          {editAssignedEmployees.length > 0 && (
            <Form.Item label="Assign Hours per Employee" required style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '12px 16px', background: '#fafafa' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {editAssignedEmployees.map((emp, index) => (
                  <div key={emp.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <Text strong>{emp.name}</Text>
                    <Space>
                      <InputNumber
                        min={0}
                        placeholder="Hours"
                        value={emp.hoursVal !== undefined ? emp.hoursVal : Math.floor(emp.hours || 0)}
                        onChange={(val) => {
                          const hVal = Number(val) || 0;
                          const mVal = emp.minutesVal !== undefined ? emp.minutesVal : Math.round(((emp.hours || 0) - Math.floor(emp.hours || 0)) * 60);
                          const numVal = hVal + (mVal / 60);

                          const otherEmployeesHours = editAssignedEmployees.filter((_, idx) => idx !== index).reduce((sum, emp) => sum + emp.hours, 0);
                          const currentTicketTotal = otherEmployeesHours + numVal;
                          const projectTotalHours = Number(project?.totalHours || project?.approvedHours || 0);
                          if (otherTicketsHours + currentTicketTotal > projectTotalHours) {
                            Modal.confirm({
                              title: 'Project Hours Limit Exceeded',
                              content: (
                                <div>
                                  <p>The total estimated hours across all tickets would exceed the project's allotted limit.</p>
                                  <p>Other ticket hours on board: <strong>{otherTicketsHours}h</strong></p>
                                  <p>This ticket hours: <strong>{currentTicketTotal}h</strong></p>
                                  <p>Project allotted limit: <strong>{projectTotalHours}h</strong></p>
                                  <p>Please request additional hours before assigning more tasks.</p>
                                </div>
                              ),
                              okText: 'Request Additional Hours',
                              cancelText: 'Close',
                              onOk: () => {
                                setIsEditModalOpen(false);
                                setIsRequestHoursModalOpen(true);
                              }
                            });
                            const updated = [...editAssignedEmployees];
                            updated[index].hours = 0;
                            updated[index].hoursVal = 0;
                            updated[index].minutesVal = 0;
                            setEditAssignedEmployees(updated);
                            return;
                          }
                          const updated = [...editAssignedEmployees];
                          updated[index].hours = numVal;
                          updated[index].hoursVal = hVal;
                          updated[index].minutesVal = mVal;
                          setEditAssignedEmployees(updated);
                        }}
                        style={{ width: 85 }}
                      />
                      <InputNumber
                        min={0}
                        max={59}
                        placeholder="Mins"
                        value={emp.minutesVal !== undefined ? emp.minutesVal : Math.round(((emp.hours || 0) - Math.floor(emp.hours || 0)) * 60)}
                        onChange={(val) => {
                          const mVal = Number(val) || 0;
                          const hVal = emp.hoursVal !== undefined ? emp.hoursVal : Math.floor(emp.hours || 0);
                          const numVal = hVal + (mVal / 60);

                          const otherEmployeesHours = editAssignedEmployees.filter((_, idx) => idx !== index).reduce((sum, emp) => sum + emp.hours, 0);
                          const currentTicketTotal = otherEmployeesHours + numVal;
                          const projectTotalHours = Number(project?.totalHours || project?.approvedHours || 0);
                          if (otherTicketsHours + currentTicketTotal > projectTotalHours) {
                            Modal.confirm({
                              title: 'Project Hours Limit Exceeded',
                              content: (
                                <div>
                                  <p>The total estimated hours across all tickets would exceed the project's allotted limit.</p>
                                  <p>Other ticket hours on board: <strong>{otherTicketsHours}h</strong></p>
                                  <p>This ticket hours: <strong>{currentTicketTotal}h</strong></p>
                                  <p>Project allotted limit: <strong>{projectTotalHours}h</strong></p>
                                  <p>Please request additional hours before assigning more tasks.</p>
                                </div>
                              ),
                              okText: 'Request Additional Hours',
                              cancelText: 'Close',
                              onOk: () => {
                                setIsEditModalOpen(false);
                                setIsRequestHoursModalOpen(true);
                              }
                            });
                            const updated = [...editAssignedEmployees];
                            updated[index].hours = 0;
                            updated[index].hoursVal = 0;
                            updated[index].minutesVal = 0;
                            setEditAssignedEmployees(updated);
                            return;
                          }
                          const updated = [...editAssignedEmployees];
                          updated[index].hours = numVal;
                          updated[index].hoursVal = hVal;
                          updated[index].minutesVal = mVal;
                          setEditAssignedEmployees(updated);
                        }}
                        style={{ width: 85 }}
                      />
                    </Space>
                  </div>
                ))}
              </Space>
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Templates Modal */}
      <Modal
        title="Manage Ticket Templates"
        open={isTemplatesModalOpen}
        onCancel={() => setIsTemplatesModalOpen(false)}
        footer={null}
        width={720}
        destroyOnClose
      >
        <Tabs defaultActiveKey="1">
          <Tabs.TabPane tab="Apply Saved Templates" key="1">
            <List
              loading={loadingTemplates || applyingTemplate}
              dataSource={templates}
              renderItem={tpl => (
                <List.Item
                  actions={[
                    <Button 
                      type="primary" 
                      onClick={() => handleApplyTemplate(tpl)}
                      disabled={!projectId}
                    >
                      Apply to Project
                    </Button>,
                    <Popconfirm
                      title="Are you sure you want to delete this template?"
                      onConfirm={() => handleDeleteTemplate(tpl.templateId)}
                      okText="Yes"
                      cancelText="No"
                    >
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Avatar icon={<BookOutlined />} style={{ backgroundColor: '#87d068' }} />}
                    title={<Text strong>{tpl.templateName}</Text>}
                    description={
                      <Space split="•" style={{ fontSize: '12px' }}>
                        {tpl.department && <span>Dept: <strong>{tpl.department}</strong></span>}
                        {tpl.projectName && <span>Proj: <strong>{tpl.projectName}</strong></span>}
                        <span>{tpl.tickets?.length || 0} Tickets</span>
                      </Space>
                    }
                  />
                </List.Item>
              )}
              locale={{ emptyText: 'No saved templates found.' }}
            />
          </Tabs.TabPane>
          <Tabs.TabPane tab="Save/Create Template" key="2">
            <Form form={templateForm} layout="vertical" initialValues={{ source: 'current' }}>
              <Form.Item 
                name="templateName" 
                label="Template Name" 
                rules={[{ required: true, message: 'Please input a template name' }]}
              >
                <Input placeholder="e.g. Node Backend Initial Setup" />
              </Form.Item>

              <div style={{ display: 'flex', gap: 16 }}>
                <Form.Item name="department" label="Department" style={{ flex: 1 }}>
                  <Select placeholder="Select department (optional)">
                    <Select.Option value="Frontend">Frontend</Select.Option>
                    <Select.Option value="Backend">Backend</Select.Option>
                    <Select.Option value="Mobile">Mobile</Select.Option>
                    <Select.Option value="QA">QA</Select.Option>
                    <Select.Option value="DevOps">DevOps</Select.Option>
                    <Select.Option value="Design">Design</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item name="projectName" label="Project Name Reference" style={{ flex: 1 }}>
                  <Input placeholder="e.g. E-Commerce App (optional)" />
                </Form.Item>
              </div>

              <Form.Item name="source" label="Template Source">
                <Select onChange={() => templateForm.setFieldsValue({ customTickets: [] })}>
                  <Select.Option value="current">Current Project Board Tickets ({allTickets.length})</Select.Option>
                  <Select.Option value="manual">Define Custom Tickets Manually</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.source !== curr.source}>
                {({ getFieldValue }) => {
                  const src = getFieldValue('source');
                  if (src !== 'manual') return null;

                  return (
                    <Card size="small" title="Define Template Tickets" style={{ marginBottom: 16 }}>
                      <Form.List name="customTickets">
                        {(fields, { add, remove }) => (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {fields.map(({ key, name, ...restField }) => (
                              <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', borderBottom: '1px solid #f0f0f0', paddingBottom: 12 }}>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <Form.Item
                                    {...restField}
                                    name={[name, 'title']}
                                    rules={[{ required: true, message: 'Title required' }]}
                                    style={{ margin: 0 }}
                                  >
                                    <Input placeholder="Ticket Title" />
                                  </Form.Item>
                                  <Form.Item
                                    {...restField}
                                    name={[name, 'description']}
                                    style={{ margin: 0 }}
                                  >
                                    <Input.TextArea rows={1} placeholder="Description (optional)" />
                                  </Form.Item>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <Form.Item
                                      {...restField}
                                      name={[name, 'priority']}
                                      initialValue="Medium"
                                      style={{ margin: 0, flex: 1 }}
                                    >
                                      <Select placeholder="Priority">
                                        <Select.Option value="Critical">Critical</Select.Option>
                                        <Select.Option value="High">High</Select.Option>
                                        <Select.Option value="Medium">Medium</Select.Option>
                                        <Select.Option value="Low">Low</Select.Option>
                                      </Select>
                                    </Form.Item>
                                    <Form.Item
                                      {...restField}
                                      name={[name, 'estimatedHours']}
                                      initialValue={0}
                                      style={{ margin: 0, flex: 1 }}
                                    >
                                      <InputNumber min={0} step={0.5} placeholder="Hours" style={{ width: '100%' }} />
                                    </Form.Item>
                                  </div>
                                </div>
                                <Button type="text" danger onClick={() => remove(name)} icon={<DeleteOutlined />} style={{ marginTop: 4 }} />
                              </div>
                            ))}
                            <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                              Add Ticket
                            </Button>
                          </div>
                        )}
                      </Form.List>
                    </Card>
                  );
                }}
              </Form.Item>

              <Button type="primary" onClick={handleSaveTemplate} block>
                Save Template
              </Button>
            </Form>
          </Tabs.TabPane>
        </Tabs>
      </Modal>

      {/* Request Additional Hours Modal */}
      <Modal
        title={<span style={{ fontWeight: 700 }}>Request Additional Project Hours</span>}
        open={isRequestHoursModalOpen}
        onCancel={() => setIsRequestHoursModalOpen(false)}
        onOk={handleRequestHoursSubmit}
        confirmLoading={submittingHoursRequest}
        okText="Submit Request"
        cancelText="Cancel"
        destroyOnClose
      >
        <Form form={requestHoursForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="ticketId"
            label="Select Ticket"
            rules={[{ required: true, message: 'Please select a ticket' }]}
          >
            <Select placeholder="Select a ticket to associate this request with">
              {allTickets.map(t => (
                <Select.Option key={t.id || t.ticketId} value={t.id || t.ticketId}>
                  {t.ticketCode || t.code} - {t.title} ({t.estimatedHours}h)
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="requestedHours"
            label="Additional Hours Required"
            rules={[{ required: true, message: 'Please enter requested hours' }]}
          >
            <InputNumber min={0.5} step={0.5} style={{ width: '100%' }} placeholder="e.g. 10" />
          </Form.Item>

          <Form.Item
            name="reason"
            label="Reason for Additional Hours"
            rules={[{ required: true, message: 'Please provide a reason' }]}
          >
            <Input.TextArea rows={3} placeholder="Explain why the ticket needs extra hours..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default KanbanBoard;
