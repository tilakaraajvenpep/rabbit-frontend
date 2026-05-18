import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Button, Space, Typography, Skeleton, Alert, Divider, notification, Popconfirm } from 'antd';
import { 
  ProjectOutlined, 
  TeamOutlined, 
  WarningOutlined, 
  BellOutlined,
  EyeOutlined,
  LineChartOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { analyticsService } from '../../services/analyticsService';
import { useAlertStore } from '../../store/alertStore';
import { projectService } from '../../services/projectService';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import HoursProgress from '../../components/common/HoursProgress';

const { Title, Text } = Typography;

const PMDashboardPage = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const { unreadCount } = useAlertStore();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [summaryRes, projectsRes] = await Promise.all([
        analyticsService.getDashboardSummary(),
        projectService.getProjects()
      ]);
      setSummary(summaryRes.data);
      setProjects(projectsRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
      notification.error({ message: 'Error', description: 'Failed to load dashboard metrics.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId) => {
    try {
      await projectService.deleteProject(projectId);
      notification.success({ message: 'Project Cancelled', description: 'The project has been removed.' });
      setProjects(prev => prev.filter(p => p.id !== projectId));
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to cancel project.' });
    }
  };

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <div>
      <PageHeader title="Project Manager Dashboard" />

      {unreadCount > 0 && (
        <Alert
          message={`You have ${unreadCount} unread critical alerts!`}
          type="error"
          showIcon
          action={
            <Button size="small" danger onClick={() => navigate('/pm/alerts')}>
              View Alerts
            </Button>
          }
          style={{ marginBottom: 24 }}
        />
      )}

      <Row gutter={[16, 16]}>
        {/* KPI Cards */}
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Active Projects"
              value={projects.filter(p => ['Approved', 'InProgress', 'OnHold'].includes(p.status)).length}
              prefix={<ProjectOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic title="Total Employees" value={24} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic title="Projects At Risk" value={summary?.atRiskProjects} prefix={<WarningOutlined />} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic title="Unread Alerts" value={unreadCount} prefix={<BellOutlined />} valueStyle={{ color: unreadCount > 0 ? '#fa8c16' : '#3f9142' }} />
          </Card>
        </Col>

        {/* Project Health Grid */}
        <Col span={24}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={4} style={{ margin: 0 }}>Current Projects</Title>
            <Text type="secondary">{projects.filter(p => ['Approved', 'InProgress', 'OnHold'].includes(p.status)).length} Active</Text>
          </div>
          <Row gutter={[16, 16]}>
            {projects
              .filter(project => ['Approved', 'InProgress', 'OnHold'].includes(project.status))
              .map(project => {
                const daysRemaining = 45; // Mock or calculate from project.endDate
                const totalHours = project.totalEstimatedHours || 0;
                const consumed = project.consumedHours || 0;
                
                return (
                  <Col xs={24} md={12} lg={8} key={project.id}>
                    <Card 
                      hoverable
                      actions={[
                        <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/pm/projects/${project.id}`)}>Overview</Button>,
                        <Button type="link" icon={<LineChartOutlined />} onClick={() => navigate(`/pm/analytics/${project.id}`)}>Analytics</Button>,
                        <Popconfirm
                          title="Cancel Project"
                          description="Are you sure you want to delete this project?"
                          onConfirm={() => handleDeleteProject(project.id)}
                          okText="Yes, Delete"
                          cancelText="No"
                          okButtonProps={{ danger: true }}
                        >
                          <Button type="link" danger icon={<DeleteOutlined />}>Cancel</Button>
                        </Popconfirm>
                      ]}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: project.status === 'OnHold' ? '#ff4d4f' : '#52c41a', marginRight: 8 }} />
                        <div style={{ flex: 1 }}>
                          <Text strong style={{ fontSize: '16px' }}>{project.name}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: '12px' }}>{project.client}</Text>
                        </div>
                        <StatusBadge status={project.status} />
                      </div>

                      <Divider style={{ margin: '12px 0' }} />

                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text type="secondary">Hours Progress</Text>
                          <Text strong>{consumed} / {totalHours || 'N/A'} hrs</Text>
                        </div>
                        <HoursProgress consumed={consumed} total={totalHours || 1} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space direction="vertical" size={0}>
                          <Text type="secondary" style={{ fontSize: '12px' }}>Team Lead</Text>
                          <Text strong>{project.teamLead || 'Unassigned'}</Text>
                        </Space>
                        <Tag color={daysRemaining < 7 ? 'red' : 'blue'}>
                          {daysRemaining} days left
                        </Tag>
                      </div>
                    </Card>
                  </Col>
                );
              })}
            {projects.filter(p => ['Approved', 'InProgress', 'OnHold'].includes(p.status)).length === 0 && (
              <Col span={24}>
                <Card style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Text type="secondary">No active projects found. Projects appear here once approved by Accounts.</Text>
                </Card>
              </Col>
            )}
          </Row>
        </Col>
      </Row>
    </div>
  );
};

export default PMDashboardPage;
