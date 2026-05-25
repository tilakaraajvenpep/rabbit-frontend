import React, { useState, useEffect } from 'react';
import { 
  Row, Col, Card, Statistic, Table, Tag, Button, Space, Typography, 
  Skeleton, Alert, Divider, notification, Modal, Form, Input, 
  Select, DatePicker, Tooltip, Progress, Drawer, Timeline
} from 'antd';
import { 
  ProjectOutlined, 
  TeamOutlined, 
  WarningOutlined, 
  BellOutlined,
  EyeOutlined,
  LineChartOutlined,
  CheckCircleOutlined,
  RollbackOutlined,
  CalendarOutlined,
  FileTextOutlined,
  SearchOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { analyticsService } from '../../services/analyticsService';
import { useAlertStore } from '../../store/alertStore';
import { projectService } from '../../services/projectService';
import { adminService } from '../../services/adminService';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { useThemeStore } from '../../store/themeStore';

dayjs.extend(isBetween);
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const PMDashboardPage = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useThemeStore();
  const [projects, setProjects] = useState([]);
  const [teamLeads, setTeamLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const { unreadCount } = useAlertStore();

  // Filters state
  const [searchText, setSearchText] = useState('');
  const [selectedProjectType, setSelectedProjectType] = useState(null);
  const [selectedSalesOwner, setSelectedSalesOwner] = useState(null);
  const [selectedTL, setSelectedTL] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [dateRange, setDateRange] = useState(null);

  // Return comments Modal state
  const [isReturnModalVisible, setIsReturnModalVisible] = useState(false);
  const [selectedProjectForReturn, setSelectedProjectForReturn] = useState(null);
  const [returnComments, setReturnComments] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  // Milestones drawer state
  const [isMilestoneDrawerVisible, setIsMilestoneDrawerVisible] = useState(false);
  const [selectedProjectForMilestones, setSelectedProjectForMilestones] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projectsRes, usersRes] = await Promise.all([
        projectService.getProjects(),
        adminService.getUsers()
      ]);
      setProjects(projectsRes.data || []);
      setTeamLeads((usersRes.data || []).filter(u => u.role === 'TeamLead'));
    } catch (error) {
      console.error('Failed to fetch PM dashboard data', error);
      notification.error({ message: 'Error', description: 'Failed to load projects and team leads.' });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveProject = async (project) => {
    Modal.confirm({
      title: 'Approve Project Budget & Milestones?',
      content: `Are you sure you want to approve "${project.name}"? This will auto-generate project tickets and move the project status to Approved.`,
      okText: 'Yes, Approve',
      cancelText: 'No',
      onOk: async () => {
        try {
          await projectService.updateStatus(project.id, { 
            status: 'Approved',
            note: 'Approved by Project Manager.' 
          });
          notification.success({ 
            message: 'Project Approved', 
            description: 'Tickets have been automatically generated for this project.' 
          });
          fetchData();
        } catch (error) {
          notification.error({ message: 'Error', description: 'Failed to approve project.' });
        }
      }
    });
  };

  const handleOpenReturnModal = (project) => {
    setSelectedProjectForReturn(project);
    setReturnComments('');
    setIsReturnModalVisible(true);
  };

  const handleConfirmReturn = async () => {
    if (!returnComments.trim()) {
      notification.warning({ message: 'Validation', description: 'Please enter comments to return the project.' });
      return;
    }
    setSubmittingReturn(true);
    try {
      await projectService.updateStatus(selectedProjectForReturn.id, {
        status: 'ReturnedToAccounts',
        comments: returnComments,
        note: returnComments
      });
      notification.success({ 
        message: 'Project Returned', 
        description: 'Successfully returned the project to Accounts with comments.' 
      });
      setIsReturnModalVisible(false);
      fetchData();
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to return project.' });
    } finally {
      setSubmittingReturn(false);
    }
  };

  const handleOpenMilestoneDrawer = (project) => {
    setSelectedProjectForMilestones(project);
    setIsMilestoneDrawerVisible(true);
  };

  // Calculations for Deadline stats
  const getDeadlineStats = () => {
    const activeProjs = projects.filter(p => ['Approved', 'InProgress', 'OnHold'].includes(p.status));
    const now = dayjs();
    const startOfMonth = now.startOf('month');
    const endOfMonth = now.endOf('month');

    let totalDeadlines = 0;
    let thisMonthDeadlines = 0;
    let crossedDeadlines = 0;
    let thisMonthCrossed = 0;

    activeProjs.forEach(p => {
      if (p.endDate) {
        totalDeadlines++;
        const end = dayjs(p.endDate);
        if (end.isBefore(now)) {
          crossedDeadlines++;
        }
        if (end.isBetween(startOfMonth, endOfMonth, null, '[]')) {
          thisMonthDeadlines++;
          if (end.isBefore(now)) {
            thisMonthCrossed++;
          }
        }
      }
    });

    return { totalDeadlines, thisMonthDeadlines, crossedDeadlines, thisMonthCrossed };
  };

  const dlStats = getDeadlineStats();

  // Filtering active projects
  const activeProjects = projects.filter(p => ['Approved', 'InProgress', 'OnHold'].includes(p.status));
  const filteredActiveProjects = activeProjects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchText.toLowerCase()) || 
                          (p.client && p.client.toLowerCase().includes(searchText.toLowerCase())) ||
                          p.code.toLowerCase().includes(searchText.toLowerCase());

    const matchesType = !selectedProjectType || p.description?.toLowerCase().includes(selectedProjectType.toLowerCase());
    const matchesSales = !selectedSalesOwner || p.createdByUserId === selectedSalesOwner;
    const matchesTL = !selectedTL || p.assignedTeamLeadId === selectedTL;
    const matchesClient = !selectedClient || p.client === selectedClient;
    const matchesStatus = !selectedStatus || p.status === selectedStatus;
    
    let matchesDate = true;
    if (dateRange && dateRange[0] && dateRange[1]) {
      const pDate = dayjs(p.createdAt);
      matchesDate = pDate.isAfter(dateRange[0]) && pDate.isBefore(dateRange[1]);
    }

    return matchesSearch && matchesType && matchesSales && matchesTL && matchesClient && matchesStatus && matchesDate;
  });

  const pendingApprovalProjects = projects.filter(p => p.status === 'PendingPMApproval');

  // Extract unique options for filter dropdowns
  const clientOptions = Array.from(new Set(activeProjects.map(p => p.client).filter(Boolean))).map(c => ({ label: c, value: c }));
  const statusOptions = [
    { label: 'Approved', value: 'Approved' },
    { label: 'In Progress', value: 'InProgress' },
    { label: 'On Hold', value: 'OnHold' }
  ];

  // Active Projects Columns
  const activeColumns = [
    {
      title: '#',
      key: 'index',
      width: 50,
      render: (_, __, index) => index + 1
    },
    {
      title: 'Customer Name',
      dataIndex: 'client',
      key: 'client',
      sorter: (a, b) => (a.client || '').localeCompare(b.client || '')
    },
    {
      title: 'Project Type',
      dataIndex: 'description',
      key: 'projectType',
      render: (desc) => {
        const isCustom = desc?.toLowerCase().includes('custom') || desc?.toLowerCase().includes('special');
        return <Tag color={isCustom ? 'cyan' : 'blue'}>{isCustom ? 'Customised' : 'General'}</Tag>;
      }
    },
    {
      title: 'Sales Owner',
      dataIndex: 'createdByUserId',
      key: 'salesOwner',
      render: () => 'Sales Manager'
    },
    {
      title: 'Project Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => <Text strong style={{ color: '#1890ff', cursor: 'pointer' }} onClick={() => navigate(`/pm/projects/${record.id}`)}>{name}</Text>
    },
    {
      title: 'Allotted To',
      dataIndex: 'assignedTeamLeadId',
      key: 'assignedTeamLeadId',
      render: (tlId) => {
        const tl = teamLeads.find(t => t.id === tlId);
        return tl ? <Tag color="geekblue">{tl.name || tl.fullName}</Tag> : <Text type="secondary">Unassigned</Text>;
      }
    },
    {
      title: 'Login Date',
      dataIndex: 'createdAt',
      key: 'loginDate',
      render: (date) => dayjs(date).format('DD MMM YYYY')
    },
    {
      title: 'Deadline',
      dataIndex: 'endDate',
      key: 'deadline',
      render: (date) => {
        if (!date) return '-';
        const isOverdue = dayjs(date).isBefore(dayjs());
        return (
          <Space direction="vertical" size={0}>
            <Text delete={isOverdue} type={isOverdue ? "danger" : "default"}>{dayjs(date).format('DD MMM YYYY')}</Text>
            {isOverdue && <Tag color="red" style={{ fontSize: '10px', marginTop: 4 }}>Overdue</Tag>}
          </Space>
        );
      }
    },
    {
      title: 'Project Value',
      dataIndex: 'budgetTable',
      key: 'projectValue',
      render: (budgetTable) => {
        if (!Array.isArray(budgetTable)) return '₹ 0';
        const total = budgetTable.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
        return <Text strong>₹ {total.toLocaleString('en-IN')}</Text>;
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <StatusBadge status={status} />
    },
    {
      title: 'Progress (hrs)',
      key: 'progress',
      render: (_, record) => {
        const total = Number(record.totalHours) || 100;
        const consumed = Number(record.consumedHours) || 0;
        const pct = Math.min(100, Math.round((consumed / total) * 100));
        return (
          <Tooltip title={`${consumed} / ${total} hrs consumed`}>
            <div style={{ width: 120 }}>
              <Progress percent={pct} size="small" status={pct > 90 ? 'exception' : 'active'} />
              <div style={{ fontSize: '10px', textAlign: 'right', color: '#8c8c8c' }}>{consumed}h / {total}h</div>
            </div>
          </Tooltip>
        );
      }
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button icon={<EyeOutlined />} size="small" onClick={() => navigate(`/pm/projects/${record.id}`)}>View</Button>
          <Button icon={<DashboardOutlined />} size="small" type="primary" ghost onClick={() => navigate(`/pm/projects/${record.id}/kanban`)}>Kanban</Button>
          <Button icon={<FileTextOutlined />} size="small" onClick={() => handleOpenMilestoneDrawer(record)}>Milestones</Button>
        </Space>
      )
    }
  ];

  // Pending Approval Columns
  const pendingColumns = [
    {
      title: 'Project Code',
      dataIndex: 'code',
      key: 'code',
      render: (text) => <Text code>{text}</Text>
    },
    {
      title: 'Project Name',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'Client Name',
      dataIndex: 'client',
      key: 'client'
    },
    {
      title: 'Submitted By Accounts',
      key: 'totalHours',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>Total Hours: <strong>{record.totalHours}h</strong></Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>Buffer: {record.bufferHours}h</Text>
        </Space>
      )
    },
    {
      title: 'Project Value',
      dataIndex: 'budgetTable',
      key: 'value',
      render: (budgetTable) => {
        if (!Array.isArray(budgetTable)) return '₹ 0';
        const total = budgetTable.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
        return <Text strong style={{ color: '#52c41a' }}>₹ {total.toLocaleString('en-IN')}</Text>;
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button 
            type="primary" 
            icon={<CheckCircleOutlined />} 
            onClick={() => handleApproveProject(record)}
          >
            Approve & Auto-gen Tickets
          </Button>
          <Button 
            type="default" 
            danger 
            icon={<RollbackOutlined />} 
            onClick={() => handleOpenReturnModal(record)}
          >
            Return to Accounts
          </Button>
        </Space>
      )
    }
  ];

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <div>
      <PageHeader title="Project Manager Dashboard" />

      {unreadCount > 0 && (
        <Alert
          message={`You have ${unreadCount} unread critical alerts!`}
          type="error"
          showIcon
          action={
            <Button size="small" danger onClick={() => navigate('/pm/alerts')}>
              View Alerts
            </Button>
          }
          style={{ marginBottom: 24 }}
        />
      )}

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Active Projects"
              value={activeProjects.length}
              prefix={<ProjectOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic 
              title="Pending PM Approval" 
              value={pendingApprovalProjects.length} 
              prefix={<FileTextOutlined style={{ color: '#fa8c16' }} />} 
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic 
              title="Overdue Projects" 
              value={dlStats.crossedDeadlines} 
              prefix={<WarningOutlined style={{ color: '#cf1322' }} />} 
              valueStyle={{ color: '#cf1322' }} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic title="Unread Alerts" value={unreadCount} prefix={<BellOutlined />} valueStyle={{ color: unreadCount > 0 ? '#fa8c16' : '#3f9142' }} />
          </Card>
        </Col>
      </Row>

      {/* Pending PM Approval Section */}
      {pendingApprovalProjects.length > 0 && (
        <Card 
          title={<Space><FileTextOutlined style={{ color: '#fa8c16' }} /> <span style={{ color: '#fa8c16' }}>Projects Waiting for PM Approval</span></Space>}
          style={{ marginBottom: 24, border: '1px solid #ffe7ba', background: isDarkMode ? '#1c1b16' : '#fffbe6', borderRadius: 12 }}
        >
          <Table
            dataSource={pendingApprovalProjects}
            columns={pendingColumns}
            rowKey="id"
            pagination={false}
          />
        </Card>
      )}

      {/* Active Projects Table & Filters Section */}
      <Card 
        title={<Space><ProjectOutlined /> <span>Active Project Tracking</span></Space>} 
        style={{ borderRadius: 12 }}
      >
        {/* Filters Header block */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8} md={6} lg={4}>
            <Input 
              placeholder="Search project, client, code" 
              value={searchText} 
              onChange={e => setSearchText(e.target.value)}
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col xs={24} sm={8} md={6} lg={3}>
            <Select
              placeholder="Project Type"
              style={{ width: '100%' }}
              allowClear
              onChange={setSelectedProjectType}
              options={[
                { label: 'Customised', value: 'custom' },
                { label: 'General', value: 'general' }
              ]}
            />
          </Col>
          <Col xs={24} sm={8} md={6} lg={3}>
            <Select
              placeholder="Client"
              style={{ width: '100%' }}
              allowClear
              onChange={setSelectedClient}
              options={clientOptions}
            />
          </Col>
          <Col xs={24} sm={8} md={6} lg={4}>
            <Select
              placeholder="Team Lead"
              style={{ width: '100%' }}
              allowClear
              onChange={setSelectedTL}
              options={teamLeads.map(tl => ({ label: tl.name || tl.fullName, value: tl.id }))}
            />
          </Col>
          <Col xs={24} sm={8} md={6} lg={3}>
            <Select
              placeholder="Status"
              style={{ width: '100%' }}
              allowClear
              onChange={setSelectedStatus}
              options={statusOptions}
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={5}>
            <RangePicker 
              style={{ width: '100%' }}
              onChange={setDateRange}
            />
          </Col>
        </Row>

        {/* Deadline stats banner */}
        <div style={{ background: isDarkMode ? '#1e293b' : '#f8fafc', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
          <Text strong>Deadline Status Tracker: </Text>
          <Space split={<Divider type="vertical" />}>
            <Text type="secondary">Total: <Text strong>{dlStats.totalDeadlines}</Text></Text>
            <Text type="secondary">This Month Deadlines: <Text strong style={{ color: '#fa8c16' }}>{dlStats.thisMonthDeadlines}</Text></Text>
            <Text type="secondary">Crossed Deadlines: <Text strong style={{ color: '#cf1322' }}>{dlStats.crossedDeadlines}</Text></Text>
          </Space>
        </div>

        <Table 
          columns={activeColumns} 
          dataSource={filteredActiveProjects} 
          rowKey="id" 
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: 'No active projects matching the filters.' }}
        />
      </Card>

      {/* Return to Accounts Comments Modal */}
      <Modal
        title={`Return Project "${selectedProjectForReturn?.name}" for Revision?`}
        open={isReturnModalVisible}
        onOk={handleConfirmReturn}
        onCancel={() => setIsReturnModalVisible(false)}
        confirmLoading={submittingReturn}
        okText="Submit Return"
        okButtonProps={{ danger: true }}
      >
        <Form layout="vertical">
          <Form.Item label="Reason / Comments for Accounts Team" required>
            <Input.TextArea 
              rows={4} 
              value={returnComments} 
              onChange={e => setReturnComments(e.target.value)}
              placeholder="Enter details on what needs to be revised (e.g. Budget reduction, Hours allocation edit, incorrect milestones...)"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Milestones Drawer */}
      <Drawer
        title={`Milestones — ${selectedProjectForMilestones?.name}`}
        placement="right"
        width={400}
        onClose={() => setIsMilestoneDrawerVisible(false)}
        open={isMilestoneDrawerVisible}
      >
        {selectedProjectForMilestones?.milestones && Array.isArray(selectedProjectForMilestones.milestones) ? (
          <Timeline mode="left">
            {selectedProjectForMilestones.milestones.map((m, index) => (
              <Timeline.Item 
                key={index}
                dot={<CalendarOutlined style={{ fontSize: '16px' }} />}
                color={dayjs(m.date).isBefore(dayjs()) ? 'red' : 'green'}
              >
                <div style={{ marginBottom: 8 }}>
                  <Text strong style={{ fontSize: '15px' }}>{m.title}</Text>
                  <br />
                  <Text type="secondary">{m.description || 'No description'}</Text>
                  <br />
                  <Tag color="green" style={{ marginTop: 4 }}>
                    Value: ₹ {Number(m.amount || 0).toLocaleString('en-IN')}
                  </Tag>
                  <br />
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    Release Date: {m.date ? dayjs(m.date).format('DD MMM YYYY') : 'Not Set'}
                  </Text>
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        ) : (
          <Alert message="No milestones defined for this project." type="info" showIcon />
        )}
      </Drawer>
    </div>
  );
};

export default PMDashboardPage;
