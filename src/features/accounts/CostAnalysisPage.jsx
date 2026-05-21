import React, { useState, useEffect } from 'react';
import { Card, Form, Input, InputNumber, DatePicker, Button, Space, Table, Modal, Alert, notification, Row, Col, Typography, Divider, Descriptions, Result, Select, theme } from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined, 
  CheckCircleOutlined, 
  RollbackOutlined,
  DownloadOutlined,
  CalculatorOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { projectService } from '../../services/projectService';
import { adminService } from '../../services/adminService';
import { useThemeStore } from '../../store/themeStore';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';

const { TextArea } = Input;
const { Title, Text } = Typography;

const CostAnalysisPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const { isDarkMode } = useThemeStore();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isReturnModalVisible, setIsReturnModalVisible] = useState(false);
  const [returnComments, setReturnComments] = useState('');
  const [latestDoc, setLatestDoc] = useState(null);
  const [teamLeads, setTeamLeads] = useState([]);
  const [isSelectTLModalVisible, setIsSelectTLModalVisible] = useState(false);
  const [selectedTLId, setSelectedTLId] = useState(undefined);
  const [tempFormData, setTempFormData] = useState(null);

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      totalBudget: 0,
      contingencyBuffer: 10,
      estimatedHours: 0,
      completionDate: null,
      phases: [{ name: '', hours: 0, cost: 0 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'phases'
  });

  const watchedPhases = watch('phases');
  const watchedBudget = watch('totalBudget');
  const watchedHours = watch('estimatedHours');

  const totalPhaseHours = Math.round(watchedPhases.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0));
  const totalPhaseCost = Math.round(watchedPhases.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0));

  useEffect(() => {
    fetchProject();
  }, [id]);

  const fetchProject = async () => {
    setLoading(true);
    try {
      // Always load the project
      const projRes = await projectService.getProjectById(id);
      setProject(projRes.data);

      // Load cost analysis — may not exist yet (404 is ok)
      try {
        const analysisRes = await projectService.getCostAnalysis(id);
        if (analysisRes.data) {
          setValue('totalBudget', analysisRes.data.totalBudget);
          setValue('contingencyBuffer', analysisRes.data.contingencyBuffer || 10);
          setValue('estimatedHours', analysisRes.data.estimatedHours);
          if (analysisRes.data.completionDate) {
            setValue('completionDate', dayjs(analysisRes.data.completionDate));
          }
          if (analysisRes.data.phases) {
            setValue('phases', analysisRes.data.phases);
          }
        }
      } catch {
        // Cost analysis doesn't exist yet — start fresh
      }

      // Load documents — may not exist yet (404 is ok)
      try {
        const docsRes = await projectService.getDocuments(id);
        if (docsRes.data && docsRes.data.length > 0) {
          setLatestDoc(docsRes.data[0]);
        }
      } catch {
        // No documents yet
      }

      // Fetch Team Leads list
      try {
        const usersRes = await adminService.getUsers();
        if (usersRes.data) {
          const tls = usersRes.data.filter(u => u.role === 'TeamLead' && u.isActive);
          setTeamLeads(tls);
        }
      } catch (err) {
        console.error('Failed to load team leads:', err);
      }

    } catch (error) {
      console.error('Fetch Project Details Error:', error);
      notification.error({ message: 'Error', description: 'Failed to load project details.' });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    if (totalPhaseHours !== watchedHours) {
      notification.warning({ message: 'Validation Warning', description: 'Phase hours must match total estimated hours.' });
      return;
    }
    
    setTempFormData(data);
    setIsSelectTLModalVisible(true);
  };

  const handleForwardToTL = async () => {
    if (!selectedTLId) {
      notification.error({ message: 'Validation', description: 'Please select a Team Lead.' });
      return;
    }

    setSubmitting(true);
    try {
      await projectService.submitCostAnalysis(id, tempFormData);
      await projectService.approveDocument(id, selectedTLId);
      notification.success({ message: 'Approved & Forwarded', description: 'Cost analysis submitted, project approved and successfully forwarded to the Team Lead.' });
      setIsSelectTLModalVisible(false);
      navigate('/accounts/pending');
    } catch (error) {
      console.error('Submit Cost Analysis Error:', error);
      notification.error({ message: 'Error', description: 'Failed to submit analysis.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async () => {
    if (!returnComments || returnComments.length < 20) {
      notification.error({ message: 'Validation', description: 'Please provide detailed comments (min 20 chars).' });
      return;
    }

    try {
      await projectService.returnDocument(id, returnComments);
      notification.info({ message: 'Returned', description: 'Project has been returned to Sales for revision.' });
      navigate('/accounts/pending');
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to return project.' });
    }
  };

  const handleDownload = async () => {
    if (!latestDoc) {
      notification.warning({ message: 'Not Found', description: 'No scope document found for this project.' });
      return;
    }
    try {
      await projectService.downloadDocument(id, latestDoc.documentId, latestDoc.fileName);
    } catch (error) {
      notification.error({ message: 'Download Error', description: 'Failed to download file.' });
    }
  };

  if (loading) return <Card loading />;

  if (!project) {
    return (
      <Result
        status="error"
        title="Failed to Load Project"
        subTitle="Could not load project details. The project may have been deleted or you may not have access."
        extra={<Button type="primary" onClick={() => navigate('/accounts/pending')}>Back to Pending</Button>}
      />
    );
  }


  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 80 }}>
      <PageHeader 
        title={`Cost & Timeline Analysis — ${project.name}`}
        breadcrumbs={[
          { label: 'Pending Review', path: '/accounts/pending' },
          { label: project.code }
        ]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/accounts/pending')}>
            Back
          </Button>
        }
      />

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={24} align="middle">
          <Col xs={24} sm={18}>
            <Descriptions column={2}>
              <Descriptions.Item label="Project Code"><Text code>{project.code}</Text></Descriptions.Item>
              <Descriptions.Item label="Client">{project.client}</Descriptions.Item>
              <Descriptions.Item label="Status"><StatusBadge status={project.status} /></Descriptions.Item>
              <Descriptions.Item label="Created At">{dayjs(project.createdAt).format('DD MMM YYYY')}</Descriptions.Item>
            </Descriptions>
          </Col>
          <Col xs={24} sm={6} style={{ textAlign: 'right' }}>
            <Button 
              icon={<DownloadOutlined />} 
              type="primary" 
              ghost 
              onClick={handleDownload}
              disabled={!latestDoc}
              style={{ width: '100%', maxWidth: '240px' }}
            >
              Download Scope
            </Button>
          </Col>
        </Row>
      </Card>

      <Form layout="vertical" onFinish={handleSubmit(onSubmit)}>
        <Row gutter={24}>
          <Col span={12}>
            <Card title="Section A — Budget">
              <Form.Item label="Total Budget (₹)" required validateStatus={errors.totalBudget ? 'error' : ''}>
                <Controller
                  name="totalBudget"
                  control={control}
                  rules={{ required: true, min: 1 }}
                  render={({ field }) => (
                    <InputNumber 
                      {...field} 
                      style={{ width: '100%' }} 
                      formatter={value => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value.replace(/\₹\s?|(,*)/g, '')}
                      size="large"
                    />
                  )}
                />
              </Form.Item>
              <Form.Item label="Contingency Buffer (%)">
                <Controller
                  name="contingencyBuffer"
                  control={control}
                  render={({ field }) => <InputNumber {...field} style={{ width: '100%' }} min={0} max={50} size="large" />}
                />
              </Form.Item>
            </Card>
          </Col>
          <Col span={12}>
            <Card title="Section B — Timeline">
              <Form.Item label="Total Estimated Hours" required validateStatus={errors.estimatedHours ? 'error' : ''}>
                <Controller
                  name="estimatedHours"
                  control={control}
                  rules={{ required: true, min: 1 }}
                  render={({ field }) => <InputNumber {...field} style={{ width: '100%' }} size="large" />}
                />
              </Form.Item>
              <Form.Item label="Estimated Completion Date" required validateStatus={errors.completionDate ? 'error' : ''}>
                <Controller
                  name="completionDate"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => <DatePicker {...field} style={{ width: '100%' }} size="large" />}
                />
              </Form.Item>
            </Card>
          </Col>
        </Row>

        <Card title="Section C — Phase Breakdown" style={{ marginTop: 24 }}>
          {fields.map((field, index) => (
            <Row gutter={16} key={field.id} align="bottom" style={{ marginBottom: 16 }}>
              <Col span={10}>
                <Form.Item label={index === 0 ? "Phase Name" : ""} required>
                  <Controller
                    name={`phases.${index}.name`}
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => <Input {...field} placeholder="e.g. Development" />}
                  />
                </Form.Item>
              </Col>
              <Col span={5}>
                <Form.Item label={index === 0 ? "Est. Hours" : ""} required>
                  <Controller
                    name={`phases.${index}.hours`}
                    control={control}
                    rules={{ required: true, min: 1 }}
                    render={({ field }) => <InputNumber {...field} style={{ width: '100%' }} />}
                  />
                </Form.Item>
              </Col>
              <Col span={7}>
                <Form.Item label={index === 0 ? "Est. Cost (₹)" : ""} required>
                  <Controller
                    name={`phases.${index}.cost`}
                    control={control}
                    rules={{ required: true, min: 1 }}
                    render={({ field }) => (
                      <InputNumber 
                        {...field} 
                        style={{ width: '100%' }}
                        formatter={value => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={value => value.replace(/\₹\s?|(,*)/g, '')}
                      />
                    )}
                  />
                </Form.Item>
              </Col>
              <Col span={2}>
                <Button 
                  icon={<DeleteOutlined />} 
                  danger 
                  onClick={() => remove(index)} 
                  disabled={fields.length === 1} 
                  style={{ marginBottom: index === 0 ? 0 : 0 }}
                />
              </Col>
            </Row>
          ))}
          <Button type="dashed" onClick={() => append({ name: '', hours: 0, cost: 0 })} block icon={<PlusOutlined />}>
            Add Phase
          </Button>

          <Divider />

          <Row gutter={24}>
            <Col span={12}>
              <Text strong>Total Phase Hours: </Text>
              <Text type={totalPhaseHours === Math.round(Number(watchedHours)) ? 'success' : 'danger'}>{totalPhaseHours}</Text> / {Math.round(Number(watchedHours) || 0)}
            </Col>
            <Col span={12} style={{ textAlign: 'right' }}>
              <Text strong>Total Phase Cost: </Text>
              <Text type={totalPhaseCost <= Math.round(Number(watchedBudget)) ? 'success' : 'danger'}>₹ {totalPhaseCost.toLocaleString('en-IN')}</Text> / ₹ {Math.round(Number(watchedBudget) || 0).toLocaleString('en-IN')}
            </Col>
          </Row>

          {(totalPhaseHours !== Math.round(Number(watchedHours)) || totalPhaseCost > Math.round(Number(watchedBudget))) && (
            <Alert 
              message="Total phase mismatch" 
              description="Phase totals must align with project totals before approval." 
              type="warning" 
              showIcon 
              style={{ marginTop: 16 }} 
            />
          )}
        </Card>

        {/* Action bar */}
        <div style={{ 
          marginTop: 24,
          background: token.colorBgContainer, 
          padding: '16px 24px', 
          border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'}`,
          borderRadius: 8,
          boxShadow: isDarkMode ? 'none' : '0 1px 2px rgba(0,0,0,0.03)',
          display: 'flex',
          justifyContent: 'flex-end',
          zIndex: 1000
        }}>
          <Space>
            <Button 
              size="large" 
              danger 
              icon={<RollbackOutlined />}
              onClick={() => setIsReturnModalVisible(true)}
            >
              Return to Sales
            </Button>
            <Button 
              type="primary" 
              size="large" 
              htmlType="submit" 
              icon={<CheckCircleOutlined />}
              loading={submitting}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
            >
              Approve & Forward to Team Lead
            </Button>
          </Space>
        </div>
      </Form>

      <Modal
        title="Return Document to Sales"
        open={isReturnModalVisible}
        onOk={handleReturn}
        onCancel={() => setIsReturnModalVisible(false)}
        okText="Confirm Return"
        okButtonProps={{ danger: true }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>Provide a reason for returning this document. The sales team will be notified to revise the scope.</Text>
          <TextArea 
            rows={4} 
            value={returnComments} 
            onChange={e => setReturnComments(e.target.value)}
            placeholder="Detailed reason for return (min 20 characters)..."
          />
        </Space>
      </Modal>

      <Modal
        title="Forward to Team Lead"
        open={isSelectTLModalVisible}
        onOk={handleForwardToTL}
        onCancel={() => setIsSelectTLModalVisible(false)}
        okText="Approve & Forward"
        okButtonProps={{ loading: submitting }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>Select a Team Lead to assign this project to. Once approved, the project will be forwarded to them.</Text>
          <Select
            placeholder="Select a Team Lead"
            style={{ width: '100%', marginTop: 8 }}
            onChange={value => setSelectedTLId(value)}
            value={selectedTLId}
          >
            {teamLeads.map(tl => (
              <Select.Option key={tl.id} value={tl.id}>
                {tl.name} ({tl.email})
              </Select.Option>
            ))}
          </Select>
        </Space>
      </Modal>
    </div>
  );
};

export default CostAnalysisPage;
