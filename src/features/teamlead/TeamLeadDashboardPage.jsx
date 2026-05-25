import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Typography, Tag, Skeleton, Input, Modal, Form, Select, notification, message } from 'antd';
import { EyeOutlined, SearchOutlined, DashboardOutlined, AlertOutlined, DownloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../../services/projectService';
import { analyticsService } from '../../services/analyticsService';
import { ticketService } from '../../services/ticketService';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';

const { Text } = Typography;
const { TextArea } = Input;

const TeamLeadDashboardPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  // Alert Modal State
  const [isAlertModalVisible, setIsAlertModalVisible] = useState(false);
  const [alertForm] = Form.useForm();
  const [submittingAlert, setSubmittingAlert] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await projectService.getProjects();
      // In a real app, this would be filtered by the current user's lead role
      setProjects(res.data);


    } catch (error) {
      console.error('Failed to load projects', error);
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

  const handleDeleteProject = (record) => {
    Modal.confirm({
      title: 'Delete this project?',
      content: `This will permanently delete "${record.name}" (${record.code}) and all associated data. This cannot be undone.`,
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
          await projectService.deleteProject(record.id);
          message.success('Project deleted successfully.');
          fetchProjects();
        } catch (error) {
          console.error('Failed to delete project', error);
          message.error('Failed to delete project. Please try again.');
        }
      }
    });
  };

  const handleRaiseAlert = async (values) => {
    setSubmittingAlert(true);
    try {
      const project = projects.find(p => p.id === values.projectId);
      await analyticsService.createAlert({
        type: values.type,
        severity: values.severity,
        message: values.message,
        projectId: values.projectId,
        projectName: project ? project.name : 'Unknown Project'
      });
      notification.success({ message: 'Alert raised successfully' });
      setIsAlertModalVisible(false);
      alertForm.resetFields();
    } catch (error) {
      notification.error({ message: 'Failed to raise alert' });
    } finally {
      setSubmittingAlert(false);
    }
  };

  const columns = [
    {
      title: 'Project Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>{record.code}</Text>
        </div>
      )
    },
    {
      title: 'Client',
      dataIndex: 'client',
      key: 'client'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <StatusBadge status={status} />
    },
    {
      title: 'Hours (Used/Total)',
      key: 'hours',
      render: (_, record) => (
        <Text>{record.consumedHours} / {record.approvedHours}</Text>
      )
    },
    {
      title: 'Scope',
      key: 'scope',
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
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button 
            icon={<EyeOutlined />} 
            onClick={() => navigate(`/teamlead/projects/${record.id}`)}
          >
            Details
          </Button>
          <Button 
            type="primary" 
            icon={<DashboardOutlined />} 
            onClick={() => navigate(`/teamlead/projects/${record.id}/kanban`)}
          >
            Kanban
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteProject(record)}
          >
            Delete
          </Button>
        </Space>
      )
    }
  ];



  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <div>
      <PageHeader 
        title="Team Lead Projects" 
        extra={
          <Button type="primary" danger icon={<AlertOutlined />} onClick={() => setIsAlertModalVisible(true)}>
            Raise Alert Issue
          </Button>
        }
      />
      
      <div style={{ marginBottom: 16 }}>
        <Input 
          prefix={<SearchOutlined />} 
          placeholder="Filter my projects..." 
          style={{ width: 300 }} 
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      <Table 
        dataSource={projects.filter(project => {
          const term = searchText.toLowerCase();
          return (
            project.name?.toLowerCase().includes(term) ||
            project.code?.toLowerCase().includes(term) ||
            project.client?.toLowerCase().includes(term) ||
            project.status?.toLowerCase().includes(term)
          );
        })} 
        columns={columns} 
        rowKey="id" 
        pagination={{ pageSize: 10 }}
      />




      <Modal
        title="Raise Alert Issue"
        open={isAlertModalVisible}
        onCancel={() => setIsAlertModalVisible(false)}
        onOk={() => alertForm.submit()}
        confirmLoading={submittingAlert}
        okText="Submit Alert"
        okButtonProps={{ danger: true }}
      >
        <Form form={alertForm} layout="vertical" onFinish={handleRaiseAlert}>
          <Form.Item name="projectId" label="Project" rules={[{ required: true }]}>
            <Select placeholder="Select Project">
              {projects.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="type" label="Alert Type" rules={[{ required: true }]}>
            <Select placeholder="Select Type">
              <Select.Option value="Blocker">Blocker</Select.Option>
              <Select.Option value="Timeline Risk">Timeline Risk</Select.Option>
              <Select.Option value="Resource Issue">Resource Issue</Select.Option>
              <Select.Option value="Quality Issue">Quality Issue</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="severity" label="Severity" rules={[{ required: true }]}>
            <Select placeholder="Select Severity">
              <Select.Option value="Critical">Critical</Select.Option>
              <Select.Option value="Normal">Normal</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="message" label="Alert Message" rules={[{ required: true }]}>
            <TextArea rows={4} placeholder="Describe the issue in detail..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TeamLeadDashboardPage;
