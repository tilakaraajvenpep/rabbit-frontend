import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Button, Space, Avatar, Tooltip, Skeleton, notification, Descriptions, Tag } from 'antd';
import { 
  DashboardOutlined, 
  TeamOutlined, 
  FieldTimeOutlined, 
  DollarOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { projectService } from '../../services/projectService';
import { ticketService } from '../../services/ticketService';
import { mockUsers } from '../../mocks/mockUsers';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import PriorityBadge from '../../components/common/PriorityBadge';
import HoursProgress from '../../components/common/HoursProgress';
import dayjs from 'dayjs';

const ProjectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [latestDoc, setLatestDoc] = useState(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projRes, tickRes] = await Promise.all([
        projectService.getProjectById(id),
        ticketService.getTickets(id)
      ]);
      setProject(projRes.data);
      setTickets(tickRes.data);

      const docsRes = await projectService.getDocuments(id);
      if (docsRes.data && docsRes.data.length > 0) {
        setLatestDoc(docsRes.data[0]);
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
        const user = mockUsers.find(u => u.id === userId);
        return (
          <Space>
            <Avatar size="small" src={user?.avatar} />
            {user?.name}
          </Space>
        );
      }
    },
    { title: 'Priority', dataIndex: 'priority', key: 'priority', render: (p) => <PriorityBadge priority={p} /> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <StatusBadge status={s} /> },
    { title: 'Est. Hours', dataIndex: 'estimatedHours', key: 'estHours' },
    { title: 'Consumed', dataIndex: 'consumedHours', key: 'consHours' },
  ];

  if (loading) return <Skeleton active />;
  if (!project) return <div>Project not found</div>;

  const remainingHours = project.approvedHours - project.consumedHours;

  return (
    <div>
      <PageHeader 
        title={project.name}
        extra={[
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
        <Col span={6}>
          <Card>
            <Statistic 
              title="Approved Budget" 
              value={project.approvedBudget} 
              prefix={<DollarOutlined />} 
              formatter={(value) => `₹ ${Number(value || 0).toLocaleString('en-IN')}`}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Approved Hours" value={project.approvedHours} prefix={<FieldTimeOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Consumed Hours" value={project.consumedHours} prefix={<FieldTimeOutlined />} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col span={6}>
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

      <Card title="Team Members" style={{ marginBottom: 24 }}>
        <Avatar.Group maxCount={5} size="large">
          {mockUsers.filter(u => u.role === 'Employee').map(user => (
            <Tooltip title={user.name} key={user.id}>
              <Avatar src={user.avatar} />
            </Tooltip>
          ))}
        </Avatar.Group>
      </Card>

      <Card title="Tickets Summary">
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
    </div>
  );
};

export default ProjectDetailPage;
