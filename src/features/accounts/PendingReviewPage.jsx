import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Space, Tabs, notification, Skeleton, Typography, Modal, message,
  Row, Col, Card, Tag, Tooltip
} from 'antd';
import { 
  DownloadOutlined, CalculatorOutlined, DeleteOutlined, 
  FolderOpenOutlined, ClockCircleOutlined, ExclamationCircleOutlined, 
  RollbackOutlined, CalendarOutlined, FileTextOutlined, CodeOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { projectService } from '../../services/projectService';
import { useThemeStore } from '../../store/themeStore';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';

const { Text, Title } = Typography;

const PendingReviewPage = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useThemeStore();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PendingReview');

  useEffect(() => {
    fetchPendingProjects();
  }, []);

  const fetchPendingProjects = async () => {
    setLoading(true);
    try {
      const response = await projectService.getProjects();
      setProjects(response.data);
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load pending projects.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: 'Cancel and delete this project?',
      content: `This will permanently delete "${record.name}" (${record.code}) and all associated data from the database. This cannot be undone.`,
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
          await projectService.deleteProject(record.id);
          message.success('Project deleted successfully.');
          fetchPendingProjects();
        } catch (error) {
          console.error('Failed to delete project', error);
          message.error('Failed to delete project. Please try again.');
        }
      }
    });
  };

  const filteredProjects = projects.filter(p => {
    if (activeTab === 'All') return true;
    return p.status === activeTab;
  });

  // Calculate statistics
  const countAll = projects.length;
  const countPending = projects.filter(p => p.status === 'PendingReview').length;
  const countReturnedPM = projects.filter(p => p.status === 'ReturnedToAccounts').length;
  const countReturnedSales = projects.filter(p => p.status === 'ReturnedForRevision').length;

  const columns = [
    { 
      title: 'Project Code', 
      dataIndex: 'code', 
      key: 'code', 
      width: '12%',
      render: (text) => (
        <Tag color="geekblue" style={{ borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, padding: '4px 8px' }}>
          <CodeOutlined />
          <span>{text}</span>
        </Tag>
      ) 
    },
    { 
      title: 'Project Name', 
      dataIndex: 'name', 
      key: 'name', 
      width: '32%',
      render: (text, record) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Button 
            type="link" 
            style={{ padding: 0, fontWeight: 700, fontSize: '14.5px', textAlign: 'left', height: 'auto', color: '#6366f1' }} 
            onClick={() => navigate(`/accounts/projects/${record.id}/cost`)}
          >
            {text}
          </Button>
          {record.comments && record.status.startsWith('Returned') && (
            <Text type="danger" style={{ fontSize: '12px' }} ellipsis={{ tooltip: record.comments }}>
              Reason: {record.comments}
            </Text>
          )}
        </div>
      ) 
    },
    { 
      title: 'Client Name', 
      dataIndex: 'client', 
      key: 'client',
      width: '15%',
      render: (text) => <Text style={{ fontWeight: 500 }}>{text}</Text>
    },
    { 
      title: 'Project Category', 
      dataIndex: 'projectCategory', 
      key: 'projectCategory', 
      width: '12%',
      render: (text) => text ? <Tag color="blue" style={{ borderRadius: 4, fontWeight: 600 }}>{text}</Tag> : <Text type="secondary" italic>N/A</Text> 
    },
    { 
      title: 'Submitted Date', 
      dataIndex: 'createdAt', 
      key: 'createdAt', 
      width: '13%',
      render: (date) => (
        <Space size={6} style={{ color: '#64748b' }}>
          <CalendarOutlined />
          <span style={{ fontWeight: 500 }}>{dayjs(date).format('DD MMM YYYY')}</span>
        </Space>
      )
    },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status', 
      width: '10%',
      render: (status) => <StatusBadge status={status} /> 
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '16%',
      render: (_, record) => {
        const isApproved = record.status === 'Approved';
        return (
          <Space size="middle">
            <Button 
              type={isApproved ? "default" : "primary"} 
              icon={<CalculatorOutlined />} 
              style={{ borderRadius: 8 }}
              onClick={() => navigate(`/accounts/projects/${record.id}/cost`)}
            >
              {isApproved ? 'Edit Cost' : 'Analyze'}
            </Button>
            <Tooltip title="Delete project proposal">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record)}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  const tabItems = [
    { key: 'All', label: `All Projects (${countAll})` },
    { key: 'PendingReview', label: `Pending Review (${countPending})` },
    { key: 'ReturnedToAccounts', label: `Returned by PM (${countReturnedPM})` },
    { key: 'ReturnedForRevision', label: `Returned to Sales (${countReturnedSales})` },
  ];

  const statCards = [
    { 
      key: 'All', 
      title: 'All Projects', 
      count: countAll, 
      color: '#6366f1', 
      bg: 'rgba(99, 102, 241, 0.05)',
      icon: <FolderOpenOutlined style={{ fontSize: 24, color: '#6366f1' }} /> 
    },
    { 
      key: 'PendingReview', 
      title: 'Pending Review', 
      count: countPending, 
      color: '#f59e0b', 
      bg: 'rgba(245, 158, 11, 0.05)',
      icon: <ClockCircleOutlined style={{ fontSize: 24, color: '#f59e0b' }} /> 
    },
    { 
      key: 'ReturnedToAccounts', 
      title: 'Returned by PM', 
      count: countReturnedPM, 
      color: '#ef4444', 
      bg: 'rgba(239, 68, 68, 0.05)',
      icon: <ExclamationCircleOutlined style={{ fontSize: 24, color: '#ef4444' }} /> 
    },
    { 
      key: 'ReturnedForRevision', 
      title: 'Returned to Sales', 
      count: countReturnedSales, 
      color: '#64748b', 
      bg: 'rgba(100, 116, 139, 0.05)',
      icon: <RollbackOutlined style={{ fontSize: 24, color: '#64748b' }} /> 
    },
  ];

  return (
    <div style={{ paddingBottom: 60 }}>
      <PageHeader 
        title="Pending Review" 
        breadcrumbs={[{ label: 'Accounts Dashboard', path: '/accounts' }, { label: 'Pending Review' }]} 
      />

      {/* METRIC CARD STATS */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statCards.map(card => {
          const isActive = activeTab === card.key;
          return (
            <Col xs={12} sm={12} md={6} key={card.key}>
              <Card
                hoverable
                onClick={() => setActiveTab(card.key)}
                style={{ 
                  borderRadius: 14, 
                  background: isDarkMode ? '#17171a' : '#ffffff',
                  border: `1px solid ${isActive ? card.color : (isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)')}`,
                  boxShadow: isActive ? `0 8px 24px -4px ${card.color}25` : '0 4px 12px rgba(0,0,0,0.01)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                bodyStyle={{ padding: '20px 24px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: '13.5px', fontWeight: 600 }}>{card.title}</Text>
                    <div style={{ marginTop: 4 }}>
                      <Title level={2} style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: isDarkMode ? '#f4f4f5' : '#0f172a' }}>
                        {card.count}
                      </Title>
                    </div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 10, background: card.bg }}>
                    {card.icon}
                  </div>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      <Card 
        style={{ 
          borderRadius: 14, 
          background: isDarkMode ? '#131316' : '#ffffff',
          border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`
        }}
        bodyStyle={{ padding: '24px 20px' }}
      >
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab} 
          items={tabItems}
          style={{ marginBottom: 20 }}
        />

        {loading ? (
          <Skeleton active paragraph={{ rows: 8 }} style={{ padding: 16 }} />
        ) : filteredProjects.length > 0 ? (
          <Table 
            columns={columns} 
            dataSource={filteredProjects} 
            rowKey="id" 
            pagination={{ pageSize: 8, showSizeChanger: false }}
            style={{ borderRadius: 12, overflow: 'hidden' }}
          />
        ) : (
          <EmptyState message={`No projects found under "${tabItems.find(t => t.key === activeTab)?.label.split(' (')[0]}" status.`} />
        )}
      </Card>
    </div>
  );
};

export default PendingReviewPage;
