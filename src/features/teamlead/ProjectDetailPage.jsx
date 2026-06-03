import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Button, Space, Avatar, Tooltip, Skeleton, notification, Descriptions, Tag, Modal, Select, Typography } from 'antd';
import { 
  DashboardOutlined, 
  TeamOutlined, 
  FieldTimeOutlined, 
  DollarOutlined,
  DownloadOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { projectService } from '../../services/projectService';
import { ticketService } from '../../services/ticketService';
import { adminService } from '../../services/adminService';
import { mockUsers } from '../../mocks/mockUsers';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import PriorityBadge from '../../components/common/PriorityBadge';
import HoursProgress from '../../components/common/HoursProgress';
import dayjs from 'dayjs';
import { useAuthStore } from '../../store/authStore';

const { Text } = Typography;

const ProjectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const [project, setProject] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [latestDoc, setLatestDoc] = useState(null);

  const [isManageTeamModalOpen, setIsManageTeamModalOpen] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [savingTeam, setSavingTeam] = useState(false);
  const [requestingHRHours, setRequestingHRHours] = useState(false);

  useEffect(() => {
    if (project) {
      setSelectedEmployeeIds(project.assignedEmployeeIds || []);
    }
  }, [project]);

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleAssignEmployees = async () => {
    setSavingTeam(true);
    try {
      await projectService.updateProjectStatus(id, {
        status: project.status,
        assignedEmployeeIds: selectedEmployeeIds
      });
      notification.success({ message: 'Success', description: 'Assigned employees updated successfully.' });
      setIsManageTeamModalOpen(false);
      fetchData();
    } catch (e) {
      notification.error({ message: 'Error', description: 'Failed to assign employees.' });
    } finally {
      setSavingTeam(false);
    }
  };

  const handleRequestHRHours = async () => {
    setRequestingHRHours(true);
    try {
      await projectService.updateProjectStatus(id, {
        status: project.status,
        note: 'Requested HR to allocate hours for assigned employees.'
      });
      notification.success({ 
        message: 'Request Sent', 
        description: 'HR has been notified to allocate hours for this project.' 
      });
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to request hours from HR.' });
    } finally {
      setRequestingHRHours(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projRes, tickRes, usersRes] = await Promise.all([
        projectService.getProjectById(id),
        ticketService.getTickets(id),
        adminService.getUsers()
      ]);
      const allTickets = tickRes.data || [];
      const computedConsumed = allTickets.reduce((sum, t) => sum + (Number(t.consumedHours) || 0), 0);
      const updatedProject = {
        ...projRes.data,
        consumedHours: Math.max(Number(projRes.data.consumedHours) || 0, computedConsumed)
      };
      setProject(updatedProject);
      setTickets(allTickets);
      setUsers(usersRes.data || []);

      const docsRes = await projectService.getDocuments(id);
      if (docsRes.data && docsRes.data.length > 0) {
        const sortedDocs = [...docsRes.data].sort((a, b) => (b.documentId || b.id) - (a.documentId || a.id));
        const scopeDoc = sortedDocs.find(d => d.documentCategory === 'scope');
        setLatestDoc(scopeDoc || null);
      }
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load project details.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!latestDoc) {
      notification.warning({ message: 'Not Found', description: 'No scope document found.' });
      return;
    }
    try {
      await projectService.downloadDocument(id, latestDoc.documentId, latestDoc.fileName);
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to download document.' });
    }
  };

  const columns = [
    { title: 'Code', dataIndex: 'code', key: 'code', render: (text) => <code>{text}</code> },
    { title: 'Title', dataIndex: 'title', key: 'title', render: (text) => <strong>{text}</strong> },
    { 
      title: 'Assignee', 
      dataIndex: 'assignedTo', 
      key: 'assignee',
      render: (userId) => {
        if (!userId) {
          return <span style={{ color: '#8c8c8c', fontStyle: 'italic' }}>Not Assigned</span>;
        }
        const user = users.find(u => String(u.id) === String(userId)) || mockUsers.find(u => String(u.id) === String(userId));
        if (!user) {
          return <span style={{ color: '#8c8c8c', fontStyle: 'italic' }}>Not Assigned</span>;
        }
        return (
          <Space>
            {user.avatar ? <Avatar size="small" src={user.avatar} /> : <Avatar size="small">{user.name ? user.name[0].toUpperCase() : 'U'}</Avatar>}
            <span>{user.name || user.fullName}</span>
          </Space>
        );
      }
    },
    { title: 'Priority', dataIndex: 'priority', key: 'priority', render: (p) => <PriorityBadge priority={p} /> },

    { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <StatusBadge status={s} /> },
    { title: 'Consumed', dataIndex: 'consumedHours', key: 'consHours' },
  ];

  if (loading) return <Skeleton active />;
  if (!project) return <div>Project not found</div>;

  const remainingHours = project.approvedHours - project.consumedHours;
  const projectEmployees = (project.assignedEmployeeIds && Array.isArray(project.assignedEmployeeIds))
    ? users.filter(u => project.assignedEmployeeIds.includes(u.id || u.userId) && u.isActive !== false && u.status !== 'Inactive')
    : [];
  const tlId = currentUser ? (currentUser.userId || currentUser.id) : null;
  const employeesList = users.filter(u => u.role === 'Employee' && String(u.teamLeadId) === String(tlId) && u.isActive !== false && u.status !== 'Inactive');

  return (
    <div>
      <PageHeader 
        title={project.name}
        extra={[
          <Button 
            key="request-hr" 
            icon={<ClockCircleOutlined />} 
            onClick={handleRequestHRHours}
            loading={requestingHRHours}
            style={{ color: '#eb2f96', borderColor: '#ffadd2' }}
          >
            Request HR for Hours
          </Button>,
          <Button 
            key="download" 
            icon={<DownloadOutlined />} 
            onClick={handleDownload}
            disabled={!latestDoc}
          >
            Download Scope
          </Button>,
          <Button key="board" type="primary" icon={<DashboardOutlined />} onClick={() => navigate(`/teamlead/projects/${id}/kanban`)}>
            Open Kanban
          </Button>
        ]}
      />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic title="Approved Hours" value={project.approvedHours} prefix={<FieldTimeOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="Consumed Hours" value={project.consumedHours} prefix={<FieldTimeOutlined />} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="Remaining Hours" value={remainingHours} prefix={<FieldTimeOutlined />} valueStyle={{ color: '#3f9142' }} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 24 }}>
        <HoursProgress consumed={project.consumedHours} total={project.approvedHours} />
      </Card>

      <Card title="Project Info" style={{ marginBottom: 24 }}>
        <Descriptions bordered column={{ xxl: 4, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }}>
          <Descriptions.Item label="Client">{project.client}</Descriptions.Item>
          <Descriptions.Item label="Project Category">{project.projectCategory || <Tag color="warning">Not Set</Tag>}</Descriptions.Item>
          <Descriptions.Item label="Status"><StatusBadge status={project.status} /></Descriptions.Item>
          <Descriptions.Item label="Expected Start">{project.startDate ? dayjs(project.startDate).format('DD MMM YYYY') : '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card 
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span>Team Members</span>
            <Button type="primary" size="small" icon={<TeamOutlined />} onClick={() => setIsManageTeamModalOpen(true)}>
              Assign Employees
            </Button>
          </div>
        } 
        style={{ marginBottom: 24 }}
      >
        {projectEmployees.length === 0 ? (
          <span style={{ fontStyle: 'italic', color: '#8c8c8c' }}>No employees assigned to this project yet. Click "Assign Employees" to add some.</span>
        ) : (
          <Avatar.Group maxCount={10} size="large">
            {projectEmployees.map(user => (
              <Tooltip title={`${user.name || user.fullName} (${user.role})`} key={user.id || user.userId}>
                <Avatar src={user.avatar} style={{ backgroundColor: '#87d068' }}>
                  {(user.name || user.fullName || 'E')[0].toUpperCase()}
                </Avatar>
              </Tooltip>
            ))}
          </Avatar.Group>
        )}
      </Card>

      <Card title="Tickets Summary" style={{ marginBottom: 24 }}>
        <Table 
          columns={columns} 
          dataSource={tickets} 
          rowKey="id" 
          onRow={(record) => ({
            onClick: () => navigate(`/teamlead/projects/${id}/kanban`),
            style: { cursor: 'pointer' }
          })}
        />
      </Card>

      {/* Assign Employees Modal */}
      <Modal
        title={<span><TeamOutlined /> Assign Employees to Project</span>}
        open={isManageTeamModalOpen}
        onOk={handleAssignEmployees}
        onCancel={() => setIsManageTeamModalOpen(false)}
        confirmLoading={savingTeam}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">Select employees to assign to this project. HR will then allocate their working hours.</Text>
        </div>
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="Select Employees"
          value={selectedEmployeeIds}
          onChange={setSelectedEmployeeIds}
          optionFilterProp="children"
        >
          {employeesList.map(emp => (
            <Select.Option key={emp.id || emp.userId} value={emp.id || emp.userId}>
              {emp.name || emp.fullName} ({emp.email})
            </Select.Option>
          ))}
        </Select>
      </Modal>
    </div>
  );
};

export default ProjectDetailPage;
