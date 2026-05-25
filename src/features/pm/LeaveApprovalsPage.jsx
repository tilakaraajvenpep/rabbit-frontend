import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Space, Typography, notification, Modal } from 'antd';
import { CalendarOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { leaveService } from '../../services/leaveService';
import { useAuthStore } from '../../store/authStore';
import PageHeader from '../../components/common/PageHeader';

const { Text } = Typography;

const LeaveApprovalsPage = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const { currentUser } = useAuthStore();
  const isAccounts = currentUser?.role === 'Accounts';

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await leaveService.getAllLeaves();
      setLeaves(res.data);
    } catch (e) {
      notification.error({ message: 'Error', description: 'Failed to fetch leave requests.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, status) => {
    Modal.confirm({
      title: `${status} Leave Request`,
      content: `Are you sure you want to ${status.toLowerCase()} this leave request?`,
      okText: 'Yes',
      cancelText: 'No',
      onOk: async () => {
        setActionLoading(true);
        try {
          await leaveService.updateLeaveStatus(id, status);
          notification.success({
            message: `Request ${status}`,
            description: `Leave request has been successfully ${status.toLowerCase()}.`
          });
          fetchLeaves();
        } catch (e) {
          notification.error({ message: 'Error', description: 'Failed to update leave status.' });
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const columns = [
    {
      title: 'Employee Name',
      dataIndex: ['user', 'fullName'],
      key: 'employeeName',
      render: (name, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{record.user?.email}</Text>
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
        <Tag color={type === 'FullDay' ? 'indigo' : 'cyan'}>
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
      render: (status) => {
        let color = 'gold';
        let icon = <ClockCircleOutlined />;
        if (status === 'Approved') {
          color = 'success';
          icon = <CheckCircleOutlined />;
        } else if (status === 'Rejected') {
          color = 'error';
          icon = <CloseCircleOutlined />;
        }
        return (
          <Tag icon={icon} color={color} style={{ borderRadius: 6, padding: '2px 8px' }}>
            {status}
          </Tag>
        );
      },
    },
    {
      title: 'Applied On',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('DD MMM YYYY, hh:mm A'),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => {
        if (record.status !== 'Pending') return null;

        return (
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleAction(record.leaveId, 'Approved')}
              loading={actionLoading}
              style={{ background: '#10b981', borderColor: '#10b981' }}
            >
              Approve
            </Button>
            <Button
              type="primary"
              danger
              size="small"
              icon={<CloseCircleOutlined />}
              onClick={() => handleAction(record.leaveId, 'Rejected')}
              loading={actionLoading}
            >
              Reject
            </Button>
          </Space>
        );
      }
    }
  ];

  const pendingLeaves = leaves.filter(l => l.status === 'Pending');
  const pastLeaves = leaves.filter(l => isAccounts ? l.status === 'Approved' : l.status !== 'Pending');

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
      <PageHeader title="Leave Approvals" />

      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        {/* Pending Requests */}
        {!isAccounts && (
          <Card
            title={
              <Space>
                <CalendarOutlined style={{ color: '#f59e0b' }} />
                <span>Pending Leave Requests ({pendingLeaves.length})</span>
              </Space>
            }
            style={{ borderRadius: 12, boxShadow: '0 4px 20px rgba(245, 158, 11, 0.03)' }}
          >
            <Table
              columns={columns}
              dataSource={pendingLeaves}
              rowKey="leaveId"
              loading={loading}
              locale={{ emptyText: 'No pending leave requests found.' }}
            />
          </Card>
        )}

        {/* Leave History Log */}
        <Card
          title={isAccounts ? "Approved Leaves Log" : "Past Leaves Log"}
          style={{ borderRadius: 12, boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}
        >
          <Table
            columns={columns.filter(col => col.key !== 'action')}
            dataSource={pastLeaves}
            rowKey="leaveId"
            loading={loading}
            pagination={{ pageSize: 8 }}
            locale={{ emptyText: 'No history record available.' }}
          />
        </Card>
      </Space>
    </div>
  );
};

export default LeaveApprovalsPage;
