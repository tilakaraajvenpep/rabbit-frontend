import React, { useState, useEffect } from 'react';
import { 
  Row, Col, Card, Statistic, Timeline, Table, Tag, 
  Button, Form, Input, Select, notification, Space, 
  Typography, Skeleton, Divider, Avatar, Tooltip 
} from 'antd';
import { 
  DollarOutlined, 
  FieldTimeOutlined, 
  TeamOutlined, 
  CalendarOutlined,
  CheckCircleOutlined,
  HistoryOutlined,
  ArrowLeftOutlined,
  DashboardOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { projectService } from '../../services/projectService';
import { ticketService } from '../../services/ticketService';
import { adminService } from '../../services/adminService';
import { useAuthStore } from '../../store/authStore';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import HoursProgress from '../../components/common/HoursProgress';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const ProjectOverviewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuthStore();
  const [project, setProject] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [assignedEmployees, setAssignedEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [consumedHours, setConsumedHours] = useState(0);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projRes, auditRes, docsRes, ticketsRes, usersRes] = await Promise.all([
        projectService.getProjectOverview(id),
        projectService.getAuditLog(id),
        projectService.getDocuments(id),
        ticketService.getTickets(),
        adminService.getUsers()
      ]);
      setProject(projRes.data);
      setAuditLog(auditRes.data);
      setDocuments(docsRes.data || []);

      const allTickets = ticketsRes.data || [];
      const allUsers = usersRes.data || [];

      // Filter tickets for this project and collect unique assigned user IDs
      const projectTickets = allTickets.filter(t => String(t.projectId) === String(id));
      const calculatedHours = projectTickets.reduce((sum, t) => sum + (Number(t.consumedHours) || 0), 0);
      setConsumedHours(calculatedHours || Number(projRes.data.consumedHours) || 0);

      const assignedUserIds = [...new Set(projectTickets.map(t => t.assignedToUserId).filter(Boolean))];

      // Match against users where role is Employee
      const employees = allUsers.filter(u => 
        assignedUserIds.includes(u.id || u.userId) && u.role === 'Employee'
      );
      setAssignedEmployees(employees);

      form.setFieldsValue({
        status: projRes.data.status,
        note: projRes.data.latestStatusNote
      });
    } catch (error) {
      console.error(error);
      notification.error({ message: 'Error', description: 'Failed to load project overview.' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (values) => {
    setUpdating(true);
    try {
      await projectService.updateProjectStatus(id, values);
      notification.success({ message: 'Success', description: 'Project status updated successfully.' });
      fetchData();
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to update status.' });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <Skeleton active paragraph={{ rows: 15 }} />;
  if (!project) return <div>Project not found</div>;

  const canUpdateStatus = ['TeamLead', 'ProjectManager'].includes(role);
  const remainingDays = project.endDate ? dayjs(project.endDate).diff(dayjs(), 'day') : 0;

  return (
    <div>
      <PageHeader 
        title={`${project.code} — ${project.name}`}
        extra={
          <Space>

            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Back</Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]}>
        {/* Section 1: Key Metrics */}
        <Col span={24}>
          <Row gutter={16}>
            {!['TeamLead', 'ProjectManager'].includes(role) && (
              <Col xs={24} sm={12} lg={6}>
                <Card size="small">
                  <Statistic 
                    title="Approved Budget" 
                    value={project.approvedBudget} 
                    prefix={<DollarOutlined />} 
                    formatter={(v) => `₹ ${v.toLocaleString('en-IN')}`}
                  />
                </Card>
              </Col>
            )}
            <Col xs={24} sm={12} lg={['TeamLead', 'ProjectManager'].includes(role) ? 8 : 6}>
              <Card size="small">
                <Statistic title="Approved Hours" value={project.approvedHours} prefix={<FieldTimeOutlined />} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={['TeamLead', 'ProjectManager'].includes(role) ? 8 : 6}>
              <Card size="small">
                <Statistic title="Consumed Hours" value={consumedHours.toFixed(2)} prefix={<FieldTimeOutlined />} valueStyle={{ color: '#cf1322' }} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={['TeamLead', 'ProjectManager'].includes(role) ? 8 : 6}>
              <Card size="small">
                <Statistic title="Days Remaining" value={remainingDays} prefix={<CalendarOutlined />} valueStyle={{ color: remainingDays < 7 ? '#cf1322' : '#3f9142' }} />
              </Card>
            </Col>
          </Row>
        </Col>

        {/* Section 2: Progress Bars */}
        <Col xs={24} lg={role === 'ProjectManager' ? 24 : 16}>
          <Card title="Project Progress" style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: ['TeamLead', 'ProjectManager'].includes(role) ? 0 : 24 }}>
              <Text strong>Hours Consumption</Text>
              <HoursProgress consumed={consumedHours} total={project.approvedHours} />
            </div>
            {!['TeamLead', 'ProjectManager'].includes(role) && (
              <div>
                <Text strong>Budget Utilization</Text>
                <HoursProgress consumed={400000} total={project.approvedBudget} unit="₹" />
              </div>
            )}
          </Card>

          <Card title="Project Information" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Text type="secondary">Client:</Text> <Text strong>{project.client}</Text>
              </Col>
              <Col span={12}>
                <Text type="secondary">Status:</Text> <StatusBadge status={project.status} />
              </Col>
              <Col span={12}>
                <Text type="secondary">Start Date:</Text> <Text strong>{dayjs(project.createdAt).format('DD MMM YYYY')}</Text>
              </Col>
              <Col span={12}>
                <Text type="secondary">Est. End Date:</Text> <Text strong>{project.endDate ? dayjs(project.endDate).format('DD MMM YYYY') : 'Not Set'}</Text>
              </Col>
              <Col span={24}>
                <Divider style={{ margin: '12px 0' }} />
                <Text type="secondary">Team Members:</Text>
                {role === 'TeamLead' ? (
                  assignedEmployees.length > 0 ? (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 8 }}>
                      {assignedEmployees.map(emp => (
                        <Tag 
                          key={emp.id || emp.userId} 
                          color="blue" 
                          style={{ padding: '4px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}
                        >
                          <Avatar size="small" src={emp.avatar} icon={<UserOutlined />} />
                          {emp.name || emp.fullName}
                        </Tag>
                      ))}
                    </div>
                  ) : (
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary" italic>no team members still assigned</Text>
                    </div>
                  )
                ) : (
                  <div style={{ marginTop: 8 }}>
                    {assignedEmployees.length > 0 ? (
                      <Avatar.Group maxCount={10}>
                        {assignedEmployees.map(emp => (
                          <Tooltip title={emp.name || emp.fullName} key={emp.id || emp.userId}>
                            <Avatar src={emp.avatar} icon={<UserOutlined />} />
                          </Tooltip>
                        ))}
                      </Avatar.Group>
                    ) : (
                      <Text type="secondary" italic>no team members still assigned</Text>
                    )}
                  </div>
                )}
              </Col>
              <Col span={24}>
                <Divider style={{ margin: '12px 0' }} />
                <Text type="secondary">Description:</Text>
                <Paragraph style={{ marginTop: 8 }}>{project.description}</Paragraph>
              </Col>
            </Row>
          </Card>

          <Card title="Scope Document" style={{ marginBottom: 16 }}>
            <Table 
              size="small"
              pagination={false}
              dataSource={documents.filter(doc => doc.documentCategory === 'scope')}
              rowKey="id"
              locale={{ emptyText: 'No scope document uploaded yet.' }}
              columns={[
                { 
                  title: 'File Name', 
                  dataIndex: 'fileName', 
                  key: 'fileName',
                  render: (text, record) => <Text strong>{text || record.name || 'document.pdf'}</Text>
                },
                { 
                  title: 'Category', 
                  dataIndex: 'documentCategory', 
                  key: 'documentCategory',
                  render: (cat) => <Tag color={cat === 'scope' ? 'purple' : 'blue'}>{cat ? cat.toUpperCase() : 'DOCUMENT'}</Tag>
                },
                { 
                  title: 'Uploaded Date', 
                  dataIndex: 'createdAt', 
                  key: 'createdAt', 
                  render: d => d ? dayjs(d).format('DD MMM YYYY') : '-' 
                },
                { 
                  title: 'Action', 
                  key: 'action', 
                  render: (_, record) => (
                    <Button 
                      type="link" 
                      size="small" 
                      onClick={() => projectService.downloadDocument(project.id || id, record.documentId || record.id, record.fileName || record.name)}
                    >
                      Download
                    </Button>
                  ) 
                }
              ]}
            />
          </Card>

          {role !== 'ProjectManager' && (
            <Card title="Cost Analysis Summary" style={{ marginBottom: 16 }}>
              <Table 
                size="small"
                pagination={false}
                dataSource={[
                  { key: '1', phase: 'Discovery', hours: 100, cost: 50000 },
                  { key: '2', phase: 'Design', hours: 200, cost: 150000 },
                  { key: '3', phase: 'Development', hours: 600, cost: 500000 },
                ]}
                columns={[
                  { title: 'Phase', dataIndex: 'phase', key: 'phase' },
                  { title: 'Hours', dataIndex: 'hours', key: 'hours' },
                  { title: 'Cost', dataIndex: 'cost', key: 'cost', render: c => `₹ ${c.toLocaleString('en-IN')}` }
                ]}
                summary={pageData => {
                  let totalHours = 0;
                  let totalCost = 0;
                  pageData.forEach(({ hours, cost }) => {
                    totalHours += hours;
                    totalCost += cost;
                  });
                  return (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0}><Text strong>Total</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={1}><Text strong>{totalHours}</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={2}><Text strong>₹ {totalCost.toLocaleString('en-IN')}</Text></Table.Summary.Cell>
                    </Table.Summary.Row>
                  );
                }}
              />
            </Card>
          )}

          {/* Section 6: Status Update (Conditional) */}
          {canUpdateStatus && (
            <Card title="Update Project Status">
              <Form form={form} layout="vertical" onFinish={handleUpdateStatus}>
                <Form.Item name="status" label="Current Phase" required>
                  <Select>
                    <Select.Option value="InProgress">In Progress</Select.Option>
                    <Select.Option value="OnHold">On Hold</Select.Option>
                    <Select.Option value="InReview">Under Review</Select.Option>
                    <Select.Option value="Deployed">Deployed</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item name="note" label="Status Note">
                  <TextArea rows={3} maxLength={1000} showCount placeholder="Add a brief update on current progress..." />
                </Form.Item>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button type="primary" htmlType="submit" loading={updating} icon={<CheckCircleOutlined />}>
                    Update Status
                  </Button>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Last updated: {project.latestStatusNote ? dayjs().format('DD MMM YYYY') : 'Never'}
                  </Text>
                </div>
              </Form>
            </Card>
          )}
        </Col>

        {/* Section 7: Activity Log */}
        {role !== 'ProjectManager' && (
          <Col xs={24} lg={8}>
            <Card title={<Space><HistoryOutlined /> Activity Log</Space>}>
              <Timeline mode="left">
                {auditLog.map(log => (
                  <Timeline.Item key={log.id} label={dayjs(log.timestamp).format('DD MMM')}>
                    <Text strong>{log.action}</Text>
                    <div style={{ fontSize: '12px', color: '#8c8c8c' }}>by {log.user}</div>
                  </Timeline.Item>
                ))}
              </Timeline>
              <Button type="link" block>Load More</Button>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default ProjectOverviewPage;
