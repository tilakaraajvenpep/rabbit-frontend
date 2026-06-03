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
  const remainingDays = project.endDate 
    ? dayjs(project.endDate).startOf('day').diff(dayjs().startOf('day'), 'day') 
    : null;
  const displayRemaining = remainingDays === null
    ? 'Not Set'
    : remainingDays < 0
      ? `${remainingDays} days (Overdue)`
      : `${remainingDays} days`;

  return (
    <div style={{ height: 'calc(100vh - 110px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader 
        title={`${project.code} — ${project.name}`}
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Back</Button>
          </Space>
        }
        style={{ paddingBottom: 8 }}
      />

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Row 1: Key Metrics */}
        <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
          {!['TeamLead', 'ProjectManager'].includes(role) && (
            <Card size="small" style={{ flex: 1, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <Statistic 
                title={<span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Approved Budget</span>}
                value={project.approvedBudget} 
                prefix={<DollarOutlined />} 
                formatter={(v) => `₹ ${v.toLocaleString('en-IN')}`}
                valueStyle={{ fontSize: 20, fontWeight: 700 }}
              />
            </Card>
          )}
          <Card size="small" style={{ flex: 1, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic 
              title={<span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Approved Hours</span>} 
              value={project.approvedHours} 
              prefix={<FieldTimeOutlined />} 
              valueStyle={{ fontSize: 20, fontWeight: 700 }}
            />
          </Card>
          <Card size="small" style={{ flex: 1, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic 
              title={<span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Consumed Hours</span>} 
              value={consumedHours.toFixed(2)} 
              prefix={<FieldTimeOutlined />} 
              valueStyle={{ color: '#cf1322', fontSize: 20, fontWeight: 700 }} 
            />
          </Card>
          <Card size="small" style={{ flex: 1, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic 
              title={<span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Days Remaining</span>} 
              value={displayRemaining} 
              prefix={<CalendarOutlined />} 
              valueStyle={{ 
                color: (typeof remainingDays === 'number' && remainingDays < 7) ? '#cf1322' : '#3f9142', 
                fontSize: 20, 
                fontWeight: 700 
              }} 
            />
          </Card>
        </div>

        {/* Row 2: Columns */}
        <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0 }}>
          {/* Left Column: Project details and Scope */}
          <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', paddingRight: 4, minHeight: 0 }}>
            
            <Card 
              title={<span style={{ fontWeight: 700, fontSize: 14 }}>Project Information</span>} 
              size="small" 
              style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
            >
              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Client:</Text> <Text strong style={{ fontSize: 13 }}>{project.client}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Status:</Text> <StatusBadge status={project.status} />
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Start Date:</Text> <Text strong style={{ fontSize: 13 }}>{dayjs(project.createdAt).format('DD MMM YYYY')}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Est. End Date:</Text> <Text strong style={{ fontSize: 13 }}>{project.endDate ? dayjs(project.endDate).format('DD MMM YYYY') : 'Not Set'}</Text>
                </Col>
                <Col span={24}>
                  <Divider style={{ margin: '8px 0' }} />
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Team Members:</Text>
                  {role === 'TeamLead' ? (
                    assignedEmployees.length > 0 ? (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {assignedEmployees.map(emp => (
                          <Tag 
                            key={emp.id || emp.userId} 
                            color="blue" 
                            style={{ padding: '2px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, margin: 0 }}
                          >
                            <Avatar size="small" src={emp.avatar} icon={<UserOutlined />} style={{ width: 16, height: 16, minWidth: 16 }} />
                            {emp.name || emp.fullName}
                          </Tag>
                        ))}
                      </div>
                    ) : (
                      <Text type="secondary" italic style={{ fontSize: 12 }}>no team members assigned</Text>
                    )
                  ) : (
                    <div>
                      {assignedEmployees.length > 0 ? (
                        <Avatar.Group maxCount={10}>
                          {assignedEmployees.map(emp => (
                            <Tooltip title={emp.name || emp.fullName} key={emp.id || emp.userId}>
                              <Avatar src={emp.avatar} icon={<UserOutlined />} size="small" />
                            </Tooltip>
                          ))}
                        </Avatar.Group>
                      ) : (
                        <Text type="secondary" italic style={{ fontSize: 12 }}>no team members assigned</Text>
                      )}
                    </div>
                  )}
                </Col>
                <Col span={24}>
                  <Divider style={{ margin: '8px 0' }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>Description:</Text>
                  <Paragraph style={{ marginTop: 4, marginBottom: 0, fontSize: 13 }} ellipsis={{ rows: 3, expandable: true, symbol: 'more' }}>
                    {project.description}
                  </Paragraph>
                </Col>
              </Row>
            </Card>

            <Card 
              title={<span style={{ fontWeight: 700, fontSize: 14 }}>Scope Document</span>} 
              size="small" 
              style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
              bodyStyle={{ padding: 0 }}
            >
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
                    render: (text, record) => <Text strong style={{ fontSize: 13 }}>{text || record.name || 'document.pdf'}</Text>
                  },
                  { 
                    title: 'Category', 
                    dataIndex: 'documentCategory', 
                    key: 'documentCategory',
                    render: (cat) => <Tag color={cat === 'scope' ? 'purple' : 'blue'} style={{ fontSize: 11 }}>{cat ? cat.toUpperCase() : 'DOCUMENT'}</Tag>
                  },
                  { 
                    title: 'Action', 
                    key: 'action', 
                    render: (_, record) => (
                      <Button 
                        type="link" 
                        size="small" 
                        onClick={() => projectService.downloadDocument(project.id || id, record.documentId || record.id, record.fileName || record.name)}
                        style={{ padding: 0 }}
                      >
                        Download
                      </Button>
                    ) 
                  }
                ]}
              />
            </Card>

            {role !== 'ProjectManager' && (
              <Card 
                title={<span style={{ fontWeight: 700, fontSize: 14 }}>Cost Analysis Summary</span>} 
                size="small" 
                style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                bodyStyle={{ padding: 0 }}
              >
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
                      <Table.Summary.Row style={{ background: '#f8fafc' }}>
                        <Table.Summary.Cell index={0}><Text strong>Total</Text></Table.Summary.Cell>
                        <Table.Summary.Cell index={1}><Text strong>{totalHours}</Text></Table.Summary.Cell>
                        <Table.Summary.Cell index={2}><Text strong>₹ {totalCost.toLocaleString('en-IN')}</Text></Table.Summary.Cell>
                      </Table.Summary.Row>
                    );
                  }}
                />
              </Card>
            )}
          </div>

          {/* Right Column: Progress and Status Update / Activity log */}
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', paddingRight: 4, minHeight: 0 }}>
            <Card 
              title={<span style={{ fontWeight: 700, fontSize: 14 }}>Project Progress</span>} 
              size="small" 
              style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
            >
              <div style={{ marginBottom: ['TeamLead', 'ProjectManager'].includes(role) ? 0 : 12 }}>
                <Text strong style={{ fontSize: 12 }}>Hours Consumption</Text>
                <HoursProgress consumed={consumedHours} total={project.approvedHours} />
              </div>
              {!['TeamLead', 'ProjectManager'].includes(role) && (
                <div>
                  <Text strong style={{ fontSize: 12 }}>Budget Utilization</Text>
                  <HoursProgress consumed={400000} total={project.approvedBudget} unit="₹" />
                </div>
              )}
            </Card>

            {canUpdateStatus && (
              <Card 
                title={<span style={{ fontWeight: 700, fontSize: 14 }}>Update Project Status</span>} 
                size="small" 
                style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
              >
                <Form form={form} layout="vertical" onFinish={handleUpdateStatus}>
                  <Form.Item name="status" label="Current Phase" required style={{ marginBottom: 8 }}>
                    <Select size="small">
                      <Select.Option value="InProgress">In Progress</Select.Option>
                      <Select.Option value="OnHold">On Hold</Select.Option>
                      <Select.Option value="InReview">Under Review</Select.Option>
                      <Select.Option value="Deployed">Deployed</Select.Option>
                    </Select>
                  </Form.Item>
                  <Form.Item name="note" label="Status Note" style={{ marginBottom: 8 }}>
                    <TextArea rows={2} maxLength={1000} showCount placeholder="Add a brief update..." style={{ fontSize: 12 }} />
                  </Form.Item>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Button type="primary" htmlType="submit" loading={updating} icon={<CheckCircleOutlined />} size="small">
                      Update Status
                    </Button>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      Last updated: {project.latestStatusNote ? dayjs().format('DD MMM YYYY') : 'Never'}
                    </Text>
                  </div>
                </Form>
              </Card>
            )}

            {role !== 'ProjectManager' && (
              <Card 
                title={<span style={{ fontWeight: 700, fontSize: 14 }}><HistoryOutlined /> Activity Log</span>} 
                size="small" 
                style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                bodyStyle={{ maxHeight: 220, overflowY: 'auto' }}
              >
                <Timeline mode="left" style={{ marginTop: 8 }}>
                  {auditLog.map(log => (
                    <Timeline.Item key={log.id} label={dayjs(log.timestamp).format('DD MMM')} style={{ paddingBottom: 8 }}>
                      <Text strong style={{ fontSize: 12 }}>{log.action}</Text>
                      <div style={{ fontSize: '11px', color: '#8c8c8c' }}>by {log.user}</div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectOverviewPage;
