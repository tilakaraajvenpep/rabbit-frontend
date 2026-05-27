import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Space, Typography, Tag, Modal, Input, message,
  Spin, Empty, Alert, Statistic, Row, Col,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, DollarOutlined,
  ClockCircleOutlined, UserOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { timerRequestService } from '../../services/timerRequestService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Text } = Typography;
const { TextArea } = Input;

const AccountsHoursApprovalPage = () => {
  const { isDarkMode } = useThemeStore();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);

  // Approve / Reject modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isApproval, setIsApproval] = useState(true);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchRequests(); }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await timerRequestService.getAccountsPendingRequests();
      setRequests(res.data.data || []);
    } catch (err) {
      message.error('Failed to load additional hours requests');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (record, approve) => {
    setSelectedRequest(record);
    setIsApproval(approve);
    setComment('');
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedRequest) return;
    setSubmitting(true);
    try {
      await timerRequestService.accountsRespondToRequest(selectedRequest.request.requestId, {
        approved: isApproval,
        comments: comment,
      });
      if (isApproval) {
        message.success('Approved! HR and PM have been notified to reassign the employee\'s daily quota.');
      } else {
        message.success('Rejected. Employee has been notified.');
      }
      setIsModalOpen(false);
      fetchRequests();
    } catch (err) {
      message.error('Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const totalHours = requests.reduce((s, r) => s + Number(r.request?.requestedHours || 0), 0);

  const columns = [
    {
      title: 'Employee',
      dataIndex: 'employeeName',
      key: 'employeeName',
      render: (name) => (
        <Space>
          <UserOutlined style={{ color: '#6366f1' }} />
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
      title: 'Ticket',
      key: 'ticket',
      render: (_, r) => (
        <div>
          <Text code style={{ fontSize: 11 }}>{r.ticketCode}</Text>
          <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{r.ticketTitle}</div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: ['request', 'requestType'],
      key: 'requestType',
      render: (t) => (
        <Tag color={t === 'TimerMissed' ? 'volcano' : 'purple'}>
          {t === 'TimerMissed' ? 'Timer Missed' : 'Extra Hours'}
        </Tag>
      ),
    },
    {
      title: 'Extra Hours',
      dataIndex: ['request', 'requestedHours'],
      key: 'requestedHours',
      align: 'center',
      render: (h) => (
        <div style={{
          background: 'rgba(99,102,241,0.1)', color: '#6366f1',
          borderRadius: 20, padding: '2px 12px', fontWeight: 700, fontSize: 13, display: 'inline-block',
        }}>
          +{h}h
        </div>
      ),
    },
    {
      title: 'Reason & Notes',
      key: 'reason',
      render: (_, r) => (
        <div>
          <div style={{ fontSize: 12 }}>{r.request?.reason}</div>
          {r.request?.comments && (
            <div style={{ fontSize: 11, color: '#d97706', marginTop: 4, fontStyle: 'italic' }}>
              Notes: {r.request.comments}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => handleOpenModal(record, true)}
            style={{ background: '#10b981', borderColor: '#10b981', borderRadius: 6 }}
          >
            Approve
          </Button>
          <Button
            type="primary"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => handleOpenModal(record, false)}
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
        title="Additional Hours Budget Approval"
        subtitle="Review and approve or reject additional hours requests forwarded by Project Managers"
        breadcrumbs={[{ label: 'Accounts' }, { label: 'Additional Hours Approval' }]}
      />

      {/* Workflow banner */}
      <Alert
        message={
          <span>
            <strong>Approval Workflow:</strong> Employee → Team Lead → Project Manager →{' '}
            <strong style={{ color: '#6366f1' }}>Accounts (you)</strong> → HR/PM reassigns quota → Employee can submit EOD
          </span>
        }
        type="info"
        showIcon
        style={{ borderRadius: 10 }}
      />

      {/* Stats */}
      {!loading && requests.length > 0 && (
        <Row gutter={16}>
          <Col xs={12} sm={8}>
            <Card style={{ borderRadius: 12, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.05)' }}
              bodyStyle={{ padding: '16px 20px' }}>
              <Statistic
                title={<Text style={{ fontSize: 12 }}>Pending Requests</Text>}
                value={requests.length}
                prefix={<FileTextOutlined style={{ color: '#6366f1' }} />}
                valueStyle={{ color: '#6366f1', fontWeight: 800 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8}>
            <Card style={{ borderRadius: 12, border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.05)' }}
              bodyStyle={{ padding: '16px 20px' }}>
              <Statistic
                title={<Text style={{ fontSize: 12 }}>Total Extra Hours Requested</Text>}
                value={totalHours.toFixed(1)}
                suffix="hrs"
                prefix={<ClockCircleOutlined style={{ color: '#f59e0b' }} />}
                valueStyle={{ color: '#f59e0b', fontWeight: 800 }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Spin size="large" tip="Loading requests..." />
        </div>
      ) : requests.length === 0 ? (
        <Card style={{ borderRadius: 16, textAlign: 'center', padding: 40 }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#10b981', marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>All Clear!</div>
          <Text type="secondary">No pending additional hours requests from any Project Manager.</Text>
        </Card>
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

      {/* Approve / Reject Modal */}
      <Modal
        title={
          <Space>
            {isApproval
              ? <CheckCircleOutlined style={{ color: '#10b981' }} />
              : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
            <span>{isApproval ? 'Approve' : 'Reject'} Additional Hours Request</span>
          </Space>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText={isApproval ? 'Approve & Notify HR/PM' : 'Reject Request'}
        okType={isApproval ? 'primary' : 'danger'}
        okButtonProps={isApproval ? { style: { background: '#10b981', borderColor: '#10b981' } } : {}}
        cancelText="Cancel"
        destroyOnClose
      >
        {/* Request summary */}
        <div style={{
          background: isApproval ? 'rgba(16,185,129,0.05)' : '#fff1f0',
          border: `1px solid ${isApproval ? 'rgba(16,185,129,0.2)' : '#ffa39e'}`,
          borderRadius: 10, padding: 14, marginBottom: 16,
        }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Request Details</Text>
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Text strong>{selectedRequest?.employeeName}</Text>
            {selectedRequest?.projectName && (
              <Text strong style={{ color: '#6366f1', fontSize: 12 }}>Project: {selectedRequest.projectName}</Text>
            )}
            <Text style={{ fontSize: 12 }}>{selectedRequest?.ticketCode} — {selectedRequest?.ticketTitle}</Text>
            <div style={{ marginTop: 6 }}>
              <Tag color="purple" style={{ fontWeight: 700 }}>
                Extra Hours: +{selectedRequest?.request?.requestedHours}h
              </Tag>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>Reason: "{selectedRequest?.request?.reason}"</Text>
            {selectedRequest?.request?.comments && (
              <Text style={{ fontSize: 12, color: '#d97706', fontStyle: 'italic' }}>
                Chain notes: {selectedRequest?.request?.comments}
              </Text>
            )}
          </Space>
        </div>

        {isApproval && (
          <Alert
            message="Approving will notify HR and Project Manager to update this employee's daily quota so they can submit their EOD."
            type="success"
            showIcon
            style={{ borderRadius: 8, marginBottom: 12 }}
          />
        )}

        <Text strong>Accounts {isApproval ? 'Approval' : 'Rejection'} Notes</Text>
        <TextArea
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={isApproval
            ? 'Optional: Add budget notes or conditions...'
            : 'Explain why this additional budget cannot be approved...'}
          style={{ marginTop: 8 }}
        />
      </Modal>
    </div>
  );
};

export default AccountsHoursApprovalPage;
