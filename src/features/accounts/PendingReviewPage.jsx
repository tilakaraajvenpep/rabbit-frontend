import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tabs, notification, Skeleton, Typography, Modal, message } from 'antd';
import { DownloadOutlined, CalculatorOutlined, DeleteOutlined } from '@ant-design/icons';
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

  const columns = [
    { title: 'Project Code', dataIndex: 'code', key: 'code', render: (text) => <Text code strong>{text}</Text> },
    { 
      title: 'Project Name', 
      dataIndex: 'name', 
      key: 'name', 
      render: (text, record) => (
        <Button 
          type="link" 
          style={{ padding: 0, fontWeight: 600, fontSize: '14px', textAlign: 'left' }} 
          onClick={() => navigate(`/accounts/projects/${record.id}/cost`)}
        >
          {text}
        </Button>
      ) 
    },
    { title: 'Client Name', dataIndex: 'client', key: 'client' },
    { title: 'Submitted Date', dataIndex: 'createdAt', key: 'createdAt', render: (date) => dayjs(date).format('DD MMM YYYY') },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status) => <StatusBadge status={status} /> },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => {
        const isApproved = record.status === 'Approved';
        return (
          <Space size="middle">
            <Button 
              type={isApproved ? "default" : "primary"} 
              icon={<CalculatorOutlined />} 
              onClick={() => navigate(`/accounts/projects/${record.id}/cost`)}
            >
              {isApproved ? 'Edit Cost Analysis' : 'Review & Analyze'}
            </Button>
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            >
              Cancel
            </Button>
          </Space>
        );
      },
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
