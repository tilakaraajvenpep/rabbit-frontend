import React, { useState, useEffect } from 'react';
import { Card, Form, Input, DatePicker, Button, Space, Typography, notification, Upload, Modal, Alert, Tag, Select, Divider } from 'antd';
import { ArrowLeftOutlined, InboxOutlined, EyeOutlined, SendOutlined, FileTextOutlined, CalendarOutlined, UserOutlined, TagOutlined, AlignLeftOutlined, FilePdfOutlined, CheckCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { projectService } from '../../services/projectService';
import PageHeader from '../../components/common/PageHeader';

const { TextArea } = Input;
const { Text } = Typography;

// ── Reusable sub-components for the premium Review modal ──

const InfoRow = ({ icon, label, value, accent = '#6366f1', span = false }) => (
  <div style={{
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
    padding: '14px 18px',
    borderRadius: 12,
    background: '#f8fafc',
    border: '1px solid #f1f5f9',
    ...(span ? { gridColumn: '1 / -1' } : {}),
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
      background: `${accent}18`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 16, color: accent,
    }}>
      {icon}
    </div>
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: '#1e293b', lineHeight: 1.55, wordBreak: 'break-word' }}>
        {value || <Text type="secondary" italic>—</Text>}
      </div>
    </div>
  </div>
);

const DocCard = ({ file, label, icon, color }) => (
  <div style={{
    display: 'flex', gap: 14, alignItems: 'center',
    padding: '14px 18px', borderRadius: 12,
    background: file ? `${color}08` : '#f8fafc',
    border: `1px solid ${file ? `${color}28` : '#f1f5f9'}`,
  }}>
    <div style={{
      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
      background: file ? `${color}18` : '#f1f5f9',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 20, color: file ? color : '#94a3b8',
    }}>
      {icon}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
        {label}
      </div>
      {file ? (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <Text strong style={{ fontSize: 13, color: '#1e293b', wordBreak: 'break-all' }}>{file.name}</Text>
          <Tag style={{ borderRadius: 6, fontSize: 11, border: 'none', background: `${color}18`, color, margin: 0 }}>
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </Tag>
        </div>
      ) : (
        <Text type="secondary" italic style={{ fontSize: 13 }}>No new document uploaded in this session</Text>
      )}
    </div>
    {file && <CheckCircleOutlined style={{ color, fontSize: 18, flexShrink: 0 }} />}
  </div>
);

// ── Main Page Component ──

const CreateProjectPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      name: '',
      client: '',
      projectCategory: '',
      expectedStart: null,
      expectedEnd: null,
      description: '',
      scopeFile: null,
      budgetFile: null
    }
  });

  const expectedStart = watch('expectedStart');

  const [categories, setCategories] = useState([
    'Consulting',
    'CRM',
    'HR Activities',
    'Accounts Activities',
    'ERP',
    'Designing',
    'Jumbow',
    'Product development',
    'SEO',
    'Infra maintenance',
    'Digital Marketing',
    'Telecalling',
    'Todook',
    'Website development'
  ]);
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleAddCategory = (e) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (trimmed) {
      setCategories(prev => {
        if (!prev.includes(trimmed)) {
          return [...prev, trimmed];
        }
        return prev;
      });
      setValue('projectCategory', trimmed);
      setNewCategoryName('');
    }
  };

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
          if (p.projectCategory) {
            setCategories(prev => {
              if (!prev.includes(p.projectCategory)) {
                return [...prev, p.projectCategory];
              }
              return prev;
            });
          }
          setValue('projectCategory', p.projectCategory || '');
          if (p.startDate) setValue('expectedStart', dayjs(p.startDate));
          if (p.endDate) setValue('expectedEnd', dayjs(p.endDate));
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
      const { scopeFile, budgetFile, ...projectData } = data;
      const formattedData = {
        name: projectData.name,
        client: projectData.client,
        projectCategory: projectData.projectCategory,
        expectedStart: projectData.expectedStart ? projectData.expectedStart.toISOString() : null,
        expectedEnd: projectData.expectedEnd ? projectData.expectedEnd.toISOString() : null,
        description: projectData.description,
        budgetTable: null,
        milestones: null,
        status: submitStatus
      };

      let response;
      if (id) {
        response = await projectService.updateProject(id, formattedData);
      } else {
        response = await projectService.createProject(formattedData);
      }

      const targetProjectId = id || response.data.id;
      if (scopeFile) await projectService.uploadDocument(targetProjectId, scopeFile, 'scope');
      if (budgetFile) await projectService.uploadDocument(targetProjectId, budgetFile, 'budget_milestones');

      notification.success({
        message: id ? 'Project Updated' : 'Project Created',
        description: 'Successfully processed project and uploaded files.'
      });
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
        title={id ? 'Revise Project Details' : 'Create New Project'}
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

      {project?.status === 'ReturnedForRevision' && (
        <Alert
          message="Revision Required by Accounts"
          description={
            <div>
              <p>Please address the following comments before resubmission:</p>
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
          <Form.Item label="Project Name" required validateStatus={errors.name ? 'error' : ''} help={errors.name?.message}>
            <Controller
              name="name"
              control={control}
              rules={{ required: 'Project name is required', maxLength: { value: 500, message: 'Maximum 500 characters' } }}
              render={({ field }) => <Input {...field} placeholder="Enter project name" showCount maxLength={500} size="large" />}
            />
          </Form.Item>

          <Form.Item label="Client Name" required validateStatus={errors.client ? 'error' : ''} help={errors.client?.message}>
            <Controller
              name="client"
              control={control}
              rules={{ required: 'Client name is required', maxLength: { value: 300, message: 'Maximum 300 characters' } }}
              render={({ field }) => <Input {...field} placeholder="Enter client name" showCount maxLength={300} size="large" />}
            />
          </Form.Item>

          <Form.Item label="Project Category" required validateStatus={errors.projectCategory ? 'error' : ''} help={errors.projectCategory?.message}>
            <Controller
              name="projectCategory"
              control={control}
              rules={{ required: 'Project category is required', maxLength: { value: 255, message: 'Maximum 255 characters' } }}
              render={({ field }) => (
                <Select
                  {...field}
                  showSearch
                  placeholder="Select project category"
                  size="large"
                  dropdownRender={(menu) => (
                    <>
                      {menu}
                      <Divider style={{ margin: '8px 0' }} />
                      <div style={{ display: 'flex', gap: 8, padding: '4px 8px' }}>
                        <Input
                          placeholder="Add custom category"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          size="middle"
                        />
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={handleAddCategory}
                        >
                          Add
                        </Button>
                      </div>
                    </>
                  )}
                  options={categories.map((item) => ({ label: item, value: item }))}
                />
              )}
            />
          </Form.Item>

          <Form.Item label="Expected Start Date" required validateStatus={errors.expectedStart ? 'error' : ''} help={errors.expectedStart?.message}>
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

          <Form.Item label="Expected End Date" required validateStatus={errors.expectedEnd ? 'error' : ''} help={errors.expectedEnd?.message}>
            <Controller
              name="expectedEnd"
              control={control}
              rules={{ required: 'Expected end date is required' }}
              render={({ field }) => (
                <DatePicker
                  {...field}
                  style={{ width: '100%' }}
                  disabledDate={(current) => {
                    if (!current) return false;
                    if (expectedStart) {
                      return current.isBefore(expectedStart, 'day');
                    }
                    return current < dayjs().startOf('day');
                  }}
                  size="large"
                />
              )}
            />
          </Form.Item>

          <Form.Item label="Project Description" validateStatus={errors.description ? 'error' : ''} help={errors.description?.message}>
            <Controller
              name="description"
              control={control}
              rules={{ maxLength: { value: 2000, message: 'Maximum 2000 characters' } }}
              render={({ field }) => <TextArea {...field} rows={4} placeholder="Enter project description" showCount maxLength={2000} />}
            />
          </Form.Item>

          <Form.Item label="Upload Project Scope Document (Optional)" validateStatus={errors.scopeFile ? 'error' : ''} help={errors.scopeFile?.message}>
            <Controller
              name="scopeFile"
              control={control}
              rules={{}}
              render={({ field: { value, onChange } }) => (
                <Upload.Dragger name="file" multiple={false} maxCount={1} beforeUpload={(file) => { onChange(file); return false; }} onRemove={() => onChange(null)} fileList={value ? [value] : []}>
                  <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                  <p className="ant-upload-text">Click or drag scope document to this area to upload</p>
                  <p className="ant-upload-hint">Upload the PDF or DOCX file containing the technical requirements and project scope details.</p>
                </Upload.Dragger>
              )}
            />
          </Form.Item>

          <Form.Item label="Upload Budget and Milestones Document (Optional)" validateStatus={errors.budgetFile ? 'error' : ''} help={errors.budgetFile?.message}>
            <Controller
              name="budgetFile"
              control={control}
              rules={{}}
              render={({ field: { value, onChange } }) => (
                <Upload.Dragger name="file" multiple={false} maxCount={1} beforeUpload={(file) => { onChange(file); return false; }} onRemove={() => onChange(null)} fileList={value ? [value] : []}>
                  <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                  <p className="ant-upload-text">Click or drag budget & milestones document to this area to upload</p>
                  <p className="ant-upload-hint">Upload the PDF or DOCX file containing the itemized budget table and milestones breakdown.</p>
                </Upload.Dragger>
              )}
            />
          </Form.Item>
        </Card>

        {/* Action Panel */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button size="large" onClick={() => navigate('/sales/projects')}>Cancel</Button>
            <Space size="middle">
              <Button type="default" size="large" icon={<EyeOutlined />} onClick={handleReviewClick} loading={loading}>
                Review and Submit to Accounts
              </Button>
              <Button type="primary" size="large" icon={<SendOutlined />} onClick={handleSubmit((data) => onSubmit(data, 'PendingReview'))} loading={loading}>
                Directly Submit to Accounts
              </Button>
            </Space>
          </div>
        </Card>
      </Form>

      {/* ── Premium Review Modal ── */}
      <Modal
        title={null}
        open={isPreviewVisible}
        onOk={() => {
          setIsPreviewVisible(false);
          handleSubmit((data) => onSubmit(data, 'PendingReview'))();
        }}
        onCancel={() => setIsPreviewVisible(false)}
        okText="Confirm & Submit to Accounts"
        cancelText="Go Back & Edit"
        width={680}
        confirmLoading={loading}
        okButtonProps={{
          size: 'large',
          style: {
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            border: 'none',
            height: 44,
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
          }
        }}
        cancelButtonProps={{ size: 'large', style: { height: 44, borderRadius: 10 } }}
        styles={{ body: { padding: 0 } }}
      >
        {/* Gradient Header Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
          borderRadius: '8px 8px 0 0',
          padding: '22px 28px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 12,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, color: '#fff',
            }}>
              <EyeOutlined />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1.25 }}>
                Review Project Details
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 4 }}>
                Please verify all information before submitting to Accounts
              </div>
            </div>
          </div>
        </div>

        {previewData && (
          <div style={{ padding: '20px 24px 16px' }}>

            {/* Section: Project Info */}
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Project Information
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
              <InfoRow icon={<FileTextOutlined />} label="Project Name" value={previewData.name} accent="#6366f1" span />
              <InfoRow icon={<UserOutlined />} label="Client Name" value={previewData.client} accent="#0ea5e9" />
              <InfoRow
                icon={<TagOutlined />}
                label="Project Category"
                value={
                  <Tag style={{ borderRadius: 6, fontWeight: 600, border: 'none', background: '#eff6ff', color: '#2563eb', fontSize: 13 }}>
                    {previewData.projectCategory}
                  </Tag>
                }
                accent="#0ea5e9"
              />
              <InfoRow
                icon={<CalendarOutlined />}
                label="Expected Start Date"
                value={previewData.expectedStart ? previewData.expectedStart.format('DD MMMM YYYY') : '—'}
                accent="#10b981"
              />
              <InfoRow
                icon={<CalendarOutlined />}
                label="Expected End Date"
                value={previewData.expectedEnd ? previewData.expectedEnd.format('DD MMMM YYYY') : '—'}
                accent="#ef4444"
              />
              <InfoRow icon={<AlignLeftOutlined />} label="Project Description" value={previewData.description || '—'} accent="#f59e0b" span />
            </div>

            {/* Section: Documents */}
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Attached Documents
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              <DocCard file={previewData.scopeFile} label="Project Scope Document" icon={<FilePdfOutlined />} color="#6366f1" />
              <DocCard file={previewData.budgetFile} label="Budget & Milestones Document" icon={<FilePdfOutlined />} color="#10b981" />
            </div>

            {/* Ready Notice */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(79,70,229,0.02))',
              border: '1px solid rgba(99,102,241,0.15)',
              borderRadius: 12,
              padding: '14px 18px',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}>
              <CheckCircleOutlined style={{ color: '#6366f1', fontSize: 18, marginTop: 1, flexShrink: 0 }} />
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                <strong style={{ color: '#1e293b' }}>Ready for Submission. </strong>
                The scope, budget tables, and milestones are contained within the attached documents.
                Accounts will review Budget & Milestones; PMs and TLs will access the Project Scope.
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CreateProjectPage;
