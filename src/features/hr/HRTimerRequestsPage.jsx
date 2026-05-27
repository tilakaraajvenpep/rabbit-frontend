import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Typography, Tag, message, Spin, Empty, Alert } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, UserOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { timerRequestService } from '../../services/timerRequestService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Text } = Typography;

const HRTimerRequestsPage = () => {
  const { isDarkMode } = useThemeStore();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchApprovedRequests();
  }, []);

  const fetchApprovedRequests = async () => {
    setLoading(true);
    try {
      const res = await timerRequestService.getHRApprovedRequests();
      setRequests(res.data.data || []);
    } catch (err) {
      message.error('Failed to load approved additional hours requests');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Employee Name',
      dataIndex: 'employeeName',
      key: 'employeeName',
      render: (name) => (
        <Space>
          <UserOutlined style={{ color: '#10b981' }} />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: 'Project',
      dataIndex: 'projectName',
      key: 'projectName',
      render: (name) => <Text strong style={{ color: '#6366f1' }}>{name || '—'}</Text>
    },
    {
      title: 'Role',
      dataIndex: 'employeeRole',
      key: 'employeeRole',
      render: (role) => (
        <Tag color={role === 'TeamLead' ? 'purple' : role === 'ProjectManager' ? 'blue' : 'orange'}>
          {role}
        </Tag>
      ),
    },
    {
      title: 'Ticket Code',
      dataIndex: 'ticketCode',
      key: 'ticketCode',
      render: (code) => <Text code>{code}</Text>,
    },
    {
      title: 'Ticket Title',
      dataIndex: 'ticketTitle',
      key: 'ticketTitle',
    },
    {
      title: 'Current Allocation',
      dataIndex: 'currentAllocatedHours',
      key: 'currentAllocatedHours',
      render: (h) => <Text>{h || '0.00'} hrs/day</Text>,
    },
    {
      title: 'Approved Extra Hours',
      dataIndex: ['request', 'requestedHours'],
      key: 'requestedHours',
      render: (h) => (
        <Tag color="success" style={{ fontSize: 13, padding: '4px 8px', fontWeight: 'bold' }}>
          +{h} hrs
        </Tag>
      ),
    },
    {
      title: 'Accounts Status',
      key: 'status',
      render: () => (
        <Tag color="cyan" icon={<CheckCircleOutlined />}>
          Accounts Approved
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button
          type="primary"
          icon={<SettingOutlined />}
          onClick={() => navigate('/hr/hours')}
          style={{ background: '#6366f1', borderColor: '#6366f1', borderRadius: 6 }}
        >
          Reallocate Hours
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Accounts Approved Additional Hours"
        subtitle="Review additional hours requests approved by Accounts. Reallocate quotas so employees can submit their EOD reports."
      />

      <Alert
        message="Workflow: Accounts has cleared the budget for these requests. Please allocate/reassign their daily hours accordingly so they can report their EOD."
        type="success"
        showIcon
        style={{ borderRadius: 10 }}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Spin size="large" tip="Loading approved requests..." />
        </div>
      ) : requests.length === 0 ? (
        <Empty description="No pending additional hours adjustments needed." />
      ) : (
        <Card style={{ borderRadius: 16, overflow: 'hidden' }}>
          <Table
            columns={columns}
            dataSource={requests}
            rowKey={(r) => r.request.requestId}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      )}
    </div>
  );
};

export default HRTimerRequestsPage;
