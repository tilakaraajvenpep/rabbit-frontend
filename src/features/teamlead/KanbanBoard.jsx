import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layout, Typography, Card, Badge, Avatar, Tooltip, Space, Button, 
  Drawer, Select, theme, Modal, message, Input, Alert, Form, DatePicker, InputNumber 
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
import { PlusOutlined, UserOutlined, CalendarOutlined, DeleteOutlined, EditOutlined, TeamOutlined, MinusCircleOutlined } from '@ant-design/icons';
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

// Sortable Ticket Card
const SortableTicket = ({ ticket, onClick, user, onDelete, onEdit, canEdit }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: ticket.id });

  const style = { transform: CSS.Transform.toString(transform), transition, marginBottom: 12, cursor: 'pointer' };
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
            {canEdit && (
              <>
                <Button
                  size="small" type="text" icon={<EditOutlined />}
                  style={{ padding: '0 4px', height: 'auto', color: '#1890ff' }}
                  onClick={(e) => { e.stopPropagation(); onEdit(ticket); }}
                />
                <Button
                  size="small" type="text" danger icon={<DeleteOutlined />}
                  style={{ padding: '0 4px', height: 'auto' }}
                  onClick={(e) => { e.stopPropagation(); onDelete(ticket); }}
                />
              </>
            )}
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

// Droppable Column Component — receives displayTitle directly
const DroppableColumn = ({ colId, displayTitle, tickets, openTicketDetail, onDeleteTicket, onEditTicket, isDarkMode, token, users, canEdit }) => {
  const { setNodeRef } = useDroppable({ id: colId });

  return (
    <div style={{ 
      width: 300, minWidth: 300, 
      background: isDarkMode ? '#18181b' : '#f5f5f5', 
      borderRadius: 8, padding: 12,
      border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
        <Title level={5} style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{displayTitle}</Title>
        <Badge count={tickets.length} style={{ backgroundColor: isDarkMode ? '#3f3f46' : '#bfbfbf', color: isDarkMode ? '#f4f4f5' : undefined }} />
      </div>
      <SortableContext id={colId} items={tickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} style={{ minHeight: 400, height: '100%', paddingBottom: 20 }}>
          {tickets.map(ticket => {
            const user = users.find(u => u.id === ticket.assignedToUserId) || mockUsers.find(u => u.id === ticket.assignedToUserId);
            return <SortableTicket key={ticket.id} ticket={ticket} onClick={openTicketDetail} onDelete={onDeleteTicket} onEdit={onEditTicket} user={user} canEdit={canEdit} />;
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

  // Local kanban columns derived from nonBacklogTickets + effectiveColumnList
  const localColumns = useMemo(() => {
    const result = {};
    effectiveColumnList.forEach(({ key }) => {
      result[key] = nonBacklogTickets.filter(t => t.status === key);
    });
    return result;
  }, [nonBacklogTickets, effectiveColumnList]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    fetchProjects();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (projectId && !isNaN(Number(projectId))) {
      loadTickets(projectId);
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
              <Space>
                {isManager && (
                  <Button 
                    danger 
                    icon={<DeleteOutlined />} 
                    onClick={async () => {
                      Modal.confirm({
                        title: 'Clean Stale Phase Tickets?',
                        content: 'This will permanently remove the old budget/phase tickets (Phase 1, Phase 2, etc.) from the database. Milestone tickets will remain untouched.',
                        okText: 'Yes, Clean Up',
                        cancelText: 'No',
                        onOk: async () => {
                          try {
                            const res = await ticketService.cleanupTaskTickets();
                            message.success(`Cleanup complete! Removed ${res.data?.deleted || 0} stale tickets.`);
                            loadTickets(projectId);
                          } catch (err) {
                            message.error('Failed to clean up stale tickets.');
                          }
                        }
                      });
                    }}
                  >
                    Clean Stale Tickets
                  </Button>
                )}
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
        width={480}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          {columnList.map((col, idx) => (
            <div key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text style={{ minWidth: 90, flexShrink: 0, fontWeight: 500 }}>
                Column {idx + 1} Title
              </Text>
              <Input
                value={col.title}
                onChange={(e) => handleColumnTitleChange(idx, e.target.value)}
                placeholder={`Column ${idx + 1}`}
                style={{ flex: 1 }}
              />
              <Button
                type="text"
                danger
                icon={<MinusCircleOutlined />}
                onClick={() => handleRemoveColumn(idx)}
                disabled={columnList.length <= 1}
                title="Remove column"
              />
            </div>
          ))}

          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleAddColumn}
            style={{ marginTop: 4 }}
            block
          >
            Add Column
          </Button>

          <Text type="secondary" style={{ fontSize: 12 }}>
            Note: Tickets in removed columns will retain their status but won't be visible on the board.
          </Text>
        </div>
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
                  return eligibleUsers.map(u => ({
                    value: u.id || u.userId,
                    label: u.name || u.fullName
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
