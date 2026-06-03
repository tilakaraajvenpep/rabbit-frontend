import React, { useState, useEffect } from 'react';
import { 
  Card, Table, Tag, Space, Typography, notification, Spin, 
  Row, Col, Statistic, DatePicker, Avatar, Tabs, Select, Input, Button
} from 'antd';
import { 
  CheckCircleOutlined, CloseCircleOutlined, UserOutlined, CalendarOutlined,
  SearchOutlined, ClearOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { leaveService } from '../../services/leaveService';
import { adminService } from '../../services/adminService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const combineContinuousLeaves = (leavesList) => {
  if (!leavesList || leavesList.length === 0) return [];

  const groups = {};
  leavesList.forEach(l => {
    const userId = l.userId || l.user?.id || '';
    const key = `${userId}_${l.type}_${l.status}_${l.reason || ''}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(l);
  });

  const combined = [];

  Object.keys(groups).forEach(key => {
    const list = groups[key];
    list.sort((a, b) => dayjs(a.leaveDate).unix() - dayjs(b.leaveDate).unix());

    let currentBlock = null;

    list.forEach(item => {
      const itemDate = dayjs(item.leaveDate);
      
      if (!currentBlock) {
        currentBlock = {
          ...item,
          ids: [item.id || item.leaveId],
          startDate: itemDate,
          endDate: itemDate,
          dates: [item.leaveDate]
        };
      } else {
        const diff = itemDate.diff(currentBlock.endDate, 'day');
        if (diff === 1) {
          currentBlock.endDate = itemDate;
          if (item.id || item.leaveId) {
            currentBlock.ids.push(item.id || item.leaveId);
          }
          currentBlock.dates.push(item.leaveDate);
        } else {
          combined.push(currentBlock);
          currentBlock = {
            ...item,
            ids: [item.id || item.leaveId],
            startDate: itemDate,
            endDate: itemDate,
            dates: [item.leaveDate]
          };
        }
      }
    });

    if (currentBlock) {
      combined.push(currentBlock);
    }
  });

  return combined;
};

const HRViewLeavesPermissionsPage = () => {
  const [leaves, setLeaves] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const { isDarkMode } = useThemeStore();

  // Search & Filter state
  const [dateRange, setDateRange] = useState([dayjs().subtract(1, 'month'), dayjs().add(1, 'month')]);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedPmId, setSelectedPmId] = useState('all');
  const [selectedTlId, setSelectedTlId] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [leavesRes, usersRes] = await Promise.all([
        leaveService.getAllLeaves(),
        adminService.getUsers()
      ]);
      setLeaves(leavesRes.data || []);
      setUsers(usersRes.data || []);
    } catch (e) {
      notification.error({
        message: 'Error',
        description: 'Failed to fetch historical requests.'
      });
    } finally {
      setLoading(false);
    }
  };

  const parsePermissionReason = (reason) => {
    if (!reason) return { duration: 'N/A', cleanReason: '' };
    const match = reason.match(/^\[Permission Duration:\s*([^\]]+)\]\s*-\s*(.*)$/);
    if (match) {
      return {
        duration: match[1],
        cleanReason: match[2]
      };
    }
    return {
      duration: 'N/A',
      cleanReason: reason
    };
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

  const filteredLeavesRaw = leaves.filter(l => {
    const u = users.find(usr => String(usr.id || usr.userId) === String(l.userId || l.user?.id));
    const uName = u ? (u.name || u.fullName || '') : (l.user?.fullName || '');
    const uEmail = u ? (u.email || '') : (l.user?.email || '');
    const matchesSearch = uName.toLowerCase().includes(searchText.toLowerCase()) || uEmail.toLowerCase().includes(searchText.toLowerCase());

    const uRole = u ? u.role : (l.user?.role || 'Employee');
    const matchesRole = roleFilter === 'all' || uRole === roleFilter;

    let matchesPm = true;
    if (selectedPmId !== 'all') {
      const pmIdStr = String(selectedPmId);
      const uPmId = u ? u.projectManagerId : null;
      const uTlId = u ? u.teamLeadId : null;
      const userTl = uTlId ? users.find(t => String(t.id || t.userId) === String(uTlId)) : null;

      const isSelfPm = u && String(u.id || u.userId) === pmIdStr;
      const reportsDirectly = uPmId && String(uPmId) === pmIdStr;
      const isTlReporting = u && u.role === 'TeamLead' && String(u.projectManagerId) === pmIdStr;
      const reportsIndirectly = userTl && String(userTl.projectManagerId) === pmIdStr;

      matchesPm = isSelfPm || reportsDirectly || isTlReporting || reportsIndirectly;
    }

    let matchesTl = true;
    if (selectedTlId !== 'all') {
      const tlIdStr = String(selectedTlId);
      const isSelfTl = u && String(u.id || u.userId) === tlIdStr;
      const reportsToTl = u && u.role === 'Employee' && String(u.teamLeadId) === tlIdStr;
      matchesTl = isSelfTl || reportsToTl;
    }

    let matchesDate = true;
    if (dateRange && dateRange[0] && dateRange[1]) {
      const [start, end] = dateRange;
      const lDate = dayjs(l.leaveDate || l.date);
      matchesDate = (lDate.isAfter(start, 'day') || lDate.isSame(start, 'day')) &&
                    (lDate.isBefore(end, 'day') || lDate.isSame(end, 'day'));
    }

    return matchesSearch && matchesRole && matchesPm && matchesTl && matchesDate;
  });

  const leavesOnly = filteredLeavesRaw.filter(l => l.type !== 'Permission');
  const permissionsOnly = filteredLeavesRaw.filter(l => l.type === 'Permission');

  const combinedLeaves = combineContinuousLeaves(leavesOnly);

  // Focus only on Approved and Rejected requests
  const filteredProcessedLeaves = combinedLeaves
    .filter(l => l.status === 'Approved' || l.status === 'Rejected')
    .sort((a, b) => b.startDate.unix() - a.startDate.unix());

  const filteredProcessedPermissions = permissionsOnly
    .filter(p => p.status === 'Approved' || p.status === 'Rejected')
    .sort((a, b) => dayjs(b.leaveDate).unix() - dayjs(a.leaveDate).unix());

  const resetFilters = () => {
    setSearchText('');
    setRoleFilter('all');
    setSelectedPmId('all');
    setSelectedTlId('all');
    setDateRange([dayjs().subtract(1, 'month'), dayjs().add(1, 'month')]);
  };

  const processedLeaveColumns = [
    {
      title: 'Employee Name',
      dataIndex: ['user', 'fullName'],
      key: 'employeeName',
      render: (name, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: record.status === 'Approved' ? '#87d068' : '#ff4d4f' }} />
          <Space direction="vertical" size={0}>
            <Text strong>{name || record.user?.email || 'N/A'}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{record.user?.email}</Text>
          </Space>
        </Space>
      )
    },
    {
      title: 'Leave Date',
      key: 'leaveDate',
      render: (_, record) => {
        const startStr = record.startDate.format('DD MMM YYYY');
        const endStr = record.endDate.format('DD MMM YYYY');
        const count = record.dates.length;
        if (count > 1) {
          return (
            <Space direction="vertical" size={0}>
              <Text strong style={{ color: '#4f46e5' }}>{`${startStr} - ${endStr}`}</Text>
              <Tag color="purple" style={{ margin: 0, width: 'fit-content' }}>{`${count} continuous days`}</Tag>
            </Space>
          );
        }
        return <Text>{record.startDate.format('DD MMM YYYY (dddd)')}</Text>;
      },
      sorter: (a, b) => a.startDate.unix() - b.startDate.unix(),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color={type === 'FullDay' ? 'indigo' : 'cyan'} style={{ borderRadius: 4 }}>
          {type === 'FullDay' ? 'Full Day' : 'Half Day'}
        </Tag>
      ),
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason) => reason || <Text type="secondary">N/A</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag 
          color={status === 'Approved' ? 'green' : 'red'} 
          icon={status === 'Approved' ? <CheckCircleOutlined /> : <CloseCircleOutlined />} 
          style={{ borderRadius: 4 }}
        >
          {status}
        </Tag>
      )
    }
  ];

  const processedPermissionColumns = [
    {
      title: 'Employee Name',
      dataIndex: ['user', 'fullName'],
      key: 'employeeName',
      render: (name, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: record.status === 'Approved' ? '#87d068' : '#ff4d4f' }} />
          <Space direction="vertical" size={0}>
            <Text strong>{name || record.user?.email || 'N/A'}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{record.user?.email}</Text>
          </Space>
        </Space>
      )
    },
    {
      title: 'Permission Date',
      dataIndex: 'leaveDate',
      key: 'leaveDate',
      render: (date) => dayjs(date).format('DD MMM YYYY (dddd)'),
      sorter: (a, b) => dayjs(a.leaveDate).unix() - dayjs(b.leaveDate).unix()
    },
    {
      title: 'Duration',
      dataIndex: 'reason',
      key: 'duration',
      render: (reason) => {
        const { duration } = parsePermissionReason(reason);
        return <Tag color="purple" style={{ fontWeight: 700 }}>{duration}</Tag>;
      }
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason) => {
        const { cleanReason } = parsePermissionReason(reason);
        return cleanReason || <Text type="secondary">N/A</Text>;
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag 
          color={status === 'Approved' ? 'green' : 'red'} 
          icon={status === 'Approved' ? <CheckCircleOutlined /> : <CloseCircleOutlined />} 
          style={{ borderRadius: 4 }}
        >
          {status}
        </Tag>
      )
    }
  ];

  if (loading && leaves.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  const approvedLeavesCount = leavesOnly.filter(l => l.status === 'Approved').length;
  const approvedPermissionsCount = permissionsOnly.filter(p => p.status === 'Approved').length;

  return (
    <div>
      <PageHeader 
        title="View Leaves & Permissions History" 
        subTitle="Search and review historical employee leave logs and permission requests."
      />

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
              <Statistic 
                title="Approved Leaves" 
                value={approvedLeavesCount} 
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
              <Statistic 
                title="Approved Permissions" 
                value={approvedPermissionsCount} 
                prefix={<CheckCircleOutlined style={{ color: '#8b5cf6' }} />} 
              />
            </Card>
          </Col>
        </Row>

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

        <Card 
          style={{ 
            borderRadius: 12,
            boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(0,0,0,0.05)',
            border: isDarkMode ? '1px solid #3f3f46' : '1px solid #e8e8e8'
          }}
        >

          <Tabs defaultActiveKey="leaves">
            <Tabs.TabPane tab="Leaves History" key="leaves">
              <Table
                dataSource={filteredProcessedLeaves}
                columns={processedLeaveColumns}
                rowKey="leaveId"
                pagination={{ pageSize: 10 }}
                locale={{ emptyText: 'No leave request history matches.' }}
              />
            </Tabs.TabPane>
            
            <Tabs.TabPane tab="Permissions History" key="permissions">
              <Table
                dataSource={filteredProcessedPermissions}
                columns={processedPermissionColumns}
                rowKey="leaveId"
                pagination={{ pageSize: 10 }}
                locale={{ emptyText: 'No permission request history matches.' }}
              />
            </Tabs.TabPane>
          </Tabs>
        </Card>
      </Space>
    </div>
  );
};

export default HRViewLeavesPermissionsPage;
