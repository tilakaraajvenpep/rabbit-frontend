import React, { useState, useEffect } from 'react';
import { 
  Card, Row, Col, Table, Avatar, Badge, Spin, Typography, Space, 
  DatePicker, Select, Input, Tag, Tooltip, Empty, Alert, Button
} from 'antd';
import { 
  UserOutlined, SearchOutlined, CalendarOutlined, 
  WarningOutlined, CloseCircleOutlined, CheckCircleOutlined, ClearOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminService } from '../../services/adminService';
import { reportService } from '../../services/reportService';
import { leaveService } from '../../services/leaveService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const HRTaskTrackingPage = () => {
  const { isDarkMode } = useThemeStore();
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [dateRange, setDateRange] = useState([dayjs().subtract(6, 'days'), dayjs()]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter state
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedPmId, setSelectedPmId] = useState('all');
  const [selectedTlId, setSelectedTlId] = useState('all');

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [start, end] = dateRange;
      const startStr = start.format('YYYY-MM-DD');
      const endStr = end.format('YYYY-MM-DD');
      const [usersRes, reportsRes, leavesRes] = await Promise.all([
        adminService.getUsers(),
        reportService.getAllReportsByRange(startStr, endStr),
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

  // List of PMs and TLs for filter dropdowns
  const pmsList = users.filter(u => u.role === 'ProjectManager' || u.role === 'TenantAdmin');
  
  // Filter TL options based on selected PM (if any)
  const tlsList = users.filter(u => {
    if (u.role !== 'TeamLead') return false;
    if (selectedPmId !== 'all') {
      return String(u.projectManagerId) === String(selectedPmId);
    }
    return true;
  });

  // Trackable users filtered by PM and TL selections
  let trackableUsers = users.filter(u => 
    u.role === 'Employee' || u.role === 'TeamLead' || u.role === 'ProjectManager'
  );

  // Apply Project Manager filter
  if (selectedPmId !== 'all') {
    trackableUsers = trackableUsers.filter(u => {
      // PM themselves
      if (String(u.id || u.userId) === String(selectedPmId)) return true;
      // TL reporting to PM
      if (u.role === 'TeamLead' && String(u.projectManagerId) === String(selectedPmId)) return true;
      // Employee reporting to PM directly
      if (u.role === 'Employee' && String(u.projectManagerId) === String(selectedPmId)) return true;
      // Employee reporting to TL who reports to PM
      if (u.role === 'Employee' && u.teamLeadId) {
        const userTl = users.find(t => String(t.id || t.userId) === String(u.teamLeadId));
        if (userTl && String(userTl.projectManagerId) === String(selectedPmId)) return true;
      }
      return false;
    });
  }

  // Apply Team Leader filter
  if (selectedTlId !== 'all') {
    trackableUsers = trackableUsers.filter(u => {
      // TL themselves
      if (String(u.id || u.userId) === String(selectedTlId)) return true;
      // Employee reporting to TL
      if (u.role === 'Employee' && String(u.teamLeadId) === String(selectedTlId)) return true;
      return false;
    });
  }

  // Generate weekday dates in the selected range
  const [start, end] = dateRange;
  const datesInRange = [];
  let current = dayjs(start);
  while (current.isBefore(end) || current.isSame(end, 'day')) {
    const dayOfWeek = current.day();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclude Sunday (0) and Saturday (6)
      datesInRange.push(current.format('YYYY-MM-DD'));
    }
    current = current.add(1, 'day');
  }

  // Identify missing / short-reported dates for each user
  const missingTasksData = trackableUsers.map(user => {
    const userReports = reports.filter(r => String(r.userId || r.user?.id) === String(user.id || user.userId));
    
    const unreportedDates = [];
    const shortLoggedDates = [];

    datesInRange.forEach(dateStr => {
      // Find all approved leaves for this user on this date
      const userApprovedLeavesForDate = leaves.filter(l => {
        const lUserId = l.userId || l.user?.id;
        const lDate = dayjs(l.leaveDate || l.date).format('YYYY-MM-DD');
        return String(lUserId) === String(user.id || user.userId) && lDate === dateStr && l.status === 'Approved';
      });

      let requiredMinutes = 510; // default 8h 30m (510 minutes)
      let isFullDayLeave = false;
      let isHalfDayLeave = false;
      let permissionDurationLabel = '';

      userApprovedLeavesForDate.forEach(l => {
        if (l.type === 'FullDay') {
          isFullDayLeave = true;
        } else if (l.type === 'HalfDay') {
          isHalfDayLeave = true;
        } else if (l.type === 'Permission') {
          const duration = l.permissionDuration || '';
          let durMins = 120; // default 2 hours (120 minutes)
          if (duration.includes('hr')) {
            durMins = Math.round((parseFloat(duration) || 0) * 60);
          } else if (duration.includes('min')) {
            durMins = Math.round(parseFloat(duration) || 0);
          }
          requiredMinutes -= durMins;
          permissionDurationLabel = duration || '2 hrs';
        }
      });

      if (isFullDayLeave) {
        requiredMinutes = 0;
      } else if (isHalfDayLeave) {
        requiredMinutes = 255; // 4 hours 15 minutes
      }

      // If requiredMinutes is 0 or less, they don't need to report
      if (requiredMinutes <= 0) {
        return;
      }

      // Check if user has a daily report for this date
      const reportForDate = userReports.find(r => {
        const rDate = r.reportDate || r.date;
        return rDate && dayjs(rDate).format('YYYY-MM-DD') === dateStr;
      });

      if (!reportForDate) {
        unreportedDates.push({ date: dateStr, requiredMinutes });
      } else {
        // Sum total logged minutes for this date
        let totalMinutes = 0;
        if (reportForDate.items) {
          reportForDate.items.forEach(item => {
            const decimalHrs = Number(item.hoursSpent || item.hours || item.hoursInput || 0);
            const minsVal = Number(item.minutesInput || 0);
            totalMinutes += Math.round(decimalHrs * 60) + minsVal;
          });
        }
        if (totalMinutes < requiredMinutes) {
          shortLoggedDates.push({ 
            date: dateStr, 
            minutes: totalMinutes, 
            requiredMinutes,
            isHalfDayLeave,
            permissionDurationLabel
          });
        }
      }
    });

    const isMissing = unreportedDates.length > 0 || shortLoggedDates.length > 0;
    
    // Find Team Leader Name
    let teamLeaderName = 'Unassigned';
    if (user.role === 'Employee') {
      if (user.teamLeadId) {
        const tl = users.find(u => String(u.id || u.userId) === String(user.teamLeadId));
        if (tl) {
          teamLeaderName = tl.name || tl.fullName || 'Unassigned';
        }
      }
    } else {
      teamLeaderName = 'N/A';
    }

    // Find Project Manager Name
    let projectManagerName = 'Unassigned';
    if (user.role === 'Employee') {
      if (user.projectManagerId) {
        const pm = users.find(u => String(u.id || u.userId) === String(user.projectManagerId));
        if (pm) {
          projectManagerName = pm.name || pm.fullName || 'Unassigned';
        }
      } else if (user.teamLeadId) {
        const tl = users.find(u => String(u.id || u.userId) === String(user.teamLeadId));
        if (tl && tl.projectManagerId) {
          const pm = users.find(u => String(u.id || u.userId) === String(tl.projectManagerId));
          if (pm) {
            projectManagerName = pm.name || pm.fullName || 'Unassigned';
          }
        }
      }
    } else if (user.role === 'TeamLead') {
      if (user.projectManagerId) {
        const pm = users.find(u => String(u.id || u.userId) === String(user.projectManagerId));
        if (pm) {
          projectManagerName = pm.name || pm.fullName || 'Unassigned';
        }
      }
    } else {
      projectManagerName = 'Self';
    }

    return {
      key: user.id || user.userId,
      user,
      name: user.name || user.fullName,
      role: user.role,
      teamLeaderName,
      projectManagerName,
      unreportedDates,
      shortLoggedDates,
      isMissing
    };
  }).filter(item => item.isMissing);

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
      width: 130,
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
      width: 150,
      render: (tlName, record) => {
        if (record.role !== 'Employee') {
          return <span style={{ color: '#8c8c8c', fontStyle: 'italic' }}>N/A</span>;
        }
        return <Text strong>{tlName}</Text>;
      }
    },
    {
      title: 'Project Manager',
      dataIndex: 'projectManagerName',
      key: 'projectManagerName',
      width: 150,
      render: (pmName, record) => {
        if (record.role === 'ProjectManager' || record.role === 'TenantAdmin') {
          return <span style={{ color: '#8c8c8c', fontStyle: 'italic' }}>Self</span>;
        }
        return <Text strong style={{ color: '#1e40af' }}>{pmName}</Text>;
      }
    },
    {
      title: 'Unreported Dates',
      key: 'unreportedDates',
      render: (_, record) => {
        if (record.unreportedDates.length === 0) {
          return <Tag color="success">None</Tag>;
        }
        return (
          <Space wrap size={[4, 8]}>
            {record.unreportedDates.map(item => {
              const reqH = Math.floor(item.requiredMinutes / 60);
              const reqM = item.requiredMinutes % 60;
              let typeLabel = '';
              if (item.requiredMinutes === 255) {
                typeLabel = ' (Half Day)';
              } else if (item.requiredMinutes < 510) {
                typeLabel = ` (Permission: -${510 - item.requiredMinutes}m)`;
              }
              return (
                <Tooltip key={item.date} title={`Required: ${reqH}h ${reqM}m${typeLabel}`}>
                  <Tag color="error" style={{ borderRadius: 6, fontWeight: 600, cursor: 'help' }}>
                    {dayjs(item.date).format('DD MMM')}
                  </Tag>
                </Tooltip>
              );
            })}
          </Space>
        );
      }
    },
    {
      title: 'Short Logged Dates',
      key: 'shortLoggedDates',
      render: (_, record) => {
        if (record.shortLoggedDates.length === 0) {
          return <Tag color="success">None</Tag>;
        }
        return (
          <Space wrap size={[4, 8]}>
            {record.shortLoggedDates.map(item => {
              const h = Math.floor(item.minutes / 60);
              const m = item.minutes % 60;
              const reqH = Math.floor(item.requiredMinutes / 60);
              const reqM = item.requiredMinutes % 60;
              
              let typeLabel = '';
              if (item.requiredMinutes === 255) {
                typeLabel = ' (Half Day)';
              } else if (item.requiredMinutes < 510) {
                typeLabel = ` (Permission: -${510 - item.requiredMinutes}m)`;
              }

              return (
                <Tooltip key={item.date} title={`Logged: ${h}h ${m}m (Requirement: ${reqH}h ${reqM}m${typeLabel})`}>
                  <Tag color="warning" style={{ borderRadius: 6, fontWeight: 600, cursor: 'help' }}>
                    {dayjs(item.date).format('DD MMM')} ({h}h {m}m / {reqH}h {reqM}m)
                  </Tag>
                </Tooltip>
              );
            })}
          </Space>
        );
      }
    }
  ];

  const resetFilters = () => {
    setSearchText('');
    setRoleFilter('all');
    setSelectedPmId('all');
    setSelectedTlId('all');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader 
        title="Missing Tasks" 
        subTitle="Identify Employees, Team Leaders, and PMs who have not submitted daily reports or submitted under 8 hours and 30 minutes."
      />

      <Alert
        message={<Text strong style={{ fontSize: '14px' }}>📋 Daily Log Compliance Rules</Text>}
        description="All Employees, Team Leaders, and Project Managers must log a minimum of 8 hours and 30 minutes every work day. This board tracks exceptions and missing timesheets for the selected date range."
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
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Select Date Range:</span>
              <RangePicker 
                value={dateRange} 
                onChange={(dates) => dates && setDateRange(dates)} 
                format="YYYY-MM-DD"
                allowClear={false}
                style={{ width: '100%', height: 40, borderRadius: 8 }}
              />
            </Space>
          </Col>
          <Col xs={24} md={6}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Project Manager Filter:</span>
              <Select
                allowClear
                value={selectedPmId === 'all' ? null : selectedPmId}
                onChange={(val) => {
                  setSelectedPmId(val || 'all');
                  setSelectedTlId('all'); // Reset TL when PM changes
                }}
                style={{ width: '100%', height: 40 }}
                placeholder="All PMs"
                options={pmsList.map(pm => ({ label: pm.name || pm.fullName, value: pm.id || pm.userId }))}
              />
            </Space>
          </Col>
          <Col xs={24} md={6}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Team Leader Filter:</span>
              <Select
                allowClear
                value={selectedTlId === 'all' ? null : selectedTlId}
                onChange={(val) => setSelectedTlId(val || 'all')}
                style={{ width: '100%', height: 40 }}
                placeholder="All Team Leads"
                options={tlsList.map(tl => ({ label: tl.name || tl.fullName, value: tl.id || tl.userId }))}
              />
            </Space>
          </Col>
          <Col xs={24} md={6}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Search Team Member:</span>
              <Input 
                placeholder="Search by name/email..." 
                value={searchText} 
                onChange={e => setSearchText(e.target.value)}
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                allowClear
                style={{ height: 40, borderRadius: 8 }}
              />
            </Space>
          </Col>
          <Col xs={24} md={18}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Filter by Role:</span>
              <Select
                allowClear
                value={roleFilter === 'all' ? null : roleFilter}
                onChange={(val) => setRoleFilter(val || 'all')}
                style={{ width: '100%', height: 40 }}
                placeholder="All Roles (Employee, TL, PM)"
                options={[
                  { label: 'Employee Only', value: 'Employee' },
                  { label: 'Team Lead Only', value: 'TeamLead' },
                  { label: 'Project Manager Only', value: 'ProjectManager' },
                ]}
              />
            </Space>
          </Col>
          <Col xs={24} md={6} style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingTop: 20 }}>
            <Button 
              block
              type="primary"
              danger
              icon={<ClearOutlined />} 
              onClick={resetFilters}
              style={{ height: 40, borderRadius: 8, fontWeight: 600 }}
            >
              Cancel Filters
            </Button>
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
            Range: {start.format('DD MMM')} - {end.format('DD MMM YYYY')}
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
              emptyText: <Empty description="Excellent! No team members have missing or short-reported tasks in this date range." /> 
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default HRTaskTrackingPage;
