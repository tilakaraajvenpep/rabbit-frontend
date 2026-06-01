import React, { useState, useEffect } from 'react';
import { 
  Card, Select, Row, Col, Statistic, Table, Tag, Typography, 
  Divider, Skeleton, Empty, Space, Progress, theme, Descriptions
} from 'antd';
import dayjs from 'dayjs';
import { 
  DollarOutlined, 
  ProjectOutlined, 
  ArrowUpOutlined, 
  ArrowDownOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { projectService } from '../../services/projectService';
import { adminService } from '../../services/adminService';
import { ticketService } from '../../services/ticketService';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { useThemeStore } from '../../store/themeStore';

const { Title, Text } = Typography;

const ProfitLossPage = () => {
  const { isDarkMode } = useThemeStore();
  const { token } = theme.useToken();

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  // Selected project details
  const [project, setProject] = useState(null);
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [laborBreakdown, setLaborBreakdown] = useState([]);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectDetails(selectedProjectId);
    } else {
      setProject(null);
      setTickets([]);
      setLaborBreakdown([]);
    }
  }, [selectedProjectId]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await projectService.getProjects();
      const allProj = res.data || [];
      // Display all current projects in the system
      setProjects(allProj);
      if (allProj.length > 0) {
        setSelectedProjectId(allProj[0].id || allProj[0].projectId);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectDetails = async (projId) => {
    setFetchingDetails(true);
    try {
      const [projRes, usersRes, ticketsRes] = await Promise.all([
        projectService.getProjectById(projId),
        adminService.getUsers(),
        ticketService.getTickets(projId)
      ]);

      const projData = projRes.data;
      const usersList = usersRes.data || [];
      const ticketsList = ticketsRes.data || [];

      setProject(projData);
      setUsers(usersList);
      setTickets(ticketsList);

      // Compute labor cost breakdown by user
      const userHoursMap = {};
      ticketsList.forEach(t => {
        const userId = t.assignedTo || t.assignedToUserId;
        const hrs = Number(t.consumedHours) || 0;
        if (userId && hrs > 0) {
          userHoursMap[userId] = (userHoursMap[userId] || 0) + hrs;
        }
      });

      // Map to array with user details & hourly cost
      const breakdown = Object.entries(userHoursMap).map(([userIdStr, hours]) => {
        const userId = parseInt(userIdStr);
        const userObj = usersList.find(u => u.id === userId || u.userId === userId);
        const hourlyRate = userObj ? (Number(userObj.costPerHour) || 0) : 500; // Default fallback to 500
        return {
          key: userId,
          name: userObj ? (userObj.name || userObj.fullName) : `User #${userId}`,
          role: userObj ? userObj.role : 'Employee',
          hours,
          hourlyRate,
          totalCost: hours * hourlyRate
        };
      });

      // If breakdown is empty but project has consumed hours, add a general PM/TL estimation
      if (breakdown.length === 0 && Number(projData.consumedHours) > 0) {
        const totalProjHours = Number(projData.consumedHours);
        const defaultRate = 600; // average billing rate
        breakdown.push({
          key: 'est',
          name: 'Estimated Project Team Labor',
          role: 'General Cost',
          hours: totalProjHours,
          hourlyRate: defaultRate,
          totalCost: totalProjHours * defaultRate
        });
      }

      setLaborBreakdown(breakdown);
    } catch (err) {
      console.error('Failed to fetch details:', err);
    } finally {
      setFetchingDetails(false);
    }
  };

  // Helper to dynamically calculate milestone status based on tickets
  const getMilestoneStatus = (milestoneTitle) => {
    if (!milestoneTitle) return 'Pending';
    const milestoneTickets = tickets.filter(t => {
      if (!t.milestone) return false;
      const tMil = String(t.milestone).trim().toLowerCase();
      const mTitle = String(milestoneTitle).trim().toLowerCase();
      return tMil === mTitle || mTitle.includes(tMil) || tMil.includes(mTitle);
    });

    if (milestoneTickets.length === 0) {
      return 'Pending';
    }

    const allDone = milestoneTickets.every(t => t.status === 'Done');
    return allDone ? 'Completed' : 'InProgress';
  };

  if (loading) {
    return <Skeleton active paragraph={{ rows: 12 }} />;
  }

  // Financial calculations
  const revenue = project ? Number(project.approvedBudget) || 0 : 0;
  const totalLaborCost = laborBreakdown.reduce((sum, item) => sum + item.totalCost, 0);
  const profitLoss = revenue - totalLaborCost;
  const marginPercentage = revenue > 0 ? (profitLoss / revenue) * 100 : 0;
  const totalHoursLogged = laborBreakdown.reduce((sum, item) => sum + item.hours, 0);

  const isProfit = profitLoss >= 0;

  return (
    <div style={{ padding: '0 8px' }}>
      <PageHeader 
        title="Project Profit & Loss Analysis"
        subtitle="Real-time financial status, budgets, actual expenses, and profit margins"
      />

      <Card style={{ marginBottom: 24, borderRadius: 12 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong style={{ marginRight: 16, fontSize: 16 }}>Select Project: </Text>
            <Select
              style={{ width: 350 }}
              placeholder="Select project to analyze"
              value={selectedProjectId}
              onChange={setSelectedProjectId}
              size="large"
            >
              {projects.map(p => (
                <Select.Option key={p.id || p.projectId} value={p.id || p.projectId}>
                  {p.code ? `[${p.code}] ` : ''}{p.name}
                </Select.Option>
              ))}
            </Select>
          </div>
        </Space>
      </Card>

      {!project ? (
        <Card style={{ borderRadius: 12 }}>
          <Empty description="Please select a project to view profitability report." />
        </Card>
      ) : fetchingDetails ? (
        <Card style={{ borderRadius: 12 }}>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      ) : (
        <div>
          {/* Top Row Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ borderRadius: 12, height: '100%' }}>
                <Statistic
                  title={<Text type="secondary">Total Project Value (Revenue)</Text>}
                  value={revenue}
                  precision={2}
                  valueStyle={{ color: '#0f766e', fontWeight: 700 }}
                  prefix="₹"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ borderRadius: 12, height: '100%' }}>
                <Statistic
                  title={<Text type="secondary">Actual Cost (Logged Labor)</Text>}
                  value={totalLaborCost}
                  precision={2}
                  valueStyle={{ color: '#dc2626', fontWeight: 700 }}
                  prefix="₹"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ borderRadius: 12, height: '100%' }}>
                <Statistic
                  title={<Text type="secondary">Net Margin (P&L)</Text>}
                  value={Math.abs(profitLoss)}
                  precision={2}
                  valueStyle={{ color: isProfit ? '#16a34a' : '#ef4444', fontWeight: 700 }}
                  prefix={profitLoss < 0 ? "- ₹" : "₹"}
                  suffix={
                    <span style={{ fontSize: '14px', marginLeft: 8 }}>
                      {isProfit ? <ArrowUpOutlined style={{ color: '#16a34a' }} /> : <ArrowDownOutlined style={{ color: '#ef4444' }} />}
                    </span>
                  }
                />
                <Tag color={isProfit ? 'success' : 'error'} style={{ marginTop: 8 }}>
                  {isProfit ? 'PROFIT' : 'LOSS'}
                </Tag>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ borderRadius: 12, height: '100%' }}>
                <Statistic
                  title={<Text type="secondary">Profit Margin %</Text>}
                  value={marginPercentage}
                  precision={1}
                  valueStyle={{ color: isProfit ? '#16a34a' : '#ef4444', fontWeight: 700 }}
                  suffix="%"
                />
                <div style={{ marginTop: 8 }}>
                  <Progress 
                    percent={Math.max(0, Math.min(100, Math.round(marginPercentage)))} 
                    size="small" 
                    status={isProfit ? "success" : "exception"} 
                    showInfo={false}
                  />
                </div>
              </Card>
            </Col>
          </Row>

          <Row gutter={24} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={16}>
              {/* Labor breakdown Table */}
              <Card title={<Space><TeamOutlined /><span>Labor Cost Breakdown by Team Members</span></Space>} style={{ borderRadius: 12 }}>
                <Table
                  dataSource={laborBreakdown}
                  pagination={false}
                  locale={{ emptyText: 'No hours logged by team members yet.' }}
                  columns={[
                    {
                      title: 'Team Member',
                      dataIndex: 'name',
                      key: 'name',
                      render: (text) => <Text strong>{text}</Text>
                    },
                    {
                      title: 'Role',
                      dataIndex: 'role',
                      key: 'role',
                      render: (role) => <Tag color="blue">{role}</Tag>
                    },
                    {
                      title: 'Hours Logged',
                      dataIndex: 'hours',
                      key: 'hours',
                      align: 'right',
                      render: (h) => <Text>{h} hrs</Text>
                    },
                    {
                      title: 'Hourly Cost Rate',
                      dataIndex: 'hourlyRate',
                      key: 'hourlyRate',
                      align: 'right',
                      render: (rate) => <Text>₹{rate.toLocaleString('en-IN')}/hr</Text>
                    },
                    {
                      title: 'Total Expense',
                      dataIndex: 'totalCost',
                      key: 'totalCost',
                      align: 'right',
                      render: (cost) => <Text strong style={{ color: '#b91c1c' }}>₹{cost.toLocaleString('en-IN')}</Text>
                    }
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              {/* Project Status Panel */}
              <Card title={<Space><ProjectOutlined /><span>Project Details</span></Space>} style={{ borderRadius: 12, height: '100%' }}>
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="Project Code">
                    <Text code>{project.code}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Category">
                    <Tag color="cyan">{project.projectCategory || 'N/A'}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Status">
                    <StatusBadge status={project.status} />
                  </Descriptions.Item>
                  <Descriptions.Item label="Hours Consumed">
                    <Text strong>{project.consumedHours || 0} hrs</Text> / {project.approvedHours || 0} hrs
                  </Descriptions.Item>
                  <Descriptions.Item label="Expected Start">
                    {project.startDate ? dayjs(project.startDate).format('DD MMM YYYY') : '-'}
                  </Descriptions.Item>
                </Descriptions>
                <div style={{ marginTop: 24 }}>
                  <Text strong>Project Time Utilization</Text>
                  {(() => {
                    const pct = project.approvedHours > 0 ? Math.round((Number(project.consumedHours) / Number(project.approvedHours)) * 100) : 0;
                    return (
                      <div style={{ marginTop: 8 }}>
                        <Progress percent={pct} strokeColor={pct > 100 ? '#ef4444' : '#1890ff'} />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {pct}% of approved hours utilized
                        </Text>
                      </div>
                    );
                  })()}
                </div>
              </Card>
            </Col>
          </Row>

          {/* Milestones Panel */}
          {project.milestones && project.milestones.length > 0 && (
            <Card title={<Space><CheckCircleOutlined /><span>Milestone Payments & Cost Breakdown</span></Space>} style={{ borderRadius: 12 }}>
              <Table
                dataSource={project.milestones}
                rowKey="title"
                pagination={false}
                columns={[
                  {
                    title: 'Milestone Title',
                    dataIndex: 'title',
                    key: 'title',
                    render: (text) => <Text strong>{text}</Text>
                  },
                  {
                    title: 'Due Date',
                    dataIndex: 'date',
                    key: 'date',
                    render: (date) => date ? dayjs(date).format('DD MMM YYYY') : '-'
                  },
                  {
                    title: 'Target Amount (Revenue)',
                    dataIndex: 'amount',
                    key: 'amount',
                    align: 'right',
                    render: (amt) => <Text style={{ color: '#0f766e', fontWeight: 600 }}>₹{Number(amt || 0).toLocaleString('en-IN')}</Text>
                  },
                  {
                    title: 'Status',
                    dataIndex: 'status',
                    key: 'status',
                    render: (status, record) => {
                      const dynamicStatus = getMilestoneStatus(record.title);
                      let color = 'warning';
                      let label = 'Pending';
                      
                      if (dynamicStatus === 'Completed') {
                        color = 'success';
                        label = 'Completed';
                      } else if (dynamicStatus === 'InProgress') {
                        color = 'processing';
                        label = 'In Progress';
                      }
                      
                      return (
                        <Tag color={color} style={{ borderRadius: 4, fontWeight: 600 }}>
                          {label}
                        </Tag>
                      );
                    }
                  }
                ]}
              />
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfitLossPage;
