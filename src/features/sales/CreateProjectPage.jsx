import React, { useState } from 'react';
import { Card, Form, Input, DatePicker, Button, Space, Typography, notification, Upload } from 'antd';
import { ArrowLeftOutlined, InboxOutlined } from '@ant-design/icons';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { projectService } from '../../services/projectService';
import PageHeader from '../../components/common/PageHeader';

const { TextArea } = Input;
const { Text } = Typography;

const CreateProjectPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const { control, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      name: '',
      client: '',
      expectedStart: null,
      description: ''
    }
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const { scopeFile, ...projectData } = data;
      
      const formattedData = {
        ...projectData,
        expectedStart: projectData.expectedStart ? projectData.expectedStart.toISOString() : null
      };
      
      const response = await projectService.createProject(formattedData);
      const projectId = response.data.id;

      // Handle file upload if present
      if (scopeFile) {
        await projectService.uploadDocument(projectId, scopeFile);
        notification.success({
          message: 'Project & Scope Uploaded',
          description: `Project ${response.data.code} created and scope document uploaded successfully.`
        });
      } else {
        notification.success({
          message: 'Project Created',
          description: `Project ${response.data.code} has been created successfully.`
        });
      }
      
      navigate('/sales/projects');
    } catch (error) {
      notification.error({
        message: 'Error',
        description: 'Failed to process request. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <PageHeader 
        title="Create New Project" 
        breadcrumbs={[
          { label: 'My Projects', path: '/sales/projects' },
          { label: 'Create' }
        ]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/sales/projects')}>
            Back
          </Button>
        }
      />

      <Card>
        <Form layout="vertical" onFinish={handleSubmit(onSubmit)}>
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
            label="Upload Scope Document"
            extra="PDF, DOCX or ZIP (Max 10MB)"
          >
            <Controller
              name="scopeFile"
              control={control}
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
                  <p className="ant-upload-hint">Support for a single upload of scope definitions or technical requirements.</p>
                </Upload.Dragger>
              )}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit" size="large" loading={loading}>
                Create Project & Upload Scope
              </Button>
              <Button size="large" onClick={() => navigate('/sales/projects')}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default CreateProjectPage;
