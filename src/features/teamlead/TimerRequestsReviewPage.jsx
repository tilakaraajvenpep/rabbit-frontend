import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Typography, Tag, Modal, Input, message, Spin, Empty } from 'antd';
import { ClockCircleOutlined, SendOutlined, CheckCircleOutlined, CloseCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { timerRequestService } from '../../services/timerRequestService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Text } = Typography;
const { TextArea } = Input;

const TimerRequestsReviewPage = () => {
  const { isDarkMode } = useThemeStore();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  
  // Forward Modal State
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [forwardComment, setForwardComment] = useState('');
  const [forwarding, setForwarding] = useState(false);

  // Direct Respond State
  const [isRespondModalOpen, setIsRespondModalOpen] = useState(false);
  const [isApproval, setIsApproval] = useState(true);
  const [tlComment, setTlComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTLRequests();
  }, []);

  const fetchTLRequests = async () => {
    setLoading(true);
    try {
      const res = await timerRequestService.getTLPendingRequests();
      setRequests(res.data.data || []);
    } catch (err) {
      message.error('Failed to load pending timer requests');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForwardModal = (record) => {
    setSelectedRequest(record);
    setForwardComment('');
    setIsForwardModalOpen(true);
  };

  const handleForwardSubmit = async () => {
    if (!selectedRequest) return;
    setForwarding(true);
    try {
      await timerRequestService.forwardToPM(selectedRequest.request.requestId, {
        comments: forwardComment
      });
      message.success('Request forwarded to Project Manager successfully!');
      setIsForwardModalOpen(false);
      fetchTLRequests();
    } catch (err) {
      message.error('Failed to forward request');
    } finally {
      setForwarding(false);
    }
  };

  const handleOpenRespondModal = (record, approve) => {
    setSelectedRequest(record);
    setIsApproval(approve);
    setTlComment('');
    setIsRespondModalOpen(true);
  };

  const handleRespondSubmit = async () => {
    if (!selectedRequest) return;
    setSubmitting(true);
    try {
      await timerRequestService.respondToRequest(selectedRequest.request.requestId, {
        approved: isApproval,
        comments: tlComment
      });
      message.success(`Request ${isApproval ? 'Approved' : 'Rejected'} successfully! Employee has been notified.`);
      setIsRespondModalOpen(false);
      fetchTLRequests();
    } catch (err) {
      message.error('Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: 'Employee Name',
      dataIndex: 'employeeName',
      key: 'employeeName',
      render: (name) => <Text strong>{name}</Text>
    },
    {
      title: 'Project',
      dataIndex: 'projectName',
      key: 'projectName',
      render: (name) => <Text strong style={{ color: '#6366f1' }}>{name || '—'}</Text>
    },
    {
      title: 'Ticket Code',
      dataIndex: 'ticketCode',
      key: 'ticketCode',
      render: (code) => <Text code>{code}</Text>
    },
    {
      title: 'Ticket Title',
      dataIndex: 'ticketTitle',
      key: 'ticketTitle',
    },
    {
      title: 'Request Type',
      dataIndex: ['request', 'requestType'],
      key: 'requestType',
      render: (type) => (
        <Tag color={type === 'TimerMissed' ? 'volcano' : 'purple'}>
          {type === 'TimerMissed' ? 'Timer Missed' : 'Hours Exceeded'}
        </Tag>
      )
    },
    {
      title: 'Hours Requested',
      dataIndex: ['request', 'requestedHours'],
      key: 'requestedHours',
      render: (h) => <Text strong>{h} hrs</Text>
    },
    {
      title: 'Reason',
      dataIndex: ['request', 'reason'],
      key: 'reason',
      render: (r) => <Text type="secondary">{r}</Text>
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size={8}>
          <Button 
            type="primary" 
            icon={<CheckCircleOutlined />}
            onClick={() => handleOpenRespondModal(record, true)}
            style={{ background: '#52c41a', borderColor: '#52c41a', borderRadius: 6 }}
          >
            Approve
          </Button>
          <Button 
            type="primary" 
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => handleOpenRespondModal(record, false)}
            style={{ borderRadius: 6 }}
          >
            Reject
          </Button>
          <Button 
            type="default" 
            icon={<SendOutlined />}
            onClick={() => handleOpenForwardModal(record)}
            style={{ borderRadius: 6 }}
          >
            Forward to PM
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader 
        title="Review Employee Hours Requests" 
        subtitle="Review and approve, reject, or forward employee timer missed and hours exceeded requests"
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Spin size="large" tip="Loading requests..." />
        </div>
      ) : requests.length === 0 ? (
        <Empty description="No pending timer/hours requests from your team." />
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

      {/* Forward Modal */}
      <Modal
        title={
          <Space>
            <SendOutlined style={{ color: '#1890ff' }} />
            <span>Forward Request to Project Manager</span>
          </Space>
        }
        open={isForwardModalOpen}
        onCancel={() => setIsForwardModalOpen(false)}
        onOk={handleForwardSubmit}
        confirmLoading={forwarding}
        okText="Forward to PM"
        cancelText="Cancel"
        destroyOnClose
      >
        <div style={{ marginBottom: 16, background: '#f8fafc', padding: 12, borderRadius: 8 }}>
          <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>Employee Request Details</Text>
          <Text strong>{selectedRequest?.employeeName}</Text> ({selectedRequest?.ticketCode} - {selectedRequest?.ticketTitle})
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Reason: </Text>
            <Text italic style={{ fontSize: 12 }}>"{selectedRequest?.request?.reason}"</Text>
          </div>
        </div>

        <Text strong>Add Recommendation / Comment</Text>
        <TextArea
          rows={4}
          value={forwardComment}
          onChange={(e) => setForwardComment(e.target.value)}
          placeholder="Write your recommendation comments to help the Project Manager review this request..."
          style={{ marginTop: 8 }}
        />
      </Modal>

      {/* Respond (Approve/Reject) Modal */}
      <Modal
        title={
          <Space>
            {isApproval ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
            <span>{isApproval ? 'Approve' : 'Reject'} Employee Hours Request</span>
          </Space>
        }
        open={isRespondModalOpen}
        onCancel={() => setIsRespondModalOpen(false)}
        onOk={handleRespondSubmit}
        confirmLoading={submitting}
        okText={isApproval ? 'Approve Request' : 'Reject Request'}
        okType={isApproval ? 'primary' : 'danger'}
        cancelText="Cancel"
        destroyOnClose
      >
        <div style={{ marginBottom: 16, background: '#f8fafc', padding: 12, borderRadius: 8 }}>
          <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>Employee Request Details</Text>
          <Text strong>{selectedRequest?.employeeName}</Text> ({selectedRequest?.ticketCode} - {selectedRequest?.ticketTitle})
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Reason: </Text>
            <Text italic style={{ fontSize: 12 }}>"{selectedRequest?.request?.reason}"</Text>
          </div>
        </div>

        <Text strong>Add Team Lead Comments</Text>
        <TextArea
          rows={4}
          value={tlComment}
          onChange={(e) => setTlComment(e.target.value)}
          placeholder="Provide remarks to the employee..."
          style={{ marginTop: 8 }}
        />
      </Modal>
    </div>
  );
};

export default TimerRequestsReviewPage;
