import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Typography, Tag, Modal, Input, message, Spin, Empty } from 'antd';
import { CalendarOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { reportAccessService } from '../../services/reportAccessService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';
import dayjs from 'dayjs';

const { Text } = Typography;
const { TextArea } = Input;

const ReportAccessApprovalPage = () => {
  const { isDarkMode } = useThemeStore();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  
  // Respond Modal State
  const [isRespondModalOpen, setIsRespondModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isApproval, setIsApproval] = useState(true);
  const [reviewerComment, setReviewerComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await reportAccessService.getPendingRequests();
      setRequests(res.data || []);
    } catch (err) {
      message.error('Failed to load pending access requests');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRespondModal = (record, approve) => {
    setSelectedRequest(record);
    setIsApproval(approve);
    setReviewerComment('');
    setIsRespondModalOpen(true);
  };

  const handleRespondSubmit = async () => {
    if (!selectedRequest) return;
    setSubmitting(true);
    try {
      await reportAccessService.respond(selectedRequest.requestId, isApproval, reviewerComment);
      message.success(`Request ${isApproval ? 'Approved' : 'Rejected'} successfully! Employee has been notified.`);
      setIsRespondModalOpen(false);
      fetchRequests();
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
      render: (name, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{record.employeeEmail}</Text>
        </Space>
      )
    },
    {
      title: 'Target Date',
      dataIndex: 'targetDate',
      key: 'targetDate',
      render: (date) => (
        <Tag color="blue" icon={<CalendarOutlined />}>
          {dayjs(date).format('DD MMM YYYY')} ( {dayjs(date).format('dddd')} )
        </Tag>
      )
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      render: (r) => <Text type="secondary">{r}</Text>
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
        title="Approve Report Access Requests" 
        subtitle="Manage requests from employees seeking access to submit daily EOD reports outside the current work week."
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Spin size="large" tip="Loading requests..." />
        </div>
      ) : requests.length === 0 ? (
        <Empty description="No pending report access requests to approve." />
      ) : (
        <Card style={{ borderRadius: 16, overflow: 'hidden' }}>
          <Table 
            columns={columns}
            dataSource={requests}
            rowKey={(r) => r.requestId}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      )}

      {/* Respond Modal */}
      <Modal
        title={
          <Space>
            {isApproval ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
            <span>{isApproval ? 'Approve' : 'Reject'} Report Date Access Request</span>
          </Space>
        }
        open={isRespondModalOpen}
        onCancel={() => setIsRespondModalOpen(false)}
        onOk={handleRespondSubmit}
        confirmLoading={submitting}
        okText={isApproval ? 'Approve' : 'Reject'}
        okType={isApproval ? 'primary' : 'danger'}
        cancelText="Cancel"
        destroyOnClose
      >
        <div style={{ marginBottom: 16, background: '#f8fafc', padding: 12, borderRadius: 8 }}>
          <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>Employee Details</Text>
          <Text strong>{selectedRequest?.employeeName}</Text> ({selectedRequest?.employeeEmail})
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Requested Date: </Text>
            <Text strong style={{ fontSize: 12, color: '#4f46e5' }}>
              {selectedRequest ? dayjs(selectedRequest.targetDate).format('dddd, DD MMMM YYYY') : ''}
            </Text>
          </div>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Reason: </Text>
            <Text italic style={{ fontSize: 12 }}>"{selectedRequest?.reason}"</Text>
          </div>
        </div>

        <Text strong>Add Reviewer Remarks / Feedback</Text>
        <TextArea
          rows={4}
          value={reviewerComment}
          onChange={(e) => setReviewerComment(e.target.value)}
          placeholder="E.g., Approved. Please complete your reporting on this date as soon as possible."
          style={{ marginTop: 8 }}
        />
      </Modal>
    </div>
  );
};

export default ReportAccessApprovalPage;
