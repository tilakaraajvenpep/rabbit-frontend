import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Typography, Tag, Modal, Input, message, Spin, Empty } from 'antd';
import { ClockCircleOutlined, SendOutlined, CheckCircleOutlined, FileTextOutlined } from '@ant-design/icons';
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
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button 
          type="primary" 
          icon={<SendOutlined />}
          onClick={() => handleOpenForwardModal(record)}
          style={{ borderRadius: 6 }}
        >
          Forward to PM
        </Button>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader 
        title="Review Employee Hours Requests" 
        subtitle="Review employee timer missed and hours exceeded alerts, and forward them to the Project Manager"
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
    </div>
  );
};

export default TimerRequestsReviewPage;
