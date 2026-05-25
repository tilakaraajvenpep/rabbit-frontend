import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Typography, Tag, Modal, Input, message, Spin, Empty } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, MessageOutlined } from '@ant-design/icons';
import { timerRequestService } from '../../services/timerRequestService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Text } = Typography;
const { TextArea } = Input;

const TimerRequestsApprovalPage = () => {
  const { isDarkMode } = useThemeStore();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  
  // Respond Modal State
  const [isRespondModalOpen, setIsRespondModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isApproval, setIsApproval] = useState(true);
  const [pmComment, setPmComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const handleOpenRespondModal = (record, approve) => {
    setSelectedRequest(record);
    setIsApproval(approve);
    setPmComment('');
    setIsRespondModalOpen(true);
  };

  const handleRespondSubmit = async () => {
    if (!selectedRequest) return;
    setSubmitting(true);
    try {
      await timerRequestService.respondToRequest(selectedRequest.request.requestId, {
        approved: isApproval,
        comments: pmComment
      });
      message.success(`Request ${isApproval ? 'Approved' : 'Rejected'} successfully! Employee has been notified.`);
      setIsRespondModalOpen(false);
      fetchPMRequests();
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
      title: 'TL Comments',
      dataIndex: ['request', 'comments'],
      key: 'comments',
      render: (c) => c ? <Text italic type="warning">{c}</Text> : <Text italic type="secondary">No comment</Text>
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
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
        </Space>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader 
        title="Approve Employee Hours Requests" 
        subtitle="Manage and unlock restricted daily reports for employees that missed timers or exceeded ticket limit estimations"
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Spin size="large" tip="Loading approvals..." />
        </div>
      ) : requests.length === 0 ? (
        <Empty description="No pending timer/hours approvals from any team." />
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

      {/* Respond Modal */}
      <Modal
        title={
          <Space>
            {isApproval ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
            <span>{isApproval ? 'Approve' : 'Reject'} Hours Extension / Unlock Request</span>
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
          {selectedRequest?.request?.comments && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>TL Recommendation: </Text>
              <Text italic style={{ fontSize: 12, color: '#d97706' }}>"{selectedRequest?.request?.comments}"</Text>
            </div>
          )}
        </div>

        <Text strong>Add PM Comment / Feedback</Text>
        <TextArea
          rows={4}
          value={pmComment}
          onChange={(e) => setPmComment(e.target.value)}
          placeholder="Provide final remarks to the employee..."
          style={{ marginTop: 8 }}
        />
      </Modal>
    </div>
  );
};

export default TimerRequestsApprovalPage;
