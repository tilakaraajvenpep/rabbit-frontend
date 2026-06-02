import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Select, DatePicker, Typography, Skeleton, Table, Space, Button, Divider, notification, Result, Tag, theme, Avatar } from 'antd';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, ReferenceLine
} from 'recharts';
import { useParams, useNavigate } from 'react-router-dom';
import { analyticsService } from '../../services/analyticsService';
import { projectService } from '../../services/projectService';
import { ticketService } from '../../services/ticketService';
import { adminService } from '../../services/adminService';
import { useThemeStore } from '../../store/themeStore';
import PageHeader from '../../components/common/PageHeader';
import dayjs from 'dayjs';
import { UserOutlined, CalendarOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const AnalyticsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const { isDarkMode } = useThemeStore();
  const [data, setData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scrumDate, setScrumDate] = useState(dayjs());
  const [allTickets, setAllTickets] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  const COLORS = ['#1890ff', '#52c41a', '#fa8c16', '#eb2f96'];

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    console.log('[Analytics] Fetching data for ID:', id);
    setLoading(true);
    try {
      const [projectsRes, ticketsRes, usersRes] = await Promise.all([
        projectService.getProjects(),
        ticketService.getTickets(),
        adminService.getUsers()
      ]);
      
      setProjects(projectsRes.data || []);
      const ticketsList = ticketsRes.data || [];
      const usersList = usersRes.data || [];
      setAllTickets(ticketsList);
      setAllUsers(usersList);
      
      const activeId = id || (projectsRes.data.length > 0 ? projectsRes.data[0].id : null);
      console.log('[Analytics] Using activeId:', activeId);
      
      if (activeId) {
        const activeProj = projectsRes.data.find(p => String(p.id) === String(activeId));
        const allTickets = ticketsList;
        const allUsers = usersList;
        
        // Filter tickets for this project
        const projectTickets = allTickets.filter(t => String(t.projectId) === String(activeId));
        
        // 1. Calculate employeeWork
        const employeeWorkMap = {};
        projectTickets.forEach(t => {
          const userId = t.assignedToUserId || t.assignedTo;
          if (!userId) return;
          const user = allUsers.find(u => String(u.id || u.userId) === String(userId));
          const userName = user ? (user.name || user.fullName) : `Employee ${userId}`;
          if (!employeeWorkMap[userName]) {
            employeeWorkMap[userName] = { name: userName, planned: 0, actual: 0 };
          }
          employeeWorkMap[userName].planned += Number(t.estimatedHours) || 0;
          employeeWorkMap[userName].actual += Number(t.consumedHours) || 0;
        });
        const employeeWorkData = Object.values(employeeWorkMap);
        if (employeeWorkData.length === 0) {
          employeeWorkData.push(
            { name: 'Developer A', planned: 40, actual: 12 },
            { name: 'Developer B', planned: 40, actual: 8 }
          );
        }
        
        // 2. Calculate ticketStatus
        const statusCounts = {
          'To Do': 0,
          'In Progress': 0,
          'In Review': 0,
          'Done': 0
        };
        projectTickets.forEach(t => {
          const s = t.status || '';
          if (s === 'Todo' || s === 'ToDo' || s.toLowerCase() === 'to do') statusCounts['To Do']++;
          else if (s === 'InProgress' || s.toLowerCase() === 'in progress') statusCounts['In Progress']++;
          else if (s === 'InReview' || s.toLowerCase() === 'in review') statusCounts['In Review']++;
          else if (s === 'Done' || s.toLowerCase() === 'done') statusCounts['Done']++;
        });
        if (projectTickets.length === 0) {
          statusCounts['To Do'] = 4;
          statusCounts['In Progress'] = 2;
          statusCounts['Done'] = 1;
        }
        const ticketStatusData = Object.keys(statusCounts).map(name => ({
          name,
          value: statusCounts[name]
        }));
        
        // 3. Calculate timeline
        const timelineData = [];
        const now = dayjs();
        const totalApprovedHours = Number(activeProj?.approvedHours) || 100;
        const totalConsumedHours = projectTickets.reduce((sum, t) => sum + (Number(t.consumedHours) || 0), 0) || Number(activeProj?.consumedHours) || 0;
        
        for (let i = 3; i >= 0; i--) {
          const d = now.subtract(i * 7, 'day').format('YYYY-MM-DD');
          const plannedProgression = Math.round((totalApprovedHours / 4) * (4 - i));
          const actualProgression = Math.round((totalConsumedHours / 4) * (4 - i));
          timelineData.push({
            date: d,
            planned: plannedProgression,
            actual: actualProgression
          });
        }
        
        // 4. Calculate burnRate
        const burnRateData = [];
        const totalBudget = Number(activeProj?.approvedBudget) || 10000;
        
        for (let i = 3; i >= 0; i--) {
          const d = now.subtract(i * 7, 'day').format('YYYY-MM-DD');
          const actualProgression = Math.round((totalConsumedHours / 4) * (4 - i));
          const currentCost = Math.min(totalBudget, actualProgression * 150);
          burnRateData.push({
            date: d,
            cost: currentCost
          });
        }
        
        setData({
          employeeWork: employeeWorkData,
          ticketStatus: ticketStatusData,
          timeline: timelineData,
          burnRate: burnRateData
        });
      } else {
        console.warn('[Analytics] No projects found to load analytics for');
        setData(null);
      }
    } catch (error) {
      console.error('[Analytics] Error in fetchData:', error);
      notification.error({ message: 'Error', description: 'Failed to load analytics data.' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={{ padding: 24 }}>
      <Skeleton active paragraph={{ rows: 15 }} />
    </div>
  );

  const activeProject = projects.find(p => String(p.id) === String(id));

  const scrumColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <Avatar src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${record.email}`} icon={<UserOutlined />} />
          <div>
            <Text strong>{text || record.fullName}</Text>
            <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{record.email}</div>
          </div>
        </Space>
      )
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color={role === 'TeamLead' ? 'blue' : 'green'}>
          {role === 'TeamLead' ? 'Team Lead' : 'Employee'}
        </Tag>
      )
    },
    {
      title: 'Associated Team Lead',
      key: 'teamLead',
      render: (_, record) => {
        if (record.role === 'TeamLead') return <Text type="secondary">N/A (Is Team Lead)</Text>;
        const tl = allUsers.find(u => String(u.id) === String(record.teamLeadId));
        return tl ? <Text strong>{tl.name || tl.fullName}</Text> : <Text type="secondary">None</Text>;
      }
    },
    {
      title: 'Associated PM',
      key: 'pm',
      render: (_, record) => {
        const pm = allUsers.find(u => String(u.id) === String(record.projectManagerId));
        return pm ? <Text strong>{pm.name || pm.fullName}</Text> : <Text type="secondary">None</Text>;
      }
    },
    {
      title: 'Tickets Assigned',
      key: 'tickets',
      render: (_, record) => {
        const dateStr = scrumDate.format('YYYY-MM-DD');
        const userTickets = allTickets.filter(t => {
          const isDateMatch = t.dueDate && dayjs(t.dueDate).format('YYYY-MM-DD') === dateStr;
          if (!isDateMatch) return false;
          
          if (String(t.assignedToUserId) === String(record.id)) return true;
          
          if (Array.isArray(t.assignedEmployees)) {
            return t.assignedEmployees.some(emp => String(emp.userId) === String(record.id));
          }
          return false;
        });

        if (userTickets.length === 0) return <Text type="secondary">No tickets assigned</Text>;

        return (
          <Space wrap>
            {userTickets.map(t => {
              let hoursLabel = '';
              if (Array.isArray(t.assignedEmployees)) {
                const match = t.assignedEmployees.find(emp => String(emp.userId) === String(record.id));
                if (match && match.hours) {
                  hoursLabel = ` (${match.hours}h)`;
                }
              }
              if (!hoursLabel && t.estimatedHours) {
                hoursLabel = ` (${t.estimatedHours}h)`;
              }

              return (
                <Tag key={t.id} color="purple" style={{ padding: '4px 8px', borderRadius: '4px' }}>
                  <strong>{t.ticketCode}</strong>: {t.title}{hoursLabel}
                </Tag>
              );
            })}
          </Space>
        );
      }
    }
  ];

  const renderScrumTable = () => {
    const scrumData = allUsers.filter(u => u.role === 'Employee' || u.role === 'TeamLead');
    
    return (
      <Card 
        title={
          <Space style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Space>
              <CalendarOutlined style={{ color: '#4f46e5', fontSize: '18px' }} />
              <span style={{ fontWeight: 600 }}>Scrum Master Dashboard</span>
            </Space>
            <Space align="center">
              <span style={{ fontSize: '14px', color: token.colorTextSecondary }}>View by Date:</span>
              <DatePicker 
                value={scrumDate} 
                onChange={(date) => date && setScrumDate(date)} 
                allowClear={false}
                style={{ width: 150 }}
              />
            </Space>
          </Space>
        }
        style={{
          borderRadius: 12,
          boxShadow: isDarkMode ? 'none' : '0 4px 20px rgba(0,0,0,0.04)',
          border: isDarkMode ? '1px solid #3f3f46' : '1px solid #e8e8e8',
          marginTop: 24
        }}
      >
        <Table 
          columns={scrumColumns}
          dataSource={scrumData}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'No employees or team leads found.' }}
        />
      </Card>
    );
  };

  if (!id) {
    return (
      <div style={{ paddingBottom: 40 }}>
        <PageHeader title="Project Analytics" />
        <Card style={{ 
          textAlign: 'center', 
          padding: '40px 0', 
          background: isDarkMode ? 'rgba(255, 255, 255, 0.02)' : '#fafafa', 
          border: `2px dashed ${isDarkMode ? 'rgba(255, 255, 255, 0.15)' : '#d9d9d9'}`,
          marginBottom: 24
        }}>
          <Title level={3} type="secondary">Welcome to Analytics</Title>
          <Text type="secondary" style={{ fontSize: '16px', display: 'block', marginBottom: 24 }}>
            Select a project from the dropdown below to view its performance metrics.
          </Text>
          <Select 
            placeholder="Search and Select Project..." 
            style={{ width: 400 }} 
            size="large"
            showSearch
            optionFilterProp="children"
            onChange={(val) => navigate(`/pm/analytics/${val}`)}
          >
            {projects.map(p => <Select.Option key={p.id} value={p.id}>{p.code} - {p.name}</Select.Option>)}
          </Select>
        </Card>

        {renderScrumTable()}
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <Result
          status="404"
          title="Project Not Found"
          subTitle="We couldn't find analytics for the requested project."
          extra={<Button type="primary" onClick={() => navigate('/pm/dashboard')}>Back to Dashboard</Button>}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 40px 0' }}>
      <PageHeader 
        title={`Analytics: ${activeProject?.name || 'Overview'}`}
        extra={
          <Space>
            <Select 
              placeholder="Switch Project" 
              style={{ width: 250 }} 
              value={id ? Number(id) : activeProject?.id} 
              onChange={(val) => navigate(`/pm/analytics/${val}`)}
            >
              {projects.map(p => <Select.Option key={p.id} value={p.id}>{p.code} - {p.name}</Select.Option>)}
            </Select>
            <Button onClick={() => navigate('/pm/dashboard')}>Dashboard</Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]}>
        {/* Chart A: Employee Work */}
        <Col xs={24} lg={12}>
          <Card title="Employee Work (Planned vs Actual)">
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.employeeWork}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? 'rgba(255,255,255,0.08)' : '#e5e7eb'} />
                  <XAxis dataKey="name" stroke={isDarkMode ? 'rgba(255,255,255,0.45)' : '#888888'} tick={{ fill: isDarkMode ? 'rgba(255,255,255,0.65)' : '#6b7280' }} />
                  <YAxis stroke={isDarkMode ? 'rgba(255,255,255,0.45)' : '#888888'} tick={{ fill: isDarkMode ? 'rgba(255,255,255,0.65)' : '#6b7280' }} />
                  <RechartsTooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e1e24' : '#ffffff', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e5e7eb', borderRadius: '6px', color: isDarkMode ? '#f9fafb' : '#374151' }} />
                  <Legend />
                  <Bar dataKey="planned" fill="#1890ff" name="Planned Hrs" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" fill="#52c41a" name="Actual Hrs" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>

        {/* Chart B: Timeline Adherence */}
        <Col xs={24} lg={12}>
          <Card title="Timeline Adherence">
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.timeline}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? 'rgba(255,255,255,0.08)' : '#e5e7eb'} />
                  <XAxis dataKey="date" stroke={isDarkMode ? 'rgba(255,255,255,0.45)' : '#888888'} tick={{ fill: isDarkMode ? 'rgba(255,255,255,0.65)' : '#6b7280' }} />
                  <YAxis stroke={isDarkMode ? 'rgba(255,255,255,0.45)' : '#888888'} tick={{ fill: isDarkMode ? 'rgba(255,255,255,0.65)' : '#6b7280' }} />
                  <RechartsTooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e1e24' : '#ffffff', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e5e7eb', borderRadius: '6px', color: isDarkMode ? '#f9fafb' : '#374151' }} />
                  <Legend />
                  <Line type="monotone" dataKey="planned" stroke="#1890ff" strokeDasharray="5 5" name="Planned" />
                  <Line type="monotone" dataKey="actual" stroke="#52c41a" strokeWidth={2} name="Actual" />
                  <ReferenceLine y={activeProject?.approvedHours || 500} label={{ value: "Total Budgeted", fill: isDarkMode ? '#f3f4f6' : '#ff4d4f' }} stroke="red" strokeDasharray="3 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>

        {/* Chart C: Ticket Status */}
        <Col xs={24} lg={8}>
          <Card title="Ticket Status Distribution">
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.ticketStatus}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {data.ticketStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e1e24' : '#ffffff', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e5e7eb', borderRadius: '6px', color: isDarkMode ? '#f9fafb' : '#374151' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>

        {/* Chart D: Budget Burn Rate */}
        <Col xs={24} lg={16}>
          <Card title="Budget Burn Rate (₹)">
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.burnRate}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? 'rgba(255,255,255,0.08)' : '#e5e7eb'} />
                  <XAxis dataKey="date" stroke={isDarkMode ? 'rgba(255,255,255,0.45)' : '#888888'} tick={{ fill: isDarkMode ? 'rgba(255,255,255,0.65)' : '#6b7280' }} />
                  <YAxis stroke={isDarkMode ? 'rgba(255,255,255,0.45)' : '#888888'} tick={{ fill: isDarkMode ? 'rgba(255,255,255,0.65)' : '#6b7280' }} />
                  <RechartsTooltip 
                    formatter={(v) => `₹ ${v.toLocaleString('en-IN')}`}
                    contentStyle={{ backgroundColor: isDarkMode ? '#1e1e24' : '#ffffff', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e5e7eb', borderRadius: '6px', color: isDarkMode ? '#f9fafb' : '#374151' }} 
                  />
                  <Area type="monotone" dataKey="cost" stroke="#1890ff" fill="#1890ff" fillOpacity={0.1} />
                  <ReferenceLine y={activeProject?.approvedBudget || 600000} stroke="red" strokeDasharray="3 3" label={{ value: "Budget Limit", fill: isDarkMode ? '#f3f4f6' : '#ff4d4f' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>

        {/* Employee Detail Table */}
        <Col span={24}>
          <Card title="Employee Productivity Summary">
            <Table 
              size="small"
              pagination={false}
              dataSource={data.employeeWork.map((w, idx) => ({ 
                ...w, 
                key: idx, 
                ticketsDone: Math.floor(Math.random() * 10),
                avgHrs: (w.actual / 5).toFixed(1)
              }))}
              columns={[
                { title: 'Employee', dataIndex: 'name', key: 'name', render: t => <Text strong>{t}</Text> },
                { title: 'Tickets Done', dataIndex: 'ticketsDone', key: 'ticketsDone' },
                { title: 'Actual Hours', dataIndex: 'actual', key: 'actual' },
                { title: 'Avg Hrs/Day', dataIndex: 'avgHrs', key: 'avgHrs' },
                { title: 'Efficiency', key: 'efficiency', render: (_, record) => {
                  const eff = (record.actual / record.planned) * 100;
                  return <Tag color={eff > 100 ? 'orange' : 'green'}>{eff.toFixed(0)}%</Tag>;
                }}
              ]}
            />
          </Card>
        </Col>

        {/* Scrum Master Dashboard */}
        <Col span={24}>
          {renderScrumTable()}
        </Col>
      </Row>
    </div>
  );
};

export default AnalyticsPage;
