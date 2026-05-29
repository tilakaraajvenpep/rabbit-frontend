import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Typography, Upload, Table, Alert, notification, Descriptions, Divider } from 'antd';
import { InboxOutlined, CloudUploadOutlined, DownloadOutlined, SendOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { projectService } from '../../services/projectService';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';

const { Dragger } = Upload;
const { Title, Text, Paragraph } = Typography;

const ScopeUploadPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    fetchProject();
  }, [id]);

  const fetchProject = async () => {
    setLoading(true);
    try {
      const [projRes, docRes] = await Promise.all([
        projectService.getProjectById(id),
        projectService.getDocuments(id)
      ]);
      setProject(projRes.data);
      
      const mappedDocs = (docRes.data || []).map(d => ({
        id: d.documentId || d.id,
        name: d.fileName || d.name,
        version: String(d.version || '1.0'),
        uploadedBy: d.uploadedBy || 'Sales Manager',
        uploadDate: d.createdAt || d.uploadDate,
        status: d.status
      }));
      setDocuments(mappedDocs.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true })));
    } catch (error) {
      console.error('Scope Load Error:', error);
      notification.error({ 
        message: 'Load Failed', 
        description: error.response?.data?.message || error.message || 'Failed to load project documents.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (fileList.length === 0) return;
    
    setUploading(true);
    try {
      const file = fileList[0];
      await projectService.uploadDocument(id, file);
      
      const newDoc = {
        id: 'd' + (documents.length + 1),
        name: file.name,
        version: (documents.length + 1) + '.0',
        uploadedBy: 'Sales Manager',
        uploadDate: new Date().toISOString(),
        status: 'Pending'
      };
      
      setFileList([]);
      notification.success({ message: 'Success', description: 'Document uploaded successfully.' });
      fetchProject(); // Reload with real IDs and versions
    } catch (error) {
      notification.error({ message: 'Error', description: 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitReview = async () => {
    try {
      await projectService.submitForReview(id);
      notification.success({ message: 'Submitted', description: 'Project sent to accounts team for review.' });
      fetchProject(); // Refresh status
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to submit for review.' });
    }
  };

  const columns = [
    { title: 'Version', dataIndex: 'version', key: 'version' },
    { title: 'File Name', dataIndex: 'name', key: 'name' },
    { title: 'Uploaded By', dataIndex: 'uploadedBy', key: 'uploadedBy' },
    { 
      title: 'Upload Date', 
      dataIndex: 'uploadDate', 
      key: 'uploadDate',
      render: (date) => dayjs(date).format('DD MMM YYYY HH:mm')
    },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => <StatusBadge status={status} />
    },
    { 
      title: 'Download', 
      key: 'download',
      render: () => <Button icon={<DownloadOutlined />} type="link" />
    },
  ];

  if (loading) return <Card loading />;
  if (!project) return <Alert message="Project not found" type="error" />;

  const isSubmitDisabled = documents.length === 0;

  return (
    <div>
      <PageHeader 
        title={`Scope Documents — ${project.name}`}
        breadcrumbs={[
          { label: 'My Projects', path: '/sales/projects' },
          { label: project.code }
        ]}
      />

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card 
          title="Project Details"
          extra={
            (project.status === 'ReturnedForRevision' || project.status === 'Draft') && (
              <Button 
                type="primary" 
                ghost 
                onClick={() => navigate(`/sales/projects/${project.id}/edit`)}
              >
                Edit Details, Budget & Milestones
              </Button>
            )
          }
        >
          <Descriptions bordered column={{ xxl: 4, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }}>
            <Descriptions.Item label="Project Code"><Text code>{project.code}</Text></Descriptions.Item>
            <Descriptions.Item label="Client">{project.client}</Descriptions.Item>
            <Descriptions.Item label="Project Category">{project.projectCategory || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="Status"><StatusBadge status={project.status} /></Descriptions.Item>
            <Descriptions.Item label="Description" span={3}>{project.description}</Descriptions.Item>
          </Descriptions>
        </Card>

        {project.status === 'ReturnedForRevision' && (
          <Alert
            message="Revision Required"
            description={
              <div>
                <p>The accounts team has requested a revision. <strong>Comments from Accounts:</strong></p>
                <div style={{ 
                  background: 'rgba(239, 68, 68, 0.05)', 
                  padding: '12px 16px', 
                  borderRadius: 6, 
                  borderLeft: '4px solid #ef4444', 
                  margin: '8px 0', 
                  color: '#b91c1c',
                  fontWeight: 500,
                  whiteSpace: 'pre-wrap'
                }}>
                  {project.comments || 'No comments provided.'}
                </div>
                <p>Please click the button above to edit project details, or upload a revised scope document below and click "Submit for Review".</p>
              </div>
            }
            type="error"
            showIcon
          />
        )}

        {project.budgetTable && project.budgetTable.length > 0 && (
          <Card title="Project Budget Table">
            <Table
              dataSource={project.budgetTable}
              pagination={false}
              rowKey={(record, idx) => idx}
              columns={[
                { title: 'Item/Phase Description', dataIndex: 'item', key: 'item' },
                { 
                  title: 'Estimated Cost', 
                  dataIndex: 'cost', 
                  key: 'cost', 
                  render: (cost) => `₹${Number(cost).toLocaleString('en-IN')}` 
                },
                { title: 'Estimated Hours', dataIndex: 'hours', key: 'hours' },
              ]}
            />
          </Card>
        )}

        {project.milestones && project.milestones.length > 0 && (
          <Card title="Project Milestones">
            <Table
              dataSource={project.milestones}
              pagination={false}
              rowKey={(record, idx) => idx}
              columns={[
                { title: 'Milestone Title', dataIndex: 'title', key: 'title' },
                { 
                  title: 'Target Date', 
                  dataIndex: 'date', 
                  key: 'date',
                  render: (date) => date ? dayjs(date).format('DD MMM YYYY') : '-'
                },
                { 
                  title: 'Payment/Budget Allocation', 
                  dataIndex: 'amount', 
                  key: 'amount', 
                  render: (amt) => amt ? `₹${Number(amt).toLocaleString('en-IN')}` : '-'
                },
                { title: 'Description', dataIndex: 'description', key: 'description' },
              ]}
            />
          </Card>
        )}

        <Card title="Upload Scope Document">
          <Dragger
            accept=".pdf,.docx"
            maxCount={1}
            beforeUpload={(file) => {
              const isLt20M = file.size / 1024 / 1024 < 20;
              if (!isLt20M) {
                notification.error({ message: 'File too large', description: 'File must be smaller than 20MB!' });
                return Upload.LIST_IGNORE;
              }
              setFileList([file]);
              return false;
            }}
            fileList={fileList}
            onRemove={() => setFileList([])}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Click or drag file to this area to upload</p>
            <p className="ant-upload-hint">Support for .pdf and .docx only. Max size 20MB.</p>
          </Dragger>
          
          <Button 
            type="primary" 
            icon={<CloudUploadOutlined />} 
            style={{ marginTop: 16 }}
            onClick={handleUpload}
            loading={uploading}
            disabled={fileList.length === 0}
          >
            Upload Document
          </Button>
        </Card>

        <Card title="Uploaded Versions">
          <Table 
            columns={columns} 
            dataSource={documents} 
            rowKey="id" 
            pagination={false}
          />
          
          <Divider />
          
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button 
              type="primary" 
              size="large" 
              icon={<SendOutlined />} 
              onClick={handleSubmitReview}
              disabled={isSubmitDisabled}
            >
              Submit for Review
            </Button>
          </div>
        </Card>
      </Space>
    </div>
  );
};

export default ScopeUploadPage;
