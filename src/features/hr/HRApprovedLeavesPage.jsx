import React, { useState, useEffect } from 'react';
import { 
  Card, Table, Tag, Space, Typography, notification, Spin, 
  Row, Col, Statistic, Select, Button, Tabs, Tooltip, Popconfirm, Avatar, DatePicker
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

const combineContinuousLeaves = (leavesList) => {
  if (!leavesList || leavesList.length === 0) return [];

  // Group by userId, type, status, reason
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
    // Sort by leaveDate ascending
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

const HRApprovedLeavesPage = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterRange, setFilterRange] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState([]);
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
        description: 'Failed to fetch leaves and permissions requests.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (ids, newStatus) => {
    try {
      const idArray = Array.isArray(ids) ? ids : [ids];
      await Promise.all(
        idArray.map(id => leaveService.updateLeaveStatus(id, newStatus))
      );
      notification.success({
        message: 'Status Updated',
        description: `Successfully marked request as ${newStatus}.`
      });
      fetchLeaves();
    } catch (e) {
      notification.error({
        message: 'Update Failed',
        description: `Could not update request status.`
      });
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

  const handleBulkApproveLeaves = async () => {
    if (selectedRowKeys.length === 0) return;
    setBulkLoading(true);
    try {
      const combinedPending = combineContinuousLeaves(leaves.filter(l => l.type !== 'Permission' && (l.status === 'Pending' || !l.status)));
      const selectedBlocks = combinedPending.filter(l => selectedRowKeys.includes(l.leaveId || l.id));
      const allIds = [];
      selectedBlocks.forEach(b => {
        if (b.ids && b.ids.length > 0) {
          allIds.push(...b.ids);
        } else {
          allIds.push(b.leaveId || b.id);
        }
      });

      await Promise.all(
        allIds.map(id => leaveService.updateLeaveStatus(id, 'Approved'))
      );
      notification.success({
        message: 'Bulk Approval Complete',
        description: `Approved selected leave requests.`
      });
      setSelectedRowKeys([]);
      fetchLeaves();
    } catch (e) {
      notification.error({
        message: 'Bulk Approval Failed',
        description: 'Failed to approve some leave requests.'
      });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkApprovePermissions = async () => {
    if (selectedPermissionKeys.length === 0) return;
    setBulkLoading(true);
    try {
      await Promise.all(
        selectedPermissionKeys.map(id => leaveService.updateLeaveStatus(id, 'Approved'))
      );
      notification.success({
        message: 'Bulk Approval Complete',
        description: `Approved selected permission requests.`
      });
      setSelectedPermissionKeys([]);
      fetchLeaves();
    } catch (e) {
      notification.error({
        message: 'Bulk Approval Failed',
        description: 'Failed to approve some permission requests.'
      });
    } finally {
      setBulkLoading(false);
    }
  };

  // 1. Separate Leaves from Permissions
  const leavesOnly = leaves.filter(l => l.type !== 'Permission');
  const permissionsOnly = leaves.filter(l => l.type === 'Permission');

  // 2. Combine continuous leaves
  const combinedLeaves = combineContinuousLeaves(leavesOnly);

  const pendingLeaves = combinedLeaves
    .filter(l => l.status === 'Pending' || !l.status)
    .sort((a, b) => b.startDate.unix() - a.startDate.unix());
  const processedLeaves = combinedLeaves
    .filter(l => l.status === 'Approved' || l.status === 'Rejected')
    .sort((a, b) => b.startDate.unix() - a.startDate.unix());

  const pendingPermissions = permissionsOnly
    .filter(p => p.status === 'Pending' || !p.status)
    .sort((a, b) => dayjs(b.leaveDate).unix() - dayjs(a.leaveDate).unix());
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

  const pendingLeaveColumns = [
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
      title: 'Action',
      key: 'action',
      width: 140,
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="Approve Request">
            <Button 
              type="primary" 
              shape="circle" 
              icon={<CheckOutlined />} 
              onClick={() => handleStatusChange(record.ids || record.id || record.leaveId, 'Approved')}
              style={{ background: '#10b981', borderColor: '#10b981' }}
            />
          </Tooltip>
          <Tooltip title="Reject Request">
            <Popconfirm
              title="Reject Leave"
              description="Are you sure you want to reject this leave request?"
              onConfirm={() => handleStatusChange(record.ids || record.id || record.leaveId, 'Rejected')}
              okText="Reject"
              cancelText="Cancel"
            >
              <Button danger type="primary" shape="circle" icon={<CloseOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }
  ];

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

  const pendingPermissionColumns = [
    {
      title: 'Employee Name',
      dataIndex: ['user', 'fullName'],
      key: 'employeeName',
      render: (name, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#8b5cf6' }} />
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
      title: 'Action',
      key: 'action',
      width: 140,
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="Approve Permission">
            <Button 
              type="primary" 
              shape="circle" 
              icon={<CheckOutlined />} 
              onClick={() => handleStatusChange(record.id || record.leaveId, 'Approved')}
              style={{ background: '#10b981', borderColor: '#10b981' }}
            />
          </Tooltip>
          <Tooltip title="Reject Permission">
            <Popconfirm
              title="Reject Permission"
              description="Are you sure you want to reject this permission request?"
              onConfirm={() => handleStatusChange(record.id || record.leaveId, 'Rejected')}
              okText="Reject"
              cancelText="Cancel"
            >
              <Button danger type="primary" shape="circle" icon={<CloseOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
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

  return (
    <div>
      <PageHeader 
        title="Leaves & Permissions Dashboard" 
        subTitle="Review, approve, and track employee leave requests and permission logs."
      />

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={6}>
            <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
              <Statistic 
                title="Pending Leaves" 
                value={pendingLeaves.length} 
                prefix={<HourglassOutlined style={{ color: '#faad14' }} />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
              <Statistic 
                title="Pending Permissions" 
                value={pendingPermissions.length} 
                prefix={<HourglassOutlined style={{ color: '#8b5cf6' }} />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
              <Statistic 
                title="Approved Total" 
                value={leaves.filter(l => l.status === 'Approved').length} 
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
              <Statistic 
                title="Rejected Total" 
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
          <Tabs defaultActiveKey="leaves">
            <Tabs.TabPane tab={`Leave Requests (${pendingLeaves.length} Pending)`} key="leaves">
              <Tabs defaultActiveKey="pendingLeavesTab">
                <Tabs.TabPane tab="Pending Leaves" key="pendingLeavesTab">
                  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      type="primary"
                      icon={<CheckOutlined />}
                      loading={bulkLoading}
                      disabled={selectedRowKeys.length === 0}
                      onClick={handleBulkApproveLeaves}
                      style={{ background: '#10b981', borderColor: '#10b981', borderRadius: 6 }}
                    >
                      Approve Selected {selectedRowKeys.length > 0 ? `(${selectedRowKeys.length})` : ''}
                    </Button>
                  </div>
                  <Table
                    rowSelection={{
                      selectedRowKeys,
                      onChange: setSelectedRowKeys
                    }}
                    dataSource={pendingLeaves}
                    columns={pendingLeaveColumns}
                    rowKey="leaveId"
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: 'No pending leave requests found.' }}
                  />
                </Tabs.TabPane>
                
                <Tabs.TabPane tab="Historical Leave Logs" key="processedLeavesTab">
                  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <Text strong>Filter by Date Range:</Text>
                    <DatePicker.RangePicker
                      style={{ width: 280 }}
                      value={filterRange}
                      onChange={setFilterRange}
                      allowClear
                    />
                  </div>

                  <Table
                    dataSource={filteredProcessedLeaves}
                    columns={processedLeaveColumns}
                    rowKey="leaveId"
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: 'No historical leave records found.' }}
                  />
                </Tabs.TabPane>
              </Tabs>
            </Tabs.TabPane>
            
            <Tabs.TabPane tab={`Permission Requests (${pendingPermissions.length} Pending)`} key="permissions">
              <Tabs defaultActiveKey="pendingPermissionsTab">
                <Tabs.TabPane tab="Pending Permissions" key="pendingPermissionsTab">
                  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      type="primary"
                      icon={<CheckOutlined />}
                      loading={bulkLoading}
                      disabled={selectedPermissionKeys.length === 0}
                      onClick={handleBulkApprovePermissions}
                      style={{ background: '#10b981', borderColor: '#10b981', borderRadius: 6 }}
                    >
                      Approve Selected {selectedPermissionKeys.length > 0 ? `(${selectedPermissionKeys.length})` : ''}
                    </Button>
                  </div>
                  <Table
                    rowSelection={{
                      selectedRowKeys: selectedPermissionKeys,
                      onChange: setSelectedPermissionKeys
                    }}
                    dataSource={pendingPermissions}
                    columns={pendingPermissionColumns}
                    rowKey="leaveId"
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: 'No pending permission requests found.' }}
                  />
                </Tabs.TabPane>

                <Tabs.TabPane tab="Historical Permission Logs" key="processedPermissionsTab">
                  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <Text strong>Filter by Date Range:</Text>
                    <DatePicker.RangePicker
                      style={{ width: 280 }}
                      value={filterRange}
                      onChange={setFilterRange}
                      allowClear
                    />
                  </div>

                  <Table
                    dataSource={filteredProcessedPermissions}
                    columns={processedPermissionColumns}
                    rowKey="leaveId"
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: 'No historical permission records found.' }}
                  />
                </Tabs.TabPane>
              </Tabs>
            </Tabs.TabPane>
          </Tabs>
        </Card>
      </Space>
    </div>
  );
};

export default HRApprovedLeavesPage;
