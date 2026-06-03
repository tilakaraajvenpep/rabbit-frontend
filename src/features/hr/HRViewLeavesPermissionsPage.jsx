import React, { useState, useEffect } from 'react';
import { 
  Card, Table, Tag, Space, Typography, notification, Spin, 
  Row, Col, Statistic, DatePicker, Avatar
} from 'antd';
import { 
  CheckCircleOutlined, CloseCircleOutlined, UserOutlined, CalendarOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { leaveService } from '../../services/leaveService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Text } = Typography;

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
  const [loading, setLoading] = useState(false);
  const [filterRange, setFilterRange] = useState(null);
  const { isDarkMode } = useThemeStore();

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await leaveService.getAllLeaves();
      setLeaves(res.data || []);
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

  const leavesOnly = leaves.filter(l => l.type !== 'Permission');
  const permissionsOnly = leaves.filter(l => l.type === 'Permission');

  const combinedLeaves = combineContinuousLeaves(leavesOnly);

  // Focus only on Approved and Rejected requests
  const processedLeaves = combinedLeaves
    .filter(l => l.status === 'Approved' || l.status === 'Rejected')
    .sort((a, b) => b.startDate.unix() - a.startDate.unix());

  const processedPermissions = permissionsOnly
    .filter(p => p.status === 'Approved' || p.status === 'Rejected')
    .sort((a, b) => dayjs(b.leaveDate).unix() - dayjs(a.leaveDate).unix());

  // Filter processed leaves by range
  const filteredProcessedLeaves = processedLeaves.filter(l => {
    if (!filterRange || filterRange.length < 2 || !filterRange[0] || !filterRange[1]) return true;
    const filterStart = filterRange[0].startOf('day');
    const filterEnd = filterRange[1].endOf('day');
    return (l.startDate.isAfter(filterStart) || l.startDate.isSame(filterStart, 'day')) &&
           (l.endDate.isBefore(filterEnd) || l.endDate.isSame(filterEnd, 'day'));
  });

  // Filter processed permissions by range
  const filteredProcessedPermissions = processedPermissions.filter(p => {
    if (!filterRange || filterRange.length < 2 || !filterRange[0] || !filterRange[1]) return true;
    const filterStart = filterRange[0].startOf('day');
    const filterEnd = filterRange[1].endOf('day');
    const pDate = dayjs(p.leaveDate);
    return (pDate.isAfter(filterStart) || pDate.isSame(filterStart, 'day')) &&
           (pDate.isBefore(filterEnd) || pDate.isSame(filterEnd, 'day'));
  });

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

        <Card 
          style={{ 
            borderRadius: 12,
            boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(0,0,0,0.05)',
            border: isDarkMode ? '1px solid #3f3f46' : '1px solid #e8e8e8'
          }}
        >
          <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <Text strong>Global History Date Range Filter:</Text>
            <DatePicker.RangePicker
              style={{ width: 300 }}
              value={filterRange}
              onChange={setFilterRange}
              allowClear
            />
          </div>

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
