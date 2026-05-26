import React, { useState, useEffect } from 'react';
import { 
  Card, Form, Input, InputNumber, DatePicker, Button, Space, Table, Modal, Alert, 
  notification, Row, Col, Typography, Divider, Descriptions, Result, Select, theme, Tooltip,
  Tag, Empty, Radio
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  RollbackOutlined,
  DownloadOutlined,
  CalculatorOutlined,
  ArrowLeftOutlined,
  FileTextOutlined,
  TeamOutlined,
  DollarOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
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
  const [extracting, setExtracting] = useState(false);
  const [isReturnModalVisible, setIsReturnModalVisible] = useState(false);
  const [returnComments, setReturnComments] = useState('');
  const [latestDoc, setLatestDoc] = useState(null);

  // Users & Project Managers lists
  const [allUsers, setAllUsers] = useState([]);
  const [projectManagers, setProjectManagers] = useState([]);
  const [isSelectPMModalVisible, setIsSelectPMModalVisible] = useState(false);
  const [selectedPMId, setSelectedPMId] = useState(undefined);

  // Extraction / Cost Analysis States
  const [analysisMethod, setAnalysisMethod] = useState('extract');
  const [budgetItems, setBudgetItems] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [totalHours, setTotalHours] = useState(0);
  const [bufferHours, setBufferHours] = useState(0);
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState(null);

  // Cost by Team States
  const [showTeamCost, setShowTeamCost] = useState(false);
  const [teamLeads, setTeamLeads] = useState([]);
  const [selectedTLId, setSelectedTLId] = useState(undefined);

  useEffect(() => {
    fetchProject();
  }, [id]);

  const fetchProject = async () => {
    setLoading(true);
    try {
      // 1. Fetch Project Details
      const projRes = await projectService.getProjectById(id);
      const p = projRes.data;
      setProject(p);

      // Pre-fill values if already saved on the project
      if (p.totalHours) setTotalHours(Number(p.totalHours));
      if (p.bufferHours) setBufferHours(Number(p.bufferHours));
      if (p.budgetTable) setBudgetItems(p.budgetTable);
      if (p.milestones) {
        setMilestones(p.milestones.map(m => ({
          ...m,
          date: m.date ? dayjs(m.date) : null
        })));
      }

      // 2. Load documents
      try {
        const docsRes = await projectService.getDocuments(id);
        if (docsRes.data && docsRes.data.length > 0) {
          const budgetDoc = docsRes.data.find(d => d.documentCategory === 'budget_milestones') || docsRes.data[0];
          setLatestDoc(budgetDoc);
        }
      } catch {
        // No documents yet
      }

      // 3. Fetch Users (for Team Leads and Project Managers)
      try {
        const usersRes = await adminService.getUsers();
        if (usersRes.data) {
          setAllUsers(usersRes.data);
          
          // Filter Project Managers (include TenantAdmin who also acts as PM)
          const pms = usersRes.data.filter(u => 
            (u.role === 'ProjectManager' || u.role === 'TenantAdmin') && u.isActive !== false
          );
          setProjectManagers(pms);

          // Filter Team Leads
          const tls = usersRes.data.filter(u => u.role === 'TeamLead' && u.isActive);
          setTeamLeads(tls);
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

  // Parse and extract budget & milestones from scope document
  const handleExtractFromScope = async () => {
    if (!latestDoc) {
      notification.warning({ message: 'Warning', description: 'No scope document uploaded for this project yet.' });
      return;
    }
    setExtracting(true);
    try {
      const res = await projectService.extractScopeDetails(id, latestDoc.documentId);
      const { budgetTable, milestones: extMilestones, totalHours: extHours, bufferHours: extBuffer, estimatedCompletionDate: extDate } = res.data;

      setBudgetItems(budgetTable || []);
      setMilestones((extMilestones || []).map((m, idx) => ({
        ...m,
        key: m.key || idx + 1,
        date: m.date ? dayjs(m.date) : null
      })));
      
      if (extHours) setTotalHours(Number(extHours));
      if (extBuffer) setBufferHours(Number(extBuffer));
      if (extDate) setEstimatedCompletionDate(dayjs(extDate));

      notification.success({
        message: 'Extraction Complete',
        description: `Successfully extracted ${budgetTable?.length || 0} budget items and ${extMilestones?.length || 0} milestones from the uploaded scope document.`
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

  // Budget Table modification helpers
  const handleAddBudgetItem = () => {
    const newKey = budgetItems.length > 0 ? Math.max(...budgetItems.map(item => item.key || 0)) + 1 : 1;
    setBudgetItems([...budgetItems, { key: newKey, item: '', cost: 0, hours: 0 }]);
  };

  const handleUpdateBudgetItem = (key, field, value) => {
    const updated = budgetItems.map(item => {
      if (item.key === key) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setBudgetItems(updated);
  };

  const handleRemoveBudgetItem = (key) => {
    setBudgetItems(budgetItems.filter(item => item.key !== key));
  };

  // Milestones Table modification helpers
  const handleAddMilestone = () => {
    const newKey = milestones.length > 0 ? Math.max(...milestones.map(m => m.key || 0)) + 1 : 1;
    setMilestones([...milestones, { key: newKey, title: '', date: null, amount: 0, description: '' }]);
  };

  const handleUpdateMilestone = (key, field, value) => {
    const updated = milestones.map(m => {
      if (m.key === key) {
        return { ...m, [field]: value };
      }
      return m;
    });
    setMilestones(updated);
  };

  const handleRemoveMilestone = (key) => {
    setMilestones(milestones.filter(m => m.key !== key));
  };

  // Calculations
  const calculatedTotalBudget = budgetItems.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
  const calculatedTotalHours = budgetItems.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0);

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
        budgetTable: budgetItems,
        milestones: milestones.map(m => ({
          title: m.title,
          date: m.date ? m.date.toISOString() : null,
          amount: m.amount,
          description: m.description
        }))
      };

      // Call API
      await projectService.approveDocument(id, payload);

      notification.success({
        message: 'Project Cost Submitted to PM',
        description: 'Successfully submitted the finalized cost, budget table, and milestones to the Project Manager for final approval.'
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
      notification.error({ message: 'Validation', description: 'Please provide a detailed comment (min 20 characters) for the return reason.' });
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

  // Get employees mapped to a specific Team Lead for cost breakdown
  const getEmployeesForTL = (tlId) => {
    if (!tlId || !teamLeads || teamLeads.length === 0) return [];
    const emps = allUsers.filter(u => u.role === 'Employee' && u.isActive);
    const tlIndex = teamLeads.findIndex(t => String(t.id) === String(tlId));
    if (tlIndex === -1) return [];
    // Deterministic distribution of employees under TLs for a realistic layout
    return emps.filter((emp, idx) => (idx % teamLeads.length) === tlIndex);
  };

  // Deterministic rates per user
  const getUserRate = (user) => {
    if (!user) return 0;
    const userId = Number(user.id || user.userId || 0);
    if (user.role === 'TeamLead') {
      return 1200 + (userId * 100) % 500;
    }
    return 600 + (userId * 50) % 300;
  };

  const selectedTL = teamLeads.find(tl => String(tl.id) === String(selectedTLId));
  const selectedTLTeam = selectedTLId ? getEmployeesForTL(selectedTLId) : [];

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

  return (
    <div style={{ maxWidth: 1050, margin: '0 auto', paddingBottom: 80 }}>
      <PageHeader
        title={`Cost & Timeline Analysis — ${project.name}`}
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

      <Card style={{ marginBottom: 24, borderRadius: 12 }}>
        <Row gutter={24}>
          <Col xs={24} md={18}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="Project Name"><Text strong>{project.name}</Text></Descriptions.Item>
              <Descriptions.Item label="Client">{project.client}</Descriptions.Item>
              <Descriptions.Item label="Project Category">{project.projectCategory || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Status"><StatusBadge status={project.status} /></Descriptions.Item>
              <Descriptions.Item label="Expected Start">{project.startDate ? dayjs(project.startDate).format('DD MMM YYYY') : '-'}</Descriptions.Item>
              <Descriptions.Item label="Budget Doc" span={2}>
                {latestDoc ? (
                  <Space>
                    <FileTextOutlined style={{ color: '#1890ff' }} />
                    <Text code>{latestDoc.fileName}</Text>
                    <Text type="secondary">({(latestDoc.fileSize / 1024).toFixed(1)} KB)</Text>
                  </Space>
                ) : (
                  <Text type="warning">No budget & milestones document uploaded</Text>
                )}
              </Descriptions.Item>
            </Descriptions>
            <Divider style={{ margin: '16px 0' }} />
            <div>
              <Text strong style={{ marginRight: 16 }}>Cost Analysis Mode: </Text>
              <Radio.Group 
                value={analysisMethod} 
                onChange={e => setAnalysisMethod(e.target.value)}
                buttonStyle="solid"
                size="middle"
              >
                <Radio.Button value="extract">Option 1: Extract from Budget Document</Radio.Button>
                <Radio.Button value="manual">Option 2: Manually Define Budget & Milestones</Radio.Button>
              </Radio.Group>
            </div>
          </Col>
          <Col xs={24} md={6} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', paddingTop: 16 }}>
            {analysisMethod === 'extract' && (
              <Button
                icon={<CalculatorOutlined />}
                type="primary"
                onClick={handleExtractFromScope}
                loading={extracting}
                disabled={!latestDoc}
                block
              >
                Extract Budget & Milestones
              </Button>
            )}
          </Col>
        </Row>
      </Card>

      {/* SECTION C — Budget Table (Editable) */}
      <Card 
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Section C — Project Budget Allocation (Section Wise)</span>
            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={handleAddBudgetItem}>
              Add Item
            </Button>
          </div>
        }
        style={{ marginBottom: 24, borderRadius: 12 }}
      >
        <Table
          dataSource={budgetItems}
          rowKey="key"
          pagination={false}
          locale={{ emptyText: analysisMethod === 'extract' ? 'No budget items extracted. Click "Extract Budget & Milestones" above to parse the scope document.' : 'No budget items defined. Click "Add Item" to add manually (Optional).' }}
          columns={[
            {
              title: 'Budget Section / Item Description',
              dataIndex: 'item',
              key: 'item',
              width: '50%',
              render: (text, record) => (
                <Input 
                  value={text} 
                  onChange={e => handleUpdateBudgetItem(record.key, 'item', e.target.value)} 
                  placeholder="Enter budget phase or deliverable description"
                />
              )
            },
            {
              title: 'Hours (h)',
              dataIndex: 'hours',
              key: 'hours',
              width: '20%',
              render: (val, record) => (
                <InputNumber 
                  value={val} 
                  min={0}
                  style={{ width: '100%' }}
                  onChange={v => handleUpdateBudgetItem(record.key, 'hours', v || 0)} 
                />
              )
            },
            {
              title: 'Cost (₹)',
              dataIndex: 'cost',
              key: 'cost',
              width: '20%',
              render: (val, record) => (
                <InputNumber 
                  value={val} 
                  min={0}
                  style={{ width: '100%' }}
                  formatter={value => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/\₹\s?|(,*)/g, '')}
                  onChange={v => handleUpdateBudgetItem(record.key, 'cost', v || 0)} 
                />
              )
            },
            {
              title: 'Action',
              key: 'action',
              width: '10%',
              align: 'center',
              render: (_, record) => (
                <Button 
                  icon={<DeleteOutlined />} 
                  danger 
                  onClick={() => handleRemoveBudgetItem(record.key)} 
                />
              )
            }
          ]}
        />
        {budgetItems.length > 0 && (
          <Row gutter={24} style={{ marginTop: 16, background: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f9fafb', padding: '12px 16px', borderRadius: 8 }}>
            <Col span={12}>
              <Text strong>Total Calculated Hours: </Text>
              <Text type="success" style={{ fontSize: 16 }}>{calculatedTotalHours} hrs</Text>
            </Col>
            <Col span={12} style={{ textAlign: 'right' }}>
              <Text strong>Total Calculated Budget: </Text>
              <Text type="success" style={{ fontSize: 16 }}>₹ {calculatedTotalBudget.toLocaleString('en-IN')}</Text>
            </Col>
          </Row>
        )}
      </Card>

      {/* SECTION D — Milestones Table (Editable) */}
      <Card 
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Section D — Project Milestones & Release Schedule</span>
            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={handleAddMilestone}>
              Add Milestone
            </Button>
          </div>
        }
        style={{ marginBottom: 24, borderRadius: 12 }}
      >
        <Table
          dataSource={milestones}
          rowKey="key"
          pagination={false}
          locale={{ emptyText: analysisMethod === 'extract' ? 'No milestones extracted. Click "Extract Budget & Milestones" above to populate.' : 'No milestones defined. Click "Add Milestone" to add manually (Optional).' }}
          columns={[
            {
              title: 'Milestone Title',
              dataIndex: 'title',
              key: 'title',
              width: '30%',
              render: (text, record) => (
                <Input 
                  value={text} 
                  onChange={e => handleUpdateMilestone(record.key, 'title', e.target.value)} 
                  placeholder="e.g. Prototype Complete"
                />
              )
            },
            {
              title: 'Target Date',
              dataIndex: 'date',
              key: 'date',
              width: '20%',
              render: (val, record) => (
                <DatePicker 
                  value={val}
                  style={{ width: '100%' }}
                  onChange={date => handleUpdateMilestone(record.key, 'date', date)} 
                />
              )
            },
            {
              title: 'Release Amount (₹)',
              dataIndex: 'amount',
              key: 'amount',
              width: '20%',
              render: (val, record) => (
                <InputNumber 
                  value={val} 
                  min={0}
                  style={{ width: '100%' }}
                  formatter={value => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/\₹\s?|(,*)/g, '')}
                  onChange={v => handleUpdateMilestone(record.key, 'amount', v || 0)} 
                />
              )
            },
            {
              title: 'Deliverable Description',
              dataIndex: 'description',
              key: 'description',
              width: '22%',
              render: (text, record) => (
                <Input 
                  value={text} 
                  onChange={e => handleUpdateMilestone(record.key, 'description', e.target.value)} 
                  placeholder="Brief deliverables..."
                />
              )
            },
            {
              title: 'Action',
              key: 'action',
              width: '8%',
              align: 'center',
              render: (_, record) => (
                <Button 
                  icon={<DeleteOutlined />} 
                  danger 
                  onClick={() => handleRemoveMilestone(record.key)} 
                />
              )
            }
          ]}
        />
      </Card>

      {/* SECTION E — Define Hours & Buffer */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="Section E — final Total Hours" style={{ height: '100%', borderRadius: 12 }}>
            <Form.Item label="Final Total Allocated Hours" required tooltip="Input final hours assigned for this project.">
              <InputNumber 
                value={totalHours} 
                min={0} 
                style={{ width: '100%' }} 
                size="large"
                onChange={val => setTotalHours(val || 0)}
              />
            </Form.Item>
            {calculatedTotalHours > 0 && (
              <Alert 
                type={totalHours === calculatedTotalHours ? 'success' : 'warning'}
                message={`Itemized budget total hours: ${calculatedTotalHours} hrs`} 
                style={{ marginTop: 8 }}
              />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Section F — Project Contingency Buffer" style={{ height: '100%', borderRadius: 12 }}>
            <Form.Item label="Project Buffer (Hours)" required tooltip="Allocate buffer hours to handle risks and project delays.">
              <InputNumber 
                value={bufferHours} 
                min={0} 
                style={{ width: '100%' }} 
                size="large"
                onChange={val => setBufferHours(val || 0)}
              />
            </Form.Item>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Buffer ratio: {totalHours > 0 ? ((bufferHours / totalHours) * 100).toFixed(1) : 0}% of total hours
            </Text>
          </Card>
        </Col>
      </Row>



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
          <Text>Explain what changes are required in the scope document, budget, or milestones. The Sales team will see this comment.</Text>
          <TextArea
            rows={4}
            value={returnComments}
            onChange={e => setReturnComments(e.target.value)}
            placeholder="Detailed reason for revision (min 20 characters)..."
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
        </Space>
      </Modal>
    </div>
  );
};

export default CostAnalysisPage;
