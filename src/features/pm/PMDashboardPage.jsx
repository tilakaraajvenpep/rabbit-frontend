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
  DashboardOutlined,
  ArrowRightOutlined,
  ClockCircleOutlined
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
          await projectService.updateProjectStatus(project.id, { 
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
      await projectService.updateProjectStatus(selectedProjectForReturn.id, {
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
      width: 60,
      fixed: 'left',
      align: 'center',
      render: (_, __, index) => <Text type="secondary" style={{ fontWeight: 600 }}>{index + 1}</Text>
    },
    {
      title: 'Customer Name',
      dataIndex: 'client',
      key: 'client',
      width: 160,
      fixed: 'left',
      sorter: (a, b) => (a.client || '').localeCompare(b.client || ''),
      render: (client) => <Text strong style={{ color: isDarkMode ? '#e2e8f0' : '#334155' }}>{client || '-'}</Text>
    },
    {
      title: 'Project Type',
      dataIndex: 'description',
      key: 'projectType',
      width: 130,
      render: (desc) => {
        const isCustom = desc?.toLowerCase().includes('custom') || desc?.toLowerCase().includes('special');
        return (
          <Tag color={isCustom ? 'cyan' : 'blue'} style={{ borderRadius: 6, fontWeight: 500, padding: '2px 8px' }}>
            {isCustom ? 'Customised' : 'General'}
          </Tag>
        );
      }
    },
    {
      title: 'Sales Owner',
      dataIndex: 'createdByUserId',
      key: 'salesOwner',
      width: 140,
      render: () => <Text style={{ color: '#64748b' }}>Sales Manager</Text>
    },
    {
      title: 'Project Name',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (name, record) => (
        <span 
          className="project-link" 
          style={{ color: '#1890ff', cursor: 'pointer', fontWeight: 600, fontSize: '14px', display: 'inline-block' }} 
          onClick={() => navigate(`/pm/projects/${record.id}`)}
        >
          {name}
        </span>
      )
    },
    {
      title: 'Allotted To',
      dataIndex: 'assignedTeamLeadId',
      key: 'assignedTeamLeadId',
      width: 180,
      render: (tlId) => {
        const tl = teamLeads.find(t => t.id === tlId);
        return tl ? (
          <Tag color="geekblue" style={{ border: 'none', borderRadius: 4, padding: '3px 8px', fontWeight: 500 }}>
            {tl.name || tl.fullName}
          </Tag>
        ) : (
          <Text type="secondary" italic>Unassigned</Text>
        );
      }
    },
    {
      title: 'Login Date',
      dataIndex: 'createdAt',
      key: 'loginDate',
      width: 130,
      render: (date) => <Text style={{ color: '#475569' }}>{dayjs(date).format('DD MMM YYYY')}</Text>
    },
    {
      title: 'Deadline',
      dataIndex: 'endDate',
      key: 'deadline',
      width: 140,
      render: (date) => {
        if (!date) return <Text type="secondary">-</Text>;
        const isOverdue = dayjs(date).isBefore(dayjs());
        return (
          <Space direction="vertical" size={2}>
            <Text delete={isOverdue} type={isOverdue ? "danger" : "default"} style={{ fontWeight: isOverdue ? 600 : 500 }}>
              {dayjs(date).format('DD MMM YYYY')}
            </Text>
            {isOverdue && <Tag color="error" style={{ fontSize: '10px', borderRadius: 4, margin: 0 }}>Overdue</Tag>}
          </Space>
        );
      }
    },
    {
      title: 'Project Value',
      dataIndex: 'budgetTable',
      key: 'projectValue',
      width: 150,
      render: (budgetTable) => {
        if (!Array.isArray(budgetTable)) return <Text strong>₹0</Text>;
        const total = budgetTable.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
        return <Text strong style={{ color: '#0f766e', fontSize: '14px' }}>₹{total.toLocaleString('en-IN')}</Text>;
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => <StatusBadge status={status} />
    },
    {
      title: 'Progress (hrs)',
      key: 'progress',
      width: 180,
      render: (_, record) => {
        const total = Number(record.totalHours) || 100;
        const consumed = Number(record.consumedHours) || 0;
        const pct = Math.min(100, Math.round((consumed / total) * 100));
        return (
          <Tooltip title={`${consumed} / ${total} hrs consumed`}>
            <div style={{ width: '100%', minWidth: 120 }}>
              <Progress 
                percent={pct} 
                size="small" 
                status={pct > 90 ? 'exception' : 'active'}
                strokeColor={pct > 90 ? '#ef4444' : '#10b981'}
                style={{ margin: 0 }}
              />
              <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', color: '#64748b', marginTop: 4 }}>
                <span>Consumed: {consumed}h</span>
                <span>Total: {total}h</span>
              </div>
            </div>
          </Tooltip>
        );
      }
    },
    {
      title: 'Action',
      key: 'action',
      width: 250,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Button 
            icon={<EyeOutlined />} 
            size="small" 
            onClick={() => navigate(`/pm/projects/${record.id}`)}
          >
            View
          </Button>
          <Button 
            icon={<DashboardOutlined />} 
            size="small" 
            type="primary" 
            ghost 
            onClick={() => navigate(`/pm/projects/${record.id}/kanban`)}
          >
            Kanban
          </Button>
          <Button 
            icon={<FileTextOutlined />} 
            size="small" 
            onClick={() => handleOpenMilestoneDrawer(record)}
          >
            Milestones
          </Button>
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
      width: 140,
      render: (text) => <Text code>{text}</Text>
    },
    {
      title: 'Project Name',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (text) => <Text strong style={{ fontSize: '14px' }}>{text}</Text>
    },
    {
      title: 'Client Name',
      dataIndex: 'client',
      key: 'client',
      width: 160,
    },
    {
      title: 'Submitted By Accounts',
      key: 'totalHours',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text>Total Hours: <strong>{record.totalHours}h</strong></Text>
          <Text type="secondary" style={{ fontSize: '11px' }}>Buffer: {record.bufferHours}h</Text>
        </Space>
      )
    },
    {
      title: 'Project Value',
      dataIndex: 'budgetTable',
      key: 'value',
      width: 160,
      render: (budgetTable) => {
        if (!Array.isArray(budgetTable)) return <Text strong>₹0</Text>;
        const total = budgetTable.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
        return <Text strong style={{ color: '#16a34a', fontSize: '14px' }}>₹{total.toLocaleString('en-IN')}</Text>;
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 320,
      align: 'center',
      render: (_, record) => (
        <Space>
          <Button 
            type="primary" 
            icon={<CheckCircleOutlined />} 
            style={{ background: '#16a34a', borderColor: '#16a34a' }}
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
            Return
          </Button>
        </Space>
      )
    }
  ];

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  // Card Background Style Mappings (Light/Dark Mode)
  const activeCardStyle = {
    background: isDarkMode ? 'linear-gradient(135deg, #075985 0%, #0c4a6e 100%)' : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
    border: 'none',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)'
  };
  const pendingCardStyle = {
    background: isDarkMode ? 'linear-gradient(135deg, #854d0e 0%, #713f12 100%)' : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    border: 'none',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)'
  };
  const overdueCardStyle = {
    background: isDarkMode ? 'linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)' : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
    border: 'none',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)'
  };
  const alertsCardStyle = {
    background: isDarkMode ? 'linear-gradient(135deg, #581c87 0%, #4a044e 100%)' : 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
    border: 'none',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)'
  };

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Custom Styles Injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        .pm-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 12px !important;
          overflow: hidden;
        }
        .pm-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 20px -5px rgba(0, 0, 0, 0.1), 0 8px 8px -5px rgba(0, 0, 0, 0.04);
        }
        .pm-table .ant-table-thead > tr > th {
          background: ${isDarkMode ? '#1e293b' : '#f8fafc'} !important;
          color: ${isDarkMode ? '#cbd5e1' : '#475569'} !important;
          font-weight: 600 !important;
          border-bottom: 1px solid ${isDarkMode ? '#334155' : '#e2e8f0'} !important;
          font-size: 13px;
        }
        .project-link:hover {
          color: #096dd9 !important;
          text-decoration: underline;
        }
        .deadline-badge {
          background: ${isDarkMode ? '#1e293b' : '#ffffff'};
          border: 1px solid ${isDarkMode ? '#334155' : '#e2e8f0'};
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          border-radius: 8px;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .stat-value {
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 28px;
          font-weight: 700;
          line-height: 1.1;
          color: ${isDarkMode ? '#ffffff' : '#1e293b'};
        }
        .stat-title {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: ${isDarkMode ? '#94a3b8' : '#64748b'};
          margin-bottom: 6px;
        }
      `}} />

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
          style={{ marginBottom: 24, borderRadius: 10 }}
        />
      )}

      {/* KPI Cards Grid */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={12} lg={6}>
          <Card className="pm-card" style={activeCardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title={<div className="stat-title">Active Projects</div>}
              value={activeProjects.length}
              valueStyle={{ color: isDarkMode ? '#38bdf8' : '#0284c7' }}
              formatter={(val) => <div className="stat-value">{val}</div>}
              prefix={<ProjectOutlined style={{ marginRight: 8, color: isDarkMode ? '#38bdf8' : '#0284c7' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card className="pm-card" style={pendingCardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic 
              title={<div className="stat-title">Pending PM Approval</div>}
              value={pendingApprovalProjects.length} 
              valueStyle={{ color: isDarkMode ? '#fbbf24' : '#d97706' }} 
              formatter={(val) => <div className="stat-value">{val}</div>}
              prefix={<FileTextOutlined style={{ marginRight: 8, color: isDarkMode ? '#fbbf24' : '#d97706' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card className="pm-card" style={overdueCardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic 
              title={<div className="stat-title">Overdue Projects</div>}
              value={dlStats.crossedDeadlines} 
              valueStyle={{ color: isDarkMode ? '#f87171' : '#dc2626' }} 
              formatter={(val) => <div className="stat-value">{val}</div>}
              prefix={<WarningOutlined style={{ marginRight: 8, color: isDarkMode ? '#f87171' : '#dc2626' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card className="pm-card" style={alertsCardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic 
              title={<div className="stat-title">Unread Alerts</div>} 
              value={unreadCount} 
              valueStyle={{ color: isDarkMode ? '#c084fc' : '#7c3aed' }} 
              formatter={(val) => <div className="stat-value">{val}</div>}
              prefix={<BellOutlined style={{ marginRight: 8, color: isDarkMode ? '#c084fc' : '#7c3aed' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Pending PM Approval Section */}
      {pendingApprovalProjects.length > 0 && (
        <Card 
          title={<Space><FileTextOutlined style={{ color: '#d97706' }} /> <span style={{ color: isDarkMode ? '#fbbf24' : '#b45309' }}>Projects Waiting for PM Approval</span></Space>}
          style={{ marginBottom: 24, border: '1px solid #fef3c7', background: isDarkMode ? '#1e1b10' : '#fffbeb', borderRadius: 12 }}
          bodyStyle={{ padding: 0 }}
        >
          <Table
            dataSource={pendingApprovalProjects}
            columns={pendingColumns}
            rowKey="id"
            pagination={false}
            scroll={{ x: 'max-content' }}
            className="pm-table"
          />
        </Card>
      )}

      {/* Active Projects Table & Filters Section */}
      <Card 
        title={
          <Space>
            <ProjectOutlined style={{ color: '#1890ff' }} /> 
            <span style={{ fontWeight: 600 }}>Active Projects Workspace</span>
          </Space>
        } 
        style={{ borderRadius: 12, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}
        bodyStyle={{ padding: 24 }}
      >
        {/* Filters Toolbar */}
        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={12} md={6} lg={5}>
            <Input 
              placeholder="Search project, client, code..." 
              value={searchText} 
              onChange={e => setSearchText(e.target.value)}
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              style={{ borderRadius: 8 }}
            />
          </Col>
          <Col xs={12} sm={6} md={4} lg={3}>
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
          <Col xs={12} sm={6} md={4} lg={3}>
            <Select
              placeholder="Client Name"
              style={{ width: '100%' }}
              allowClear
              onChange={setSelectedClient}
              options={clientOptions}
            />
          </Col>
          <Col xs={24} sm={12} md={5} lg={4}>
            <Select
              placeholder="Allotted Team Lead"
              style={{ width: '100%' }}
              allowClear
              onChange={setSelectedTL}
              options={teamLeads.map(tl => ({ label: tl.name || tl.fullName, value: tl.id }))}
            />
          </Col>
          <Col xs={12} sm={6} md={5} lg={3}>
            <Select
              placeholder="Project Status"
              style={{ width: '100%' }}
              allowClear
              onChange={setSelectedStatus}
              options={statusOptions}
            />
          </Col>
          <Col xs={12} sm={6} md={6} lg={6}>
            <RangePicker 
              style={{ width: '100%', borderRadius: 8 }}
              onChange={setDateRange}
            />
          </Col>
        </Row>

        {/* Deadline Status Banner */}
        <div className="deadline-badge">
          <Space>
            <ClockCircleOutlined style={{ color: '#64748b', fontSize: '16px' }} />
            <Text strong style={{ color: '#475569', fontSize: '13px' }}>Deadline Status Tracker</Text>
          </Space>
          <Space size="large" split={<Divider type="vertical" style={{ height: 16 }} />}>
            <Text style={{ fontSize: '13px' }}>Total Tracked: <strong style={{ color: isDarkMode ? '#fff' : '#1e293b' }}>{dlStats.totalDeadlines}</strong></Text>
            <Text style={{ fontSize: '13px' }}>Due This Month: <strong style={{ color: '#d97706' }}>{dlStats.thisMonthDeadlines}</strong></Text>
            <Text style={{ fontSize: '13px' }}>Crossed Deadlines: <strong style={{ color: '#ef4444' }}>{dlStats.crossedDeadlines}</strong></Text>
          </Space>
        </div>

        {/* Responsive Table */}
        <Table 
          columns={activeColumns} 
          dataSource={filteredActiveProjects} 
          rowKey="id" 
          pagination={{ pageSize: 8, showSizeChanger: true }}
          locale={{ emptyText: 'No active projects matching the filters.' }}
          scroll={{ x: 'max-content' }}
          className="pm-table"
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
          <Timeline mode="left" style={{ marginTop: 10 }}>
            {selectedProjectForMilestones.milestones.map((m, index) => (
              <Timeline.Item 
                key={index}
                dot={<CalendarOutlined style={{ fontSize: '16px', color: '#10b981' }} />}
                color={dayjs(m.date).isBefore(dayjs()) ? 'red' : 'green'}
              >
                <div style={{ marginBottom: 12 }}>
                  <Text strong style={{ fontSize: '14px', display: 'block', color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>{m.title}</Text>
                  <Text type="secondary" style={{ fontSize: '12px', display: 'block', margin: '4px 0' }}>{m.description || 'No description'}</Text>
                  <Tag color="success" style={{ marginTop: 2, border: 'none', borderRadius: 4 }}>
                    Value: ₹{Number(m.amount || 0).toLocaleString('en-IN')}
                  </Tag>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: 4 }}>
                    Release Date: {m.date ? dayjs(m.date).format('DD MMM YYYY') : 'Not Set'}
                  </div>
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
