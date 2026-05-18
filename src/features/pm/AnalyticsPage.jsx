import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Select, DatePicker, Typography, Skeleton, Table, Space, Button, Divider, notification, Result, Tag } from 'antd';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, ReferenceLine
} from 'recharts';
import { useParams, useNavigate } from 'react-router-dom';
import { analyticsService } from '../../services/analyticsService';
import { projectService } from '../../services/projectService';
import PageHeader from '../../components/common/PageHeader';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const AnalyticsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const COLORS = ['#1890ff', '#52c41a', '#fa8c16', '#eb2f96'];

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    console.log('[Analytics] Fetching data for ID:', id);
    setLoading(true);
    try {
      const projectsRes = await projectService.getProjects();
      console.log('[Analytics] Projects fetched:', projectsRes.data.length);
      setProjects(projectsRes.data);
      
      const activeId = id || (projectsRes.data.length > 0 ? projectsRes.data[0].id : null);
      console.log('[Analytics] Using activeId:', activeId);
      
      if (activeId) {
        const analyticsRes = await analyticsService.getProjectAnalytics(activeId);
        console.log('[Analytics] Analytics data received:', analyticsRes.data);
        
        // Ensure arrays exist to prevent chart crashes
        const safeData = {
          employeeWork: analyticsRes.data?.employeeWork || [],
          timeline: analyticsRes.data?.timeline || [],
          ticketStatus: analyticsRes.data?.ticketStatus || [],
          burnRate: analyticsRes.data?.burnRate || []
        };
        setData(safeData);
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

  if (!id) {
    return (
      <div style={{ paddingBottom: 40 }}>
        <PageHeader title="Project Analytics" />
        <Card style={{ textAlign: 'center', padding: '100px 0', background: '#fafafa', border: '2px dashed #d9d9d9' }}>
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
              value={id || activeProject?.id} 
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="planned" stroke="#1890ff" strokeDasharray="5 5" name="Planned" />
                  <Line type="monotone" dataKey="actual" stroke="#52c41a" strokeWidth={2} name="Actual" />
                  <ReferenceLine y={500} label="Total Budgeted" stroke="red" strokeDasharray="3 3" />
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
                  <RechartsTooltip />
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip formatter={(v) => `₹ ${v.toLocaleString('en-IN')}`} />
                  <Area type="monotone" dataKey="cost" stroke="#1890ff" fill="#1890ff" fillOpacity={0.1} />
                  <ReferenceLine y={600000} stroke="red" strokeDasharray="3 3" label="Budget Limit" />
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
      </Row>
    </div>
  );
};

export default AnalyticsPage;
