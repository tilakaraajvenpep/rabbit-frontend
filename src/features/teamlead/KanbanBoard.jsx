import React, { useState, useEffect } from 'react';
import { Layout, Typography, Card, Badge, Avatar, Tooltip, Space, Button, Drawer, Skeleton, Select, theme } from 'antd';
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
import { PlusOutlined, UserOutlined, CalendarOutlined } from '@ant-design/icons';
import { ticketService } from '../../services/ticketService';
import { projectService } from '../../services/projectService';
import { useTicketStore } from '../../store/ticketStore';
import { mockUsers } from '../../mocks/mockUsers';
import { useThemeStore } from '../../store/themeStore';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import PriorityBadge from '../../components/common/PriorityBadge';
import CreateTicketModal from './CreateTicketModal';

const { Content } = Layout;
const { Title, Text } = Typography;

// Sortable Ticket Card
const SortableTicket = ({ ticket, onClick }) => {
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

  const user = mockUsers.find(u => u.id === ticket.assignedTo);
  const displayDate = ticket.dueDate || ticket.createdAt;
  const isOverdue = displayDate && new Date(displayDate) < new Date() && ticket.status !== 'Done';

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card 
        size="small" 
        hoverable 
        style={{ borderLeft: `4px solid ${getPriorityColor(ticket.priority)}` }}
        onClick={() => onClick(ticket)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: '12px' }}><code>{ticket.code}</code></Text>
          <PriorityBadge priority={ticket.priority} />
        </div>
        <Title level={5} style={{ margin: '0 0 12px 0' }} ellipsis={{ rows: 2 }}>{ticket.title}</Title>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Tooltip title={user?.name}>
              <Avatar size="small" src={user?.avatar} icon={<UserOutlined />} />
            </Tooltip>
            <Text type="secondary" style={{ fontSize: '12px' }}>{ticket.estimatedHours}h</Text>
          </Space>
          <Space>
            <CalendarOutlined style={{ color: isOverdue ? '#ff4d4f' : '#8c8c8c' }} />
            <Text style={{ fontSize: '11px', color: isOverdue ? '#ff4d4f' : '#8c8c8c' }}>
              {displayDate ? new Date(displayDate).toLocaleDateString() : 'No Date'}
            </Text>
          </Space>
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
const DroppableColumn = ({ colId, tickets, openTicketDetail, isDarkMode, token }) => {
  const { setNodeRef } = useDroppable({ id: colId });

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
          {colId.replace(/([A-Z])/g, ' $1').trim()}
        </Title>
        <Badge count={tickets.length} style={{ backgroundColor: isDarkMode ? '#3f3f46' : '#bfbfbf', color: isDarkMode ? '#f4f4f5' : undefined }} />
      </div>

      <SortableContext id={colId} items={tickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} style={{ minHeight: 400, height: '100%', paddingBottom: 20 }}>
          {tickets.map(ticket => (
            <SortableTicket key={ticket.id} ticket={ticket} onClick={openTicketDetail} />
          ))}
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
  const { kanbanColumns, setTickets, moveTicket, loading } = useTicketStore();
  const [allProjects, setAllProjects] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await projectService.getProjects();
      setAllProjects(res.data);
    } catch (error) {
      console.error('Failed to fetch projects');
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
    navigate(`/teamlead/projects/${id}/kanban`);
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
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>Create Ticket</Button>
          </Space>
        }
      />

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', flex: 1, paddingBottom: 16 }}>
          {Object.entries(kanbanColumns).map(([colId, tickets]) => (
            <DroppableColumn
              key={colId}
              colId={colId}
              tickets={tickets}
              openTicketDetail={openTicketDetail}
              isDarkMode={isDarkMode}
              token={token}
            />
          ))}
        </div>
      </DndContext>

      <Drawer
        title={selectedTicket?.code}
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
                <Avatar src={mockUsers.find(u => u.id === selectedTicket.assignedTo)?.avatar} />
                <Text>{mockUsers.find(u => u.id === selectedTicket.assignedTo)?.name}</Text>
              </Space>
            </Space>

            <Space direction="vertical">
              <Text strong>Estimated Hours</Text>
              <Text>{selectedTicket.estimatedHours} hrs</Text>
            </Space>

            <Space direction="vertical">
              <Text strong>Date</Text>
              <Text>
                {selectedTicket.dueDate 
                  ? new Date(selectedTicket.dueDate).toLocaleDateString() 
                  : (selectedTicket.createdAt ? new Date(selectedTicket.createdAt).toLocaleDateString() : 'No Date')
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
    </div>
  );
};

export default KanbanBoard;
