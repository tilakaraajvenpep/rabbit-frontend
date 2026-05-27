import React, { useState, useEffect } from 'react';
import { 
  Card, Table, Tag, Space, Typography, notification, Spin, 
  Row, Col, Statistic, Select, Button, Tabs, Tooltip, Popconfirm, Avatar
} from 'antd';
import { 
  CalendarOutlined, CheckCircleOutlined, InfoCircleOutlined, 
  UserOutlined, CloseCircleOutlined, HourglassOutlined, CheckOutlined, CloseOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { leaveService } from '../../services/leaveService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Text } = Typography;

const HRApprovedLeavesPage = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
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
        description: 'Failed to fetch leave requests.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await leaveService.updateLeaveStatus(id, newStatus);
      notification.success({
        message: 'Status Updated',
        description: `Successfully marked leave as ${newStatus}.`
      });
      fetchLeaves();
    } catch (e) {
      notification.error({
        message: 'Update Failed',
        description: `Could not update leave request status.`
      });
    }
  };

  const handleBulkApprove = async () => {
    if (selectedRowKeys.length === 0) return;
    setBulkLoading(true);
    try {
      await Promise.all(
        selectedRowKeys.map(id => leaveService.updateLeaveStatus(id, 'Approved'))
      );
      notification.success({
        message: 'Bulk Approval Complete',
        description: `Successfully approved ${selectedRowKeys.length} leave requests.`
      });
      setSelectedRowKeys([]);
      fetchLeaves();
    } catch (e) {
      notification.error({
        message: 'Bulk Approval Failed',
        description: 'Failed to approve some or all of the selected leave requests.'
      });
    } finally {
      setBulkLoading(false);
    }
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  // Group leaves
  const pendingLeaves = leaves.filter(l => l.status === 'Pending' || !l.status);
  const processedLeaves = leaves.filter(l => l.status === 'Approved' || l.status === 'Rejected');

  // Filter by Month logic
  const months = [
    { value: 'all', label: 'All Months' },
    ...Array.from({ length: 12 }, (_, i) => {
      const date = dayjs().month(i);
      return { value: date.format('YYYY-MM'), label: date.format('MMMM YYYY') };
    })
  ];

  const filteredProcessedLeaves = processedLeaves.filter(l => {
    if (selectedMonth === 'all') return true;
    return dayjs(l.leaveDate).format('YYYY-MM') === selectedMonth;
  });

  const pendingColumns = [
    {
      title: 'Employee Name',
      dataIndex: ['user', 'fullName'],
      key: 'employeeName',
      render: (name, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#4f46e5' }} />
          <Space direction="vertical" size={0}>
            <Text strong>{name || record.user?.email || 'N/A'}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{record.user?.email}</Text>
          </Space>
        </Space>
      )
    },
    {
      title: 'Leave Date',
      dataIndex: 'leaveDate',
      key: 'leaveDate',
      render: (date) => dayjs(date).format('DD MMM YYYY (dddd)'),
      sorter: (a, b) => dayjs(a.leaveDate).unix() - dayjs(b.leaveDate).unix(),
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
      title: 'Action',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="Approve Request">
            <Button 
              type="primary" 
              shape="circle" 
              icon={<CheckOutlined />} 
              onClick={() => handleStatusChange(record.id || record.leaveId, 'Approved')}
              style={{ background: '#10b981', borderColor: '#10b981' }}
            />
          </Tooltip>
          <Tooltip title="Reject Request">
            <Popconfirm
              title="Reject Leave"
              description="Are you sure you want to reject this leave request?"
              onConfirm={() => handleStatusChange(record.id || record.leaveId, 'Rejected')}
              okText="Reject"
              cancelText="Cancel"
            >
              <Button 
                danger
                type="primary"
                shape="circle" 
                icon={<CloseOutlined />} 
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }
  ];

  const processedColumns = [
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
      dataIndex: 'leaveDate',
      key: 'leaveDate',
      render: (date) => dayjs(date).format('DD MMM YYYY (dddd)'),
      sorter: (a, b) => dayjs(a.leaveDate).unix() - dayjs(b.leaveDate).unix(),
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

  if (loading && leaves.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader 
        title="Leave Requests Dashboard" 
        subTitle="Review, approve, and track employee leave logs and absentees."
      />

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
              <Statistic 
                title="Pending Approvals" 
                value={pendingLeaves.length} 
                prefix={<HourglassOutlined style={{ color: '#faad14' }} />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
              <Statistic 
                title="Approved Leaves" 
                value={leaves.filter(l => l.status === 'Approved').length} 
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
              <Statistic 
                title="Rejected Leaves" 
                value={leaves.filter(l => l.status === 'Rejected').length} 
                prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />} 
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
          <Tabs defaultActiveKey="pending">
            <Tabs.TabPane tab={`Pending Requests (${pendingLeaves.length})`} key="pending">
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={bulkLoading}
                  disabled={selectedRowKeys.length === 0}
                  onClick={handleBulkApprove}
                  style={{ background: '#10b981', borderColor: '#10b981', borderRadius: 6 }}
                >
                  Approve Selected {selectedRowKeys.length > 0 ? `(${selectedRowKeys.length})` : ''}
                </Button>
              </div>
              <Table
                rowSelection={rowSelection}
                dataSource={pendingLeaves}
                columns={pendingColumns}
                rowKey="leaveId"
                pagination={{ pageSize: 10 }}
                locale={{ emptyText: 'No pending leave requests found.' }}
              />
            </Tabs.TabPane>
            
            <Tabs.TabPane tab="Historical Leave Logs" key="processed">
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>Filter by Month:</Text>
                <Select
                  style={{ width: 220 }}
                  placeholder="Select a month"
                  value={selectedMonth}
                  onChange={setSelectedMonth}
                  options={months}
                />
              </div>

              <Table
                dataSource={filteredProcessedLeaves}
                columns={processedColumns}
                rowKey="leaveId"
                pagination={{ pageSize: 10 }}
                locale={{ emptyText: 'No historical leave records found.' }}
              />
            </Tabs.TabPane>
          </Tabs>
        </Card>
      </Space>
    </div>
  );
};

export default HRApprovedLeavesPage;
