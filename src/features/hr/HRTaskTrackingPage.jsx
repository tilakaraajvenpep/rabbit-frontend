import React, { useState, useEffect } from 'react';
import { 
  Card, Row, Col, Table, Avatar, Badge, Spin, Typography, Space, 
  DatePicker, Select, Input, Tag, Tooltip, Empty, Alert
} from 'antd';
import { 
  UserOutlined, SearchOutlined, CalendarOutlined, 
  WarningOutlined, CloseCircleOutlined, CheckCircleOutlined 
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminService } from '../../services/adminService';
import { reportService } from '../../services/reportService';
import { leaveService } from '../../services/leaveService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Title, Text } = Typography;

const HRTaskTrackingPage = () => {
  const { isDarkMode } = useThemeStore();
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [loading, setLoading] = useState(true);
  
  // Search & Filter state
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const dateStr = selectedDate.format('YYYY-MM-DD');
      const [usersRes, reportsRes, leavesRes] = await Promise.all([
        adminService.getUsers(),
        reportService.getAllReportsByRange(dateStr, dateStr),
        leaveService.getAllLeaves()
      ]);
      setUsers(usersRes.data || []);
      setReports(reportsRes.data || []);
      setLeaves(leavesRes.data || []);
    } catch (error) {
      console.error('Failed to fetch missing tasks data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 1. Filter out only Employee, TeamLead, and ProjectManager
  const trackableUsers = users.filter(u => 
    u.role === 'Employee' || u.role === 'TeamLead' || u.role === 'ProjectManager'
  );

  // 2. Identify missing / short-reported users
  const missingTasksData = trackableUsers.map(user => {
    // Find daily report for this user
    // The backend / mock report structure may have userId as string or number
    const userReport = reports.find(r => String(r.userId || r.user?.id) === String(user.id || user.userId));
    
    // Sum total logged minutes
    let totalMinutes = 0;
    if (userReport && userReport.items) {
      userReport.items.forEach(item => {
        const hrs = Number(item.hoursInput) || 0;
        const mins = Number(item.minutesInput) || 0;
        totalMinutes += (hrs * 60) + mins;
      });
    }

    // Determine status
    // Missing task / Short report criteria: < 8 hours 30 mins (510 minutes)
    const isMissing = totalMinutes < 510;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    // Find Team Leader Name (if Employee)
    let teamLeaderName = 'N/A';
    if (user.role === 'Employee' && user.teamLeadId) {
      const tl = users.find(u => String(u.id || u.userId) === String(user.teamLeadId));
      if (tl) {
        teamLeaderName = tl.name || tl.fullName || 'Unassigned';
      }
    }

    // Find if they applied for leave or permission for that day
    const dateStr = selectedDate.format('YYYY-MM-DD');
    const userLeaves = leaves.filter(l => 
      String(l.userId || l.user?.id) === String(user.id || user.userId) &&
      dayjs(l.leaveDate).format('YYYY-MM-DD') === dateStr &&
      l.status !== 'Rejected'
    );
    const matchedLeave = userLeaves.find(l => l.status === 'Approved') || userLeaves.find(l => l.status === 'Pending') || null;

    return {
      key: user.id || user.userId,
      user,
      name: user.name || user.fullName,
      role: user.role,
      teamLeaderName,
      totalMinutes,
      hours,
      minutes,
      isMissing,
      reportItems: userReport?.items || [],
      submittedAt: userReport?.submittedAt || null,
      matchedLeave
    };
  }).filter(item => item.isMissing); // Only keep users who missed or short-reported

  // Apply search text and role filters on the missing items
  const filteredMissingData = missingTasksData.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchText.toLowerCase()) ||
                          (item.user.email || '').toLowerCase().includes(searchText.toLowerCase());
    const matchesRole = roleFilter === 'all' || item.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <Avatar src={record.user.avatar} icon={<UserOutlined />} />
          <div>
            <Text strong style={{ fontSize: '14px' }}>{text}</Text>
            <div style={{ fontSize: '11px', color: '#8c8c8c' }}>{record.user.email}</div>
          </div>
        </Space>
      )
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 140,
      render: (role) => {
        let color = 'blue';
        if (role === 'TeamLead') color = 'purple';
        if (role === 'ProjectManager') color = 'orange';
        return <Tag color={color} style={{ fontWeight: 600, borderRadius: 4 }}>{role}</Tag>;
      }
    },
    {
      title: 'Team Leader',
      dataIndex: 'teamLeaderName',
      key: 'teamLeaderName',
      width: 180,
      render: (tlName, record) => {
        if (record.role !== 'Employee') {
          return <span style={{ color: '#8c8c8c', fontStyle: 'italic' }}>N/A (Management)</span>;
        }
        return <Text strong>{tlName}</Text>;
      }
    },
    {
      title: 'Hours Logged',
      key: 'hoursLogged',
      width: 160,
      render: (_, record) => {
        const timeStr = `${record.hours}h ${record.minutes}m`;
        return (
          <span style={{ fontWeight: 700, color: record.totalMinutes === 0 ? '#ef4444' : '#f59e0b' }}>
            {record.totalMinutes === 0 ? 'None' : timeStr}
          </span>
        );
      }
    },
    {
      title: 'Status',
      key: 'status',
      width: 240,
      render: (_, record) => {
        const tags = [];
        
        if (record.totalMinutes === 0) {
          tags.push(
            <Tag key="report-status" color="error" icon={<CloseCircleOutlined />} style={{ padding: '4px 8px', borderRadius: 6, fontWeight: 600, margin: 0 }}>
              Not Reported
            </Tag>
          );
        } else {
          tags.push(
            <Tag key="report-status" color="warning" icon={<WarningOutlined />} style={{ padding: '4px 8px', borderRadius: 6, fontWeight: 600, margin: 0 }}>
              Short Logged (&lt; 8h 30m)
            </Tag>
          );
        }

        if (record.matchedLeave) {
          const { type, status, reason } = record.matchedLeave;
          let label = 'Leave';
          let color = 'purple';
          
          if (type === 'Permission') {
            label = 'Permission';
            color = 'cyan';
          } else if (type === 'HalfDay') {
            label = 'Half Day Leave';
            color = 'blue';
          } else if (type === 'FullDay') {
            label = 'Full Day Leave';
            color = 'indigo';
          }

          tags.push(
            <Tooltip key="leave-status" title={reason ? `Reason: ${reason}` : 'No reason provided'}>
              <Tag color={color} style={{ padding: '4px 8px', borderRadius: 6, fontWeight: 600, margin: 0, cursor: 'help' }}>
                {label} ({status})
              </Tag>
            </Tooltip>
          );
        }

        return <Space direction="vertical" size={6} style={{ width: '100%' }}>{tags}</Space>;
      }
    },
    {
      title: 'Work Summary',
      key: 'summary',
      render: (_, record) => {
        if (record.reportItems.length === 0) {
          return <span style={{ color: '#8c8c8c', fontSize: '12px' }}>No daily report submitted.</span>;
        }
        return (
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: '12px', color: isDarkMode ? '#cbd5e1' : '#4b5563' }}>
            {record.reportItems.map((item, idx) => (
              <li key={idx}>
                <strong>{item.hoursInput}h {item.minutesInput}m</strong> - {item.workDone || 'No description provided'}
              </li>
            ))}
          </ul>
        );
      }
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader 
        title="Missing Tasks" 
        subTitle="Identify Employees, Team Leaders, and PMs who have not submitted daily reports or submitted under 8 hours and 30 minutes."
      />

      <Alert
        message={<Text strong style={{ fontSize: '14px' }}>📋 Daily Log Compliance Rules</Text>}
        description="All Employees, Team Leaders, and Project Managers must log a minimum of 8 hours and 30 minutes every work day. This board tracks exceptions and missing timesheets for the selected date."
        type="info"
        showIcon
        style={{ borderRadius: 8 }}
      />

      {/* Date & Filter Toolbar */}
      <Card 
        style={{ 
          borderRadius: 12, 
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
          background: isDarkMode ? '#1f2937' : '#ffffff',
          border: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb'
        }}
      >
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={6}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Select Log Date:</span>
              <DatePicker 
                value={selectedDate} 
                onChange={(date) => date && setSelectedDate(date)} 
                format="YYYY-MM-DD"
                allowClear={false}
                style={{ width: '100%', height: 40, borderRadius: 8 }}
              />
            </Space>
          </Col>
          <Col xs={24} md={10}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Search by Name or Email:</span>
              <Input 
                placeholder="Search team member..." 
                value={searchText} 
                onChange={e => setSearchText(e.target.value)}
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                allowClear
                style={{ height: 40, borderRadius: 8 }}
              />
            </Space>
          </Col>
          <Col xs={24} md={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Filter by Role:</span>
              <Select
                value={roleFilter}
                onChange={setRoleFilter}
                style={{ width: '100%', height: 40 }}
                options={[
                  { label: 'All Roles (Employee, TL, PM)', value: 'all' },
                  { label: 'Employee Only', value: 'Employee' },
                  { label: 'Team Lead Only', value: 'TeamLead' },
                  { label: 'Project Manager Only', value: 'ProjectManager' },
                ]}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Main Table */}
      <Card
        style={{ 
          borderRadius: 16, 
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)',
          background: isDarkMode ? '#1f2937' : '#ffffff',
          border: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb'
        }}
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
            Log Delinquency List ({filteredMissingData.length} Members flagged)
          </Title>
          <Tag color="red" style={{ fontWeight: 700, borderRadius: 12, padding: '4px 12px', fontSize: '12px' }}>
            Delinquent Date: {selectedDate.format('DD MMM YYYY')}
          </Tag>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 12, color: '#8c8c8c' }}>Analyzing log compliance entries...</div>
          </div>
        ) : (
          <Table 
            columns={columns} 
            dataSource={filteredMissingData} 
            pagination={{ pageSize: 10, showSizeChanger: true }}
            bordered
            locale={{ 
              emptyText: <Empty description="Excellent! No team members are missing or short-reported for this date." /> 
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default HRTaskTrackingPage;
