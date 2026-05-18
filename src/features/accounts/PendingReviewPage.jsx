import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tabs, notification, Skeleton, Typography } from 'antd';
import { DownloadOutlined, CalculatorOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { projectService } from '../../services/projectService';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';

const { Text } = Typography;

const PendingReviewPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PendingReview');

  useEffect(() => {
    fetchPendingProjects();
  }, []);

  const fetchPendingProjects = async () => {
    setLoading(true);
    try {
      // In a real scenario, we might fetch all projects and filter, 
      // but the service handles mock filtering for us.
      const response = await projectService.getProjects();
      setProjects(response.data);
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load pending projects.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (projectId) => {
    try {
      const docsRes = await projectService.getDocuments(projectId);
      if (docsRes.data && docsRes.data.length > 0) {
        const latestDoc = docsRes.data[0];
        await projectService.downloadDocument(projectId, latestDoc.documentId, latestDoc.fileName);
      } else {
        notification.warning({ message: 'Not Found', description: 'No scope document found.' });
      }
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to download document.' });
    }
  };

  const filteredProjects = projects.filter(p => {
    if (activeTab === 'All') return true;
    return p.status === activeTab;
  });

  const columns = [
    { title: 'Project Code', dataIndex: 'code', key: 'code', render: (text) => <Text code strong>{text}</Text> },
    { title: 'Project Name', dataIndex: 'name', key: 'name', render: (text) => <Text strong>{text}</Text> },
    { title: 'Client Name', dataIndex: 'client', key: 'client' },
    { title: 'Submitted Date', dataIndex: 'createdAt', key: 'createdAt', render: (date) => dayjs(date).format('DD MMM YYYY') },
    { 
      title: 'Document', 
      key: 'document', 
      render: (_, record) => (
        <Button 
          icon={<DownloadOutlined />} 
          type="link" 
          onClick={() => handleDownload(record.id)}
        >
          Scope.pdf
        </Button> 
      )
    },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status) => <StatusBadge status={status} /> },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button 
          type="primary" 
          icon={<CalculatorOutlined />} 
          onClick={() => navigate(`/accounts/projects/${record.id}/cost`)}
          disabled={record.status === 'Approved'}
        >
          Review & Analyze
        </Button>
      ),
    },
  ];

  const tabItems = [
    { key: 'All', label: 'All Projects' },
    { key: 'PendingReview', label: 'Pending Review' },
    { key: 'ReturnedForRevision', label: 'Returned' },
  ];

  return (
    <div>
      <PageHeader title="Pending Review" />

      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab} 
        items={tabItems}
        style={{ marginBottom: 16 }}
      />

      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : filteredProjects.length > 0 ? (
        <Table 
          columns={columns} 
          dataSource={filteredProjects} 
          rowKey="id" 
          pagination={{ pageSize: 10 }}
        />
      ) : (
        <EmptyState message={`No projects in "${activeTab}" status.`} />
      )}
    </div>
  );
};

export default PendingReviewPage;
