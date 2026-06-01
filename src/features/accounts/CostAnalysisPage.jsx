import React, { useState, useEffect } from 'react';
import {
  Card, Form, InputNumber, Button, Space, Modal, Alert,
  notification, Row, Col, Typography, Divider, Descriptions, Result, Select, theme, Radio, Tag, Spin
} from 'antd';
import {
  CheckCircleOutlined,
  RollbackOutlined,
  CalculatorOutlined,
  ArrowLeftOutlined,
  FileTextOutlined,
  DownloadOutlined,
  ClockCircleOutlined,
  DollarOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { projectService } from '../../services/projectService';
import { adminService } from '../../services/adminService';
import { useThemeStore } from '../../store/themeStore';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';

const { Title, Text } = Typography;

const CostAnalysisPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const { isDarkMode } = useThemeStore();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [isReturnModalVisible, setIsReturnModalVisible] = useState(false);
  const [returnComments, setReturnComments] = useState('');
  const [latestDoc, setLatestDoc] = useState(null);

  // Users & Project Managers lists
  const [allUsers, setAllUsers] = useState([]);
  const [projectManagers, setProjectManagers] = useState([]);
  const [isSelectPMModalVisible, setIsSelectPMModalVisible] = useState(false);
  const [selectedPMId, setSelectedPMId] = useState(undefined);

  // Core cost states
  const [totalHours, setTotalHours] = useState(0);
  const [totalBudget, setTotalBudget] = useState(0);
  const [bufferHours, setBufferHours] = useState(0);
  const [billingType, setBillingType] = useState('fixed');
  const [costCalculationType, setCostCalculationType] = useState('custom');
  const [standardCost, setStandardCost] = useState(500);

  // Extraction state
  const [extractedOnce, setExtractedOnce] = useState(false);

  useEffect(() => {
    fetchProject();
  }, [id]);

  const fetchProject = async () => {
    setLoading(true);
    try {
      // Load standard cost
      try {
        const costRes = await adminService.getStandardCost();
        setStandardCost(Number(costRes.data?.standardCost) || 500);
      } catch (err) {
        console.error('Failed to load standard cost', err);
      }

      // Fetch project
      const projRes = await projectService.getProjectById(id);
      const p = projRes.data;
      setProject(p);

      // Pre-fill saved values
      if (p.totalHours) setTotalHours(Number(p.totalHours));
      if (p.bufferHours) setBufferHours(Number(p.bufferHours));
      if (p.costCalculationType) setCostCalculationType(p.costCalculationType);
      if (p.billingType) setBillingType(p.billingType);

      // Compute total budget from budget table if available
      if (p.budgetTable && Array.isArray(p.budgetTable) && p.budgetTable.length > 0) {
        const sumBudget = p.budgetTable.reduce((sum, item) => sum + Number(item.cost || 0), 0);
        setTotalBudget(sumBudget);
        setExtractedOnce(true);
      }

      // Load documents
      let docForExtraction = null;
      try {
        const docsRes = await projectService.getDocuments(id);
        if (docsRes.data && docsRes.data.length > 0) {
          const sortedDocs = [...docsRes.data].sort((a, b) => (b.documentId || b.id) - (a.documentId || a.id));
          const budgetDoc =
            sortedDocs.find(d => d.documentCategory === 'budget_milestones' || d.documentCategory === 'budget') ||
            sortedDocs[0];
          setLatestDoc(budgetDoc);
          docForExtraction = budgetDoc;

          // Auto-extract if only one document and not already extracted
          if (!p.budgetTable || !p.budgetTable.length) {
            await autoExtract(id, budgetDoc, Number(p.totalHours) || 0);
          }
        }
      } catch {
        // No documents yet
      }

      // Fetch users for PM selection
      try {
        const usersRes = await adminService.getUsers();
        if (usersRes.data) {
          setAllUsers(usersRes.data);
          const pms = usersRes.data.filter(
            u => (u.role === 'ProjectManager' || u.role === 'TenantAdmin') && u.isActive !== false
          );
          setProjectManagers(pms);
        }
      } catch (err) {
        console.error('Failed to load users list:', err);
      }
    } catch (error) {
      console.error('Fetch Details Error:', error);
      notification.error({ message: 'Error', description: 'Failed to load project details.' });
    } finally {
      setLoading(false);
    }
  };

  const autoExtract = async (projectId, doc, existingHours) => {
    if (!doc) return;
    try {
      setExtracting(true);
      const res = await projectService.extractScopeDetails(projectId, doc.documentId);
      const { budgetTable, totalHours: extHours } = res.data;

      const sumBudget = (budgetTable || []).reduce((sum, item) => sum + Number(item.cost || 0), 0);
      let calcHours = Number(extHours || 0);
      if (!calcHours && sumBudget > 0) {
        calcHours = Math.round(sumBudget / standardCost);
      }

      if (sumBudget > 0) setTotalBudget(sumBudget);
      if (calcHours > 0) {
        setTotalHours(calcHours);
        setBufferHours(Math.round(calcHours * 0.10));
      }
      setExtractedOnce(true);
    } catch (err) {
      console.error('Auto-extraction failed:', err);
    } finally {
      setExtracting(false);
    }
  };

  const handleManualExtract = async () => {
    if (!latestDoc) {
      notification.warning({ message: 'Warning', description: 'No scope document uploaded for this project yet.' });
      return;
    }
    setExtracting(true);
    try {
      const res = await projectService.extractScopeDetails(id, latestDoc.documentId);
      const { budgetTable, totalHours: extHours } = res.data;

      const sumBudget = (budgetTable || []).reduce((sum, item) => sum + Number(item.cost || 0), 0);
      let calcHours = Number(extHours || 0);
      if (!calcHours && sumBudget > 0) {
        calcHours = Math.round(sumBudget / standardCost);
      }

      if (sumBudget > 0) setTotalBudget(sumBudget);
      if (calcHours > 0) {
        setTotalHours(calcHours);
        setBufferHours(Math.round(calcHours * 0.10));
      }
      setExtractedOnce(true);

      notification.success({
        message: 'Extraction Complete',
        description: `Extracted Total Budget: ₹${sumBudget.toLocaleString('en-IN')} | Total Hours: ${calcHours} hrs`
      });
    } catch (error) {
      console.error('Extraction error:', error);
      notification.error({
        message: 'Extraction Failed',
        description: error.response?.data?.message || error.message || 'Failed to extract scope document details.'
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleTotalHoursChange = (val) => {
    const hrs = val || 0;
    setTotalHours(hrs);
    setBufferHours(Math.round(hrs * 0.10));
  };

  const handleOpenPMModal = () => {
    if (!totalHours || totalHours <= 0) {
      notification.warning({ message: 'Validation', description: 'Please enter a valid amount of total hours.' });
      return;
    }
    setIsSelectPMModalVisible(true);
  };

  const handleApproveAndSubmitToPM = async () => {
    if (!selectedPMId) {
      notification.error({ message: 'Validation', description: 'Please select a Project Manager to assign.' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        status: 'PendingPMApproval',
        assignedProjectManagerId: Number(selectedPMId),
        totalHours: totalHours,
        bufferHours: bufferHours,
        costCalculationType: costCalculationType,
        billingType: billingType,
        budgetTable: totalBudget > 0 ? [{ key: 1, item: 'Total Project Budget', cost: totalBudget, hours: totalHours }] : [],
        milestones: []
      };

      await projectService.approveDocument(id, payload);

      notification.success({
        message: 'Project Cost Submitted to PM',
        description: 'Successfully submitted the finalized cost and hours to the Project Manager.'
      });
      setIsSelectPMModalVisible(false);
      navigate('/accounts/pending');
    } catch (error) {
      console.error(error);
      notification.error({
        message: 'Submission Failed',
        description: error.response?.data?.message || 'Failed to submit analysis.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async () => {
    if (!returnComments || returnComments.length < 20) {
      notification.error({
        message: 'Validation',
        description: 'Please provide a detailed comment (min 20 characters) for the return reason.'
      });
      return;
    }
    try {
      await projectService.returnDocument(id, returnComments);
      notification.info({ message: 'Returned to Sales', description: 'Project was successfully returned for revision.' });
      navigate('/accounts/pending');
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to return project.' });
    }
  };

  const handleDownload = async () => {
    if (!latestDoc) {
      notification.warning({ message: 'Not Found', description: 'No scope document found.' });
      return;
    }
    try {
      await projectService.downloadDocument(id, latestDoc.documentId, latestDoc.fileName);
    } catch (error) {
      notification.error({ message: 'Download Error', description: 'Failed to download scope document.' });
    }
  };

  if (loading) return <Card loading />;

  if (!project) {
    return (
      <Result
        status="error"
        title="Failed to Load Project"
        subTitle="Could not load project details."
        extra={<Button type="primary" onClick={() => navigate('/accounts/pending')}>Back</Button>}
      />
    );
  }

  const cardStyle = {
    borderRadius: 12,
    marginBottom: 24,
    boxShadow: isDarkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)'
  };

  const metricCardStyle = {
    borderRadius: 12,
    height: '100%',
    boxShadow: isDarkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)'
  };

  return (
    <div style={{ maxWidth: 1050, margin: '0 auto', paddingBottom: 80 }}>
      <PageHeader
        title={`Cost & Timeline Analysis — ${project.name || project.projectName}`}
        breadcrumbs={[
          { label: 'Pending Review', path: '/accounts/pending' },
          { label: project.projectName }
        ]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/accounts/pending')}>
            Back
          </Button>
        }
      />

      {project.status === 'ReturnedToAccounts' && (
        <Alert
          message="Returned by Project Manager"
          description={
            <div>
              <p>The Project Manager has returned this project for revisions. <strong>Comments from PM:</strong></p>
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
            </div>
          }
          type="error"
          showIcon
          style={{ marginBottom: 24, borderRadius: 8 }}
        />
      )}

      {/* PROJECT INFO CARD */}
      <Card style={cardStyle}>
        <Row gutter={24} align="middle">
          <Col xs={24} md={18}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="Project Name"><Text strong>{project.name || project.projectName}</Text></Descriptions.Item>
              <Descriptions.Item label="Client">{project.client}</Descriptions.Item>
              <Descriptions.Item label="Project Category">{project.projectCategory || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Status"><StatusBadge status={project.status} /></Descriptions.Item>
              <Descriptions.Item label="Expected Start">
                {project.startDate ? dayjs(project.startDate).format('DD MMM YYYY') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Scope Document" span={1}>
                {latestDoc ? (
                  <Space>
                    <FileTextOutlined style={{ color: '#1890ff' }} />
                    <Text code>{latestDoc.fileName}</Text>
                    <Text type="secondary">({(latestDoc.fileSize / 1024).toFixed(1)} KB)</Text>
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      type="link"
                      onClick={handleDownload}
                    >
                      Download
                    </Button>
                  </Space>
                ) : (
                  <Text type="warning">No scope document uploaded yet</Text>
                )}
              </Descriptions.Item>
            </Descriptions>
          </Col>
          <Col xs={24} md={6} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <Button
              icon={<CalculatorOutlined />}
              type="primary"
              onClick={handleManualExtract}
              loading={extracting}
              disabled={!latestDoc}
              size="middle"
            >
              {extractedOnce ? 'Re-Extract from Document' : 'Extract from Document'}
            </Button>
          </Col>
        </Row>
      </Card>

      {/* EXTRACTION LOADING */}
      {extracting && (
        <Card style={{ ...cardStyle, textAlign: 'center', padding: '32px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">Extracting budget and hours from uploaded document…</Text>
          </div>
        </Card>
      )}

      {/* BUDGET & HOURS METRICS */}
      {!extracting && (
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col xs={24} md={12}>
            <Card style={metricCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <DollarOutlined style={{ color: '#fff', fontSize: 20 }} />
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Total Project Budget</Text>
                  <div>
                    <Text strong style={{ fontSize: 22 }}>
                      ₹ {totalBudget > 0 ? totalBudget.toLocaleString('en-IN') : '—'}
                    </Text>
                  </div>
                </div>
              </div>
              <Divider style={{ margin: '12px 0' }} />
              <Form.Item label="Edit Total Budget (₹)" style={{ marginBottom: 0 }}>
                <InputNumber
                  value={totalBudget || undefined}
                  min={0}
                  style={{ width: '100%' }}
                  size="large"
                  formatter={value => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/₹\s?|(,*)/g, '')}
                  placeholder="Enter total project budget"
                  onChange={val => setTotalBudget(val || 0)}
                />
              </Form.Item>
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card style={metricCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: 'linear-gradient(135deg, #10b981, #34d399)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <ClockCircleOutlined style={{ color: '#fff', fontSize: 20 }} />
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Total Allocated Hours</Text>
                  <div>
                    <Text strong style={{ fontSize: 22 }}>
                      {totalHours > 0 ? `${totalHours} hrs` : '—'}
                    </Text>
                  </div>
                </div>
              </div>
              <Divider style={{ margin: '12px 0' }} />

              {/* Billing Type */}
              <Form.Item label="Billing Type" style={{ marginBottom: 12 }}>
                <Radio.Group
                  value={billingType}
                  onChange={e => setBillingType(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                  size="middle"
                >
                  <Radio.Button value="fixed">Fixed</Radio.Button>
                  <Radio.Button value="monthly">Monthly</Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                label={
                  <span>
                    Total Hours
                    {billingType === 'monthly' && (
                      <Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>Monthly</Tag>
                    )}
                    {billingType === 'fixed' && (
                      <Tag color="green" style={{ marginLeft: 8, fontSize: 11 }}>Fixed</Tag>
                    )}
                  </span>
                }
                style={{ marginBottom: 0 }}
              >
                <InputNumber
                  value={totalHours || undefined}
                  min={0}
                  style={{ width: '100%' }}
                  size="large"
                  placeholder={billingType === 'monthly' ? 'Hours per month' : 'Total fixed hours'}
                  onChange={handleTotalHoursChange}
                />
              </Form.Item>
            </Card>
          </Col>
        </Row>
      )}

      {/* BUFFER & COST CALCULATION */}
      {!extracting && (
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col xs={24} md={12}>
            <Card
              title="Project Contingency Buffer (10%)"
              style={metricCardStyle}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                background: isDarkMode ? 'rgba(255,255,255,0.04)' : '#f0f9ff',
                borderRadius: 10,
                border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : '#bae6fd'}`
              }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Auto-calculated Buffer (10% of total hours)</Text>
                  <div>
                    <Text strong style={{ fontSize: 28, color: '#0ea5e9' }}>{bufferHours} hrs</Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {totalHours > 0 ? `${((bufferHours / totalHours) * 100).toFixed(1)}% of ${totalHours} hrs` : 'Set total hours first'}
                  </Text>
                </div>
                <ClockCircleOutlined style={{ fontSize: 40, color: '#0ea5e9', opacity: 0.4 }} />
              </div>
              <div style={{ marginTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Override buffer manually if required:
                </Text>
                <InputNumber
                  value={bufferHours}
                  min={0}
                  style={{ width: '100%', marginTop: 8 }}
                  onChange={val => setBufferHours(val || 0)}
                  placeholder="Buffer hours"
                />
              </div>
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card
              title="Cost Calculation Mode"
              style={metricCardStyle}
            >
              <Form.Item label="Mode" tooltip="Choose whether this project uses standard cost logic or custom employee rates.">
                <Radio.Group
                  value={costCalculationType}
                  onChange={e => setCostCalculationType(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Radio.Button value="custom" style={{ width: '50%', textAlign: 'center' }}>Custom Cost</Radio.Button>
                  <Radio.Button value="standard" style={{ width: '50%', textAlign: 'center' }}>Standard Cost</Radio.Button>
                </Radio.Group>
              </Form.Item>

              {costCalculationType === 'standard' && (
                <Alert
                  type="info"
                  message={`Standard Cost Rate: ₹${standardCost.toLocaleString('en-IN')}/hr`}
                  description={`Estimated project cost at standard rate: ₹${(totalHours * standardCost).toLocaleString('en-IN')}`}
                  style={{ borderRadius: 8 }}
                />
              )}

              {/* Summary */}
              {totalHours > 0 && totalBudget > 0 && (
                <div style={{
                  marginTop: 12,
                  padding: '12px 16px',
                  background: isDarkMode ? 'rgba(255,255,255,0.04)' : '#f6ffed',
                  borderRadius: 8,
                  border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : '#b7eb8f'}`
                }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Effective Rate</Text>
                  <div>
                    <Text strong style={{ color: '#52c41a', fontSize: 16 }}>
                      ₹{(totalBudget / totalHours).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}/hr
                    </Text>
                  </div>
                </div>
              )}
            </Card>
          </Col>
        </Row>
      )}

      {/* ACTION BAR */}
      <Card style={{ borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
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
            icon={<CheckCircleOutlined />}
            loading={submitting}
            onClick={handleOpenPMModal}
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
          >
            Approve & Submit to Project Manager
          </Button>
        </div>
      </Card>

      {/* RETURN TO SALES MODAL */}
      <Modal
        title="Return Project for Revision"
        open={isReturnModalVisible}
        onOk={handleReturn}
        onCancel={() => setIsReturnModalVisible(false)}
        okText="Confirm Return to Sales"
        okButtonProps={{ danger: true }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>Explain what changes are required in the scope document or budget. The Sales team will see this comment.</Text>
          <textarea
            rows={4}
            value={returnComments}
            onChange={e => setReturnComments(e.target.value)}
            placeholder="Detailed reason for revision (min 20 characters)..."
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.2)' : '#d9d9d9'}`,
              background: isDarkMode ? 'rgba(255,255,255,0.04)' : '#fff',
              color: isDarkMode ? '#fff' : '#000',
              resize: 'vertical',
              fontFamily: 'inherit',
              fontSize: 14
            }}
          />
        </Space>
      </Modal>

      {/* SELECT PROJECT MANAGER MODAL */}
      <Modal
        title="Submit to Project Manager"
        open={isSelectPMModalVisible}
        onOk={handleApproveAndSubmitToPM}
        onCancel={() => setIsSelectPMModalVisible(false)}
        okText="Final Approve & Submit"
        confirmLoading={submitting}
      >
        <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
          <Text>Select a Project Manager to assign this project to for resource scheduling and timeline kickoff.</Text>
          <Select
            placeholder="Select a Project Manager"
            style={{ width: '100%', marginTop: 8 }}
            onChange={value => setSelectedPMId(value)}
            value={selectedPMId}
          >
            {projectManagers.map(pm => {
              const pmId = pm.id || pm.userId;
              const pmName = pm.name || pm.fullName || pm.email;
              return (
                <Select.Option key={pmId} value={pmId}>
                  {pmName} ({pm.email})
                </Select.Option>
              );
            })}
          </Select>

          <Divider style={{ margin: '12px 0' }} />

          {/* Summary before submit */}
          <div style={{
            background: isDarkMode ? 'rgba(255,255,255,0.04)' : '#fafafa',
            borderRadius: 8,
            padding: '12px 16px'
          }}>
            <Text strong>Submission Summary</Text>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Total Budget:</Text>
                <Text strong>₹ {totalBudget.toLocaleString('en-IN')}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Total Hours:</Text>
                <Text strong>{totalHours} hrs <Tag color={billingType === 'fixed' ? 'green' : 'blue'} style={{ fontSize: 10 }}>{billingType}</Tag></Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Buffer Hours (10%):</Text>
                <Text strong>{bufferHours} hrs</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Cost Mode:</Text>
                <Text strong style={{ textTransform: 'capitalize' }}>{costCalculationType}</Text>
              </div>
            </div>
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default CostAnalysisPage;
