import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Typography, Tag, Modal, Input, message, Spin, Empty, Alert } from 'antd';
import { ClockCircleOutlined, SendOutlined, CloseCircleOutlined, MessageOutlined, DollarOutlined } from '@ant-design/icons';
import { timerRequestService } from '../../services/timerRequestService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Text } = Typography;
const { TextArea } = Input;

const TimerRequestsApprovalPage = () => {
  const { isDarkMode } = useThemeStore();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);

  // Forward to Accounts Modal
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [pmComment, setPmComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reject Modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    fetchPMRequests();
  }, []);

  const fetchPMRequests = async () => {
    setLoading(true);
    try {
      const res = await timerRequestService.getPMPendingRequests();
      setRequests(res.data.data || []);
    } catch (err) {
      message.error('Failed to load pending timer approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForwardModal = (record) => {
    setSelectedRequest(record);
    setPmComment('');
    setIsForwardModalOpen(true);
  };

  const handleForwardToAccounts = async () => {
    if (!selectedRequest) return;
    setSubmitting(true);
    try {
      await timerRequestService.forwardToAccounts(selectedRequest.request.requestId, {
        comments: pmComment,
      });
      message.success('Request forwarded to Accounts for budget approval!');
      setIsForwardModalOpen(false);
      fetchPMRequests();
    } catch (err) {
      message.error('Failed to forward request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenRejectModal = (record) => {
    setSelectedRequest(record);
    setRejectComment('');
    setIsRejectModalOpen(true);
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    setRejecting(true);
    try {
      await timerRequestService.respondToRequest(selectedRequest.request.requestId, {
        approved: false,
        comments: rejectComment,
      });
      message.success('Request rejected. Employee has been notified.');
      setIsRejectModalOpen(false);
      fetchPMRequests();
    } catch (err) {
      message.error('Failed to reject request');
    } finally {
      setRejecting(false);
    }
  };

  const statusColor = {
    PendingTL: 'orange',
    PendingPM: 'blue',
    PendingAccounts: 'purple',
    AccountsApproved: 'cyan',
    Approved: 'green',
    Rejected: 'red',
  };

  const columns = [
    {
      title: 'Employee',
      dataIndex: 'employeeName',
      key: 'employeeName',
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: 'Ticket',
      key: 'ticket',
      render: (_, r) => <Text code>{r.ticketCode} — {r.ticketTitle}</Text>,
    },
    {
      title: 'Type',
      dataIndex: ['request', 'requestType'],
      key: 'requestType',
      render: (type) => (
        <Tag color={type === 'TimerMissed' ? 'volcano' : 'purple'}>
          {type === 'TimerMissed' ? 'Timer Missed' : 'Extra Hours'}
        </Tag>
      ),
    },
    {
      title: 'Hours Requested',
      dataIndex: ['request', 'requestedHours'],
      key: 'requestedHours',
      render: (h) => <Text strong>{h} hrs</Text>,
    },
    {
      title: 'Reason',
      dataIndex: ['request', 'reason'],
      key: 'reason',
      render: (r) => <Text type="secondary">{r}</Text>,
    },
    {
      title: 'TL Notes',
      dataIndex: ['request', 'comments'],
      key: 'comments',
      render: (c) => c ? <Text italic type="warning">{c}</Text> : <Text italic type="secondary">—</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            icon={<DollarOutlined />}
            onClick={() => handleOpenForwardModal(record)}
            style={{ background: '#6366f1', borderColor: '#6366f1', borderRadius: 6 }}
          >
            Forward to Accounts
          </Button>
          <Button
            type="primary"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => handleOpenRejectModal(record)}
            style={{ borderRadius: 6 }}
          >
            Reject
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Review Additional Hours Requests"
        subtitle="Review requests from team leads. Forward approved requests to Accounts for budget clearance."
      />

      <Alert
        message="Workflow: Employee → Team Lead → Project Manager (you) → Accounts → HR/PM reassigns quota"
        type="info"
        showIcon
        style={{ borderRadius: 10 }}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Spin size="large" tip="Loading approvals..." />
        </div>
      ) : requests.length === 0 ? (
        <Empty description="No pending additional hours requests from any team." />
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

      {/* Forward to Accounts Modal */}
      <Modal
        title={
          <Space>
            <DollarOutlined style={{ color: '#6366f1' }} />
            <span>Forward to Accounts for Budget Clearance</span>
          </Space>
        }
        open={isForwardModalOpen}
        onCancel={() => setIsForwardModalOpen(false)}
        onOk={handleForwardToAccounts}
        confirmLoading={submitting}
        okText="Forward to Accounts"
        okButtonProps={{ style: { background: '#6366f1', borderColor: '#6366f1' } }}
        cancelText="Cancel"
        destroyOnClose
      >
        <div style={{ marginBottom: 16, background: '#f8fafc', padding: 12, borderRadius: 8 }}>
          <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>Request Details</Text>
          <Text strong>{selectedRequest?.employeeName}</Text> ({selectedRequest?.ticketCode} — {selectedRequest?.ticketTitle})
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Hours requested: </Text>
            <Text strong style={{ color: '#6366f1' }}>{selectedRequest?.request?.requestedHours} hrs</Text>
          </div>
          <div style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Reason: </Text>
            <Text italic style={{ fontSize: 12 }}>"{selectedRequest?.request?.reason}"</Text>
          </div>
          {selectedRequest?.request?.comments && (
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>TL Notes: </Text>
              <Text italic style={{ fontSize: 12, color: '#d97706' }}>"{selectedRequest?.request?.comments}"</Text>
            </div>
          )}
        </div>
        <Text strong>Add PM Notes (forwarded to Accounts)</Text>
        <TextArea
          rows={3}
          value={pmComment}
          onChange={(e) => setPmComment(e.target.value)}
          placeholder="Add context or recommendations for Accounts review..."
          style={{ marginTop: 8 }}
        />
      </Modal>

      {/* Reject Modal */}
      <Modal
        title={
          <Space>
            <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>Reject Additional Hours Request</span>
          </Space>
        }
        open={isRejectModalOpen}
        onCancel={() => setIsRejectModalOpen(false)}
        onOk={handleReject}
        confirmLoading={rejecting}
        okText="Reject Request"
        okType="danger"
        cancelText="Cancel"
        destroyOnClose
      >
        <div style={{ marginBottom: 12, background: '#fff1f0', padding: 12, borderRadius: 8 }}>
          <Text strong>{selectedRequest?.employeeName}</Text> — {selectedRequest?.ticketCode}
        </div>
        <Text strong>Rejection Reason</Text>
        <TextArea
          rows={3}
          value={rejectComment}
          onChange={(e) => setRejectComment(e.target.value)}
          placeholder="Explain why this request is being rejected..."
          style={{ marginTop: 8 }}
        />
      </Modal>
    </div>
  );
};

export default TimerRequestsApprovalPage;
