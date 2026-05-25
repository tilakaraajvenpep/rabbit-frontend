import React, { useState, useEffect } from 'react';
import { Card, Form, Input, DatePicker, Button, Space, Typography, notification, Upload, Modal, Alert, Descriptions, Divider } from 'antd';
import { ArrowLeftOutlined, InboxOutlined, EyeOutlined, SendOutlined, FileTextOutlined } from '@ant-design/icons';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { projectService } from '../../services/projectService';
import PageHeader from '../../components/common/PageHeader';

const { TextArea } = Input;
const { Title } = Typography;

const CreateProjectPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState(null);
  
  // Review/Preview state
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  const { control, handleSubmit, setValue, formState: { errors } } = useForm({
    defaultValues: {
      name: '',
      client: '',
      expectedStart: null,
      description: '',
      scopeFile: null
    }
  });

  // Load project details if editing
  useEffect(() => {
    if (id) {
      const fetchProject = async () => {
        setLoading(true);
        try {
          const res = await projectService.getProjectById(id);
          const p = res.data;
          setProject(p);
          setValue('name', p.name);
          setValue('client', p.client);
          if (p.startDate) {
            setValue('expectedStart', dayjs(p.startDate));
          }
          setValue('description', p.description);
        } catch (error) {
          console.error(error);
          notification.error({ message: 'Error', description: 'Failed to load project details.' });
        } finally {
          setLoading(false);
        }
      };
      fetchProject();
    }
  }, [id, setValue]);

  const onSubmit = async (data, submitStatus = 'PendingReview') => {
    setLoading(true);
    try {
      const { scopeFile, ...projectData } = data;

      const formattedData = {
        name: projectData.name,
        client: projectData.client,
        expectedStart: projectData.expectedStart ? projectData.expectedStart.toISOString() : null,
        description: projectData.description,
        budgetTable: null, // Budget is inside the scope document
        milestones: null,  // Milestones are inside the scope document
        status: submitStatus
      };

      let response;
      if (id) {
        response = await projectService.updateProject(id, formattedData);
      } else {
        response = await projectService.createProject(formattedData);
      }
      
      const targetProjectId = id || response.data.id;

      // Handle file upload if present
      if (scopeFile) {
        await projectService.uploadDocument(targetProjectId, scopeFile);
        notification.success({
          message: id ? 'Project Updated & Scope Document Uploaded' : 'Project Created & Scope Document Uploaded',
          description: `Successfully processed project and uploaded scope document (containing budget & milestones).`
        });
      } else {
        notification.success({
          message: id ? 'Project Updated' : 'Project Created',
          description: `Project details updated successfully.`
        });
      }
      
      navigate(`/sales/projects/${targetProjectId}/scope`);
    } catch (error) {
      console.error(error);
      notification.error({
        message: 'Error',
        description: error.response?.data?.message || 'Failed to process request. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReviewClick = () => {
    handleSubmit((data) => {
      setPreviewData(data);
      setIsPreviewVisible(true);
    })();
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', paddingBottom: 60 }}>
      <PageHeader 
        title={id ? "Revise Project Details" : "Create New Project"} 
        breadcrumbs={[
          { label: 'My Projects', path: '/sales/projects' },
          { label: id ? 'Revise' : 'Create' }
        ]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/sales/projects')}>
            Back
          </Button>
        }
      />

      {/* Show comments if returned for revision */}
      {project?.status === 'ReturnedForRevision' && (
        <Alert
          message="Revision Required by Accounts"
          description={
            <div>
              <p>Please address the following comments from the accounts team before resubmission:</p>
              <div style={{ 
                background: 'rgba(239, 68, 68, 0.05)', 
                padding: '12px 16px', 
                borderRadius: 6, 
                borderLeft: '4px solid #ef4444', 
                margin: '8px 0', 
                color: '#b91c1c',
                fontWeight: 600,
                whiteSpace: 'pre-wrap'
              }}>
                {project.comments || 'No comments provided.'}
              </div>
            </div>
          }
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Form layout="vertical">
        <Card title="Project Details & Scope Document" style={{ marginBottom: 24 }}>
          <Form.Item 
            label="Project Name" 
            required
            validateStatus={errors.name ? 'error' : ''} 
            help={errors.name?.message}
          >
            <Controller
              name="name"
              control={control}
              rules={{ 
                required: 'Project name is required',
                maxLength: { value: 500, message: 'Maximum 500 characters' }
              }}
              render={({ field }) => (
                <Input {...field} placeholder="Enter project name" showCount maxLength={500} size="large" />
              )}
            />
          </Form.Item>

          <Form.Item 
            label="Client Name" 
            required
            validateStatus={errors.client ? 'error' : ''} 
            help={errors.client?.message}
          >
            <Controller
              name="client"
              control={control}
              rules={{ 
                required: 'Client name is required',
                maxLength: { value: 300, message: 'Maximum 300 characters' }
              }}
              render={({ field }) => (
                <Input {...field} placeholder="Enter client name" showCount maxLength={300} size="large" />
              )}
            />
          </Form.Item>

          <Form.Item 
            label="Expected Start Date" 
            required
            validateStatus={errors.expectedStart ? 'error' : ''} 
            help={errors.expectedStart?.message}
          >
            <Controller
              name="expectedStart"
              control={control}
              rules={{ required: 'Expected start date is required' }}
              render={({ field }) => (
                <DatePicker 
                  {...field} 
                  style={{ width: '100%' }} 
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                  size="large"
                />
              )}
            />
          </Form.Item>

          <Form.Item 
            label="Project Description"
            validateStatus={errors.description ? 'error' : ''} 
            help={errors.description?.message}
          >
            <Controller
              name="description"
              control={control}
              rules={{ maxLength: { value: 2000, message: 'Maximum 2000 characters' } }}
              render={({ field }) => (
                <TextArea {...field} rows={4} placeholder="Enter project description" showCount maxLength={2000} />
              )}
            />
          </Form.Item>

          <Form.Item 
            label="Upload Scope Document (containing Budget & Milestones)"
            required={!id}
            validateStatus={errors.scopeFile ? 'error' : ''}
            help={errors.scopeFile?.message}
          >
            <Controller
              name="scopeFile"
              control={control}
              rules={id ? {} : { required: 'Scope document is required to submit the project' }}
              render={({ field: { value, onChange } }) => (
                <Upload.Dragger
                  name="file"
                  multiple={false}
                  maxCount={1}
                  beforeUpload={(file) => {
                    onChange(file);
                    return false; // Prevent auto-upload
                  }}
                  onRemove={() => onChange(null)}
                  fileList={value ? [value] : []}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">Click or drag scope document to this area to upload</p>
                  <p className="ant-upload-hint">Upload the PDF or DOCX file containing the technical requirements, project budget table, and milestones.</p>
                </Upload.Dragger>
              )}
            />
          </Form.Item>
        </Card>

        {/* Action Panel */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button size="large" onClick={() => navigate('/sales/projects')}>
              Cancel
            </Button>
            <Space size="middle">
              <Button 
                type="default" 
                size="large" 
                icon={<EyeOutlined />}
                onClick={handleReviewClick}
                loading={loading}
              >
                Review and Submit to Accounts
              </Button>
              <Button 
                type="primary" 
                size="large" 
                icon={<SendOutlined />}
                onClick={handleSubmit((data) => onSubmit(data, 'PendingReview'))}
                loading={loading}
              >
                Directly Submit to Accounts
              </Button>
            </Space>
          </div>
        </Card>
      </Form>

      {/* Review and Submit Modal */}
      <Modal
        title={<Title level={4} style={{ margin: 0 }}>Review Project Details</Title>}
        open={isPreviewVisible}
        onOk={() => {
          setIsPreviewVisible(false);
          handleSubmit((data) => onSubmit(data, 'PendingReview'))();
        }}
        onCancel={() => setIsPreviewVisible(false)}
        okText="Confirm & Submit to Accounts"
        cancelText="Go Back & Edit"
        width={700}
        confirmLoading={loading}
      >
        <Divider style={{ margin: '12px 0' }} />
        {previewData && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions title="Project Information" bordered column={2}>
              <Descriptions.Item label="Project Name" span={2}>{previewData.name}</Descriptions.Item>
              <Descriptions.Item label="Client Name">{previewData.client}</Descriptions.Item>
              <Descriptions.Item label="Expected Start Date">
                {previewData.expectedStart ? previewData.expectedStart.format('DD MMM YYYY') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Description" span={2}>{previewData.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="Scope Document" span={2}>
                {previewData.scopeFile ? (
                  <span>
                    <FileTextOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                    {previewData.scopeFile.name} ({(previewData.scopeFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                ) : (
                  <span style={{ color: '#aaa', fontStyle: 'italic' }}>No new document uploaded in this session</span>
                )}
              </Descriptions.Item>
            </Descriptions>

            <Alert
              message="Scope Document Verification"
              description="The project details, itemized budget tables, and milestones are contained within the attached scope document. Accounts will review and extract these details during analysis."
              type="info"
              showIcon
            />
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default CreateProjectPage;
