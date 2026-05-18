import React, { useState, useEffect, useMemo } from 'react';
import { Table, Input, Button, Space, Typography, Skeleton } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { projectService } from '../../services/projectService';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';

const { Text } = Typography;

const ProjectListPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const response = await projectService.getProjects();
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(p => 
      p.name.toLowerCase().includes(searchText.toLowerCase()) ||
      p.client.toLowerCase().includes(searchText.toLowerCase()) ||
      p.code.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [projects, searchText]);

  const columns = [
    {
      title: 'Project Code',
      dataIndex: 'code',
      key: 'code',
      render: (text) => <Text code strong>{text}</Text>,
    },
    {
      title: 'Project Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Text strong style={{ cursor: 'pointer', color: '#1890ff' }} onClick={() => navigate(`/sales/projects/${record.id}/scope`)}>
          {text}
        </Text>
      ),
    },
    {
      title: 'Client Name',
      dataIndex: 'client',
      key: 'client',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <StatusBadge status={status} />,
    },
    {
      title: 'Created Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('DD MMM YYYY'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button 
          type="link" 
          icon={<EyeOutlined />} 
          onClick={() => navigate(`/sales/projects/${record.id}/scope`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader 
        title="My Projects" 
        extra={
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => navigate('/sales/projects/create')}
          >
            Create Project
          </Button>
        }
      />

      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Input
          placeholder="Search projects by name, client or code..."
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          size="large"
          allowClear
          style={{ maxWidth: 400 }}
        />

        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : filteredProjects.length > 0 ? (
          <Table 
            columns={columns} 
            dataSource={filteredProjects} 
            rowKey="id"
            pagination={{ pageSize: 20 }}
            onRow={(record) => ({
              onClick: () => navigate(`/sales/projects/${record.id}/scope`),
              style: { cursor: 'pointer' }
            })}
          />
        ) : (
          <EmptyState 
            message={searchText ? "No projects match your search." : "No projects yet. Create your first project."} 
            actionText={searchText ? null : "Create Project"}
            onAction={searchText ? null : () => navigate('/sales/projects/create')}
          />
        )}
      </Space>
    </div>
  );
};

export default ProjectListPage;
