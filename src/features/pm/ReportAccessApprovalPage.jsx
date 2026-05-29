import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Typography, Tag, Modal, Input, message, Spin, Empty, Tabs, Badge } from 'antd';
import { CalendarOutlined, CheckCircleOutlined, CloseCircleOutlined, SendOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { reportAccessService } from '../../services/reportAccessService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import dayjs from 'dayjs';

const { Text } = Typography;
const { TextArea } = Input;

/* ─── workflow steppers ──────────────────────────────────────────── */
const WorkflowStep = ({ step, label, active, done }) => {
  const color = done ? '#10b981' : active ? '#6366f1' : '#cbd5e1';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: done ? '#10b981' : active ? '#6366f1' : '#f1f5f9',
        border: `2px solid ${color}`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: done || active ? '#fff' : '#94a3b8',
        fontWeight: 700, fontSize: 11,
      }}>{step}</div>
      <span style={{ fontSize: 12, fontWeight: active || done ? 700 : 500, color: active || done ? '#1e293b' : '#94a3b8' }}>{label}</span>
    </div>
  );
};

const WorkflowLine = ({ done }) => (
  <div style={{
    flex: 1, height: 2, margin: '0 8px',
    background: done ? '#10b981' : '#e2e8f0', minWidth: 20,
  }} />
);

const ReportAccessApprovalPage = () => {
  const { isDarkMode } = useThemeStore();
  const { role } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Modal Actions State
  const [isRespondModalOpen, setIsRespondModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [modalAction, setModalAction] = useState('approve'); // 'approve' | 'reject' | 'forward_pm' | 'forward_hr'
  const [reviewerComment, setReviewerComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRequests();
    fetchHistory();
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

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await reportAccessService.getHistoryRequests();
      setHistory(res.data || []);
    } catch (err) {
      message.error('Failed to load history logs');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenModal = (record, action) => {
    setSelectedRequest(record);
    setModalAction(action);
    setReviewerComment('');
    setIsRespondModalOpen(true);
  };

  const handleRespondSubmit = async () => {
    if (!selectedRequest) return;
    setSubmitting(true);
    try {
      if (modalAction === 'forward_pm') {
        await reportAccessService.forwardToPM(selectedRequest.requestId, reviewerComment);
        message.success('Request forwarded to Project Manager!');
      } else if (modalAction === 'forward_hr') {
        await reportAccessService.forwardToHR(selectedRequest.requestId, reviewerComment);
        message.success('Request forwarded to HR!');
      } else if (modalAction === 'approve') {
        await reportAccessService.respond(selectedRequest.requestId, true, reviewerComment);
        message.success('Request approved successfully! Employee has been notified.');
      } else if (modalAction === 'reject') {
        await reportAccessService.respond(selectedRequest.requestId, false, reviewerComment);
        message.success('Request rejected successfully. Employee has been notified.');
      }
      setIsRespondModalOpen(false);
      fetchRequests();
      fetchHistory();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const getModalTitleAndIcon = () => {
    switch (modalAction) {
      case 'forward_pm':
        return {
          title: 'Recommend & Forward to PM',
          icon: <SendOutlined style={{ color: '#10b981' }} />,
          okText: 'Forward to PM',
          okStyle: { background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 8, fontWeight: 600 }
        };
      case 'forward_hr':
        return {
          title: 'Recommend & Forward to HR',
          icon: <SendOutlined style={{ color: '#6366f1' }} />,
          okText: 'Forward to HR',
          okStyle: { background: 'linear-gradient(135deg,#6366f1,#7c3aed)', border: 'none', borderRadius: 8, fontWeight: 600 }
        };
      case 'approve':
        return {
          title: 'Approve Access Request',
          icon: <CheckCircleOutlined style={{ color: '#10b981' }} />,
          okText: 'Approve Request',
          okStyle: { background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 8, fontWeight: 600 }
        };
      case 'reject':
      default:
        return {
          title: 'Reject Access Request',
          icon: <CloseCircleOutlined style={{ color: '#ef4444' }} />,
          okText: 'Reject Request',
          okStyle: { background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', borderRadius: 8, fontWeight: 600 }
        };
    }
  };

  const modalConfig = getModalTitleAndIcon();

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
        <Tag color="blue" icon={<CalendarOutlined />} style={{ borderRadius: 6, fontWeight: 600, padding: '2px 8px' }}>
          {dayjs(date).format('DD MMM YYYY')} ({dayjs(date).format('dddd')})
        </Tag>
      )
    },
    {
      title: 'Reason / History Remarks',
      key: 'reason',
      render: (_, record) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div><Text type="secondary">{record.reason}</Text></div>
          {record.reviewerComments && (
            <div>
              <Tag color="orange" style={{ border: 'none', borderRadius: 6, fontSize: 11, padding: '2px 8px' }}>
                Reviewer Notes: {record.reviewerComments}
              </Tag>
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => {
        if (role === 'TeamLead') {
          return (
            <Space>
              <Button 
                type="primary" 
                icon={<SendOutlined />}
                onClick={() => handleOpenModal(record, 'forward_pm')}
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)', borderColor: 'transparent', borderRadius: 8, fontWeight: 600 }}
              >
                Forward PM
              </Button>
              <Button 
                type="primary" 
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleOpenModal(record, 'reject')}
                style={{ borderRadius: 8, fontWeight: 600 }}
              >
                Reject
              </Button>
            </Space>
          );
        } else if (role === 'ProjectManager') {
          return (
            <Space>
              <Button 
                type="primary" 
                icon={<SendOutlined />}
                onClick={() => handleOpenModal(record, 'forward_hr')}
                style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)', borderColor: 'transparent', borderRadius: 8, fontWeight: 600 }}
              >
                Forward HR
              </Button>
              <Button 
                type="primary" 
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleOpenModal(record, 'reject')}
                style={{ borderRadius: 8, fontWeight: 600 }}
              >
                Reject
              </Button>
            </Space>
          );
        } else if (role === 'HR') {
          return (
            <Space>
              <Button 
                type="primary" 
                icon={<CheckCircleOutlined />}
                onClick={() => handleOpenModal(record, 'approve')}
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)', borderColor: 'transparent', borderRadius: 8, fontWeight: 600 }}
              >
                Approve
              </Button>
              <Button 
                type="primary" 
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleOpenModal(record, 'reject')}
                style={{ borderRadius: 8, fontWeight: 600 }}
              >
                Reject
              </Button>
            </Space>
          );
        } else {
          // Others
          return (
            <Space>
              <Button 
                type="primary" 
                icon={<CheckCircleOutlined />}
                onClick={() => handleOpenModal(record, 'approve')}
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)', borderColor: 'transparent', borderRadius: 8, fontWeight: 600 }}
              >
                Approve
              </Button>
              <Button 
                type="primary" 
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleOpenModal(record, 'reject')}
                style={{ borderRadius: 8, fontWeight: 600 }}
              >
                Reject
              </Button>
            </Space>
          );
        }
      }
    }
  ];

  const historyColumns = [
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
        <Tag color="blue" icon={<CalendarOutlined />} style={{ borderRadius: 6, fontWeight: 600, padding: '2px 8px' }}>
          {dayjs(date).format('DD MMM YYYY')} ({dayjs(date).format('dddd')})
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
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const conf = {
          PendingTL: { color: 'orange', label: 'Pending TL' },
          PendingPM: { color: 'blue', label: 'Pending PM' },
          PendingHR: { color: 'purple', label: 'Pending HR' },
          Approved: { color: 'green', label: 'Approved' },
          Rejected: { color: 'red', label: 'Rejected' },
        }[status] || { color: 'default', label: status };
        return <Tag color={conf.color} style={{ borderRadius: 10, fontWeight: 700, textTransform: 'uppercase', fontSize: 10, border: 'none', padding: '2px 10px' }}>{conf.label}</Tag>;
      }
    },
    {
      title: 'Remarks / Comments',
      dataIndex: 'reviewerComments',
      key: 'reviewerComments',
      render: (c) => c ? <Text italic type="secondary">"{c}"</Text> : <Text type="secondary">—</Text>
    }
  ];

  const cardBase = { 
    borderRadius: 16, 
    overflow: 'hidden', 
    background: isDarkMode ? '#18181b' : '#fff', 
    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.07)' : '#f1f5f9'}` 
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader 
        title="Approve Report Access Requests" 
        subtitle="Manage requests from employees seeking access to submit daily EOD reports outside the current work week."
      />

      {/* Dynamic Stepper */}
      <div style={{ ...cardBase, padding: '20px 28px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Approval Workflow</div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <WorkflowStep step={1} label="Employee" done />
          <WorkflowLine done />
          <WorkflowStep step={2} label="Team Lead" active={role === 'TeamLead'} done={role !== 'TeamLead'} />
          <WorkflowLine done={role !== 'TeamLead'} />
          <WorkflowStep step={3} label="Project Manager" active={role === 'ProjectManager'} done={role !== 'TeamLead' && role !== 'ProjectManager'} />
          <WorkflowLine done={role !== 'TeamLead' && role !== 'ProjectManager'} />
          <WorkflowStep step={4} label="HR" active={role === 'HR'} />
        </div>
      </div>

      {/* Tabs Layout */}
      <Tabs
        defaultActiveKey="1"
        style={{ marginTop: 8 }}
        items={[
          {
            key: '1',
            label: (
              <span style={{ fontWeight: 700, padding: '0 8px' }}>
                Pending Requests <Badge count={requests.length} style={{ backgroundColor: '#6366f1', marginLeft: 4 }} />
              </span>
            ),
            children: loading ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <Spin size="large" tip="Loading requests..." />
              </div>
            ) : requests.length === 0 ? (
              <div style={{ ...cardBase, padding: '60px 24px', textAlign: 'center' }}>
                <CheckCircleOutlined style={{ fontSize: 48, color: '#10b981', marginBottom: 12 }} />
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Queue Clear!</div>
                <Text type="secondary">No pending report access requests to review.</Text>
              </div>
            ) : (
              <Card style={cardBase}>
                <Table 
                  columns={columns}
                  dataSource={requests}
                  rowKey={(r) => r.requestId}
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            )
          },
          {
            key: '2',
            label: (
              <span style={{ fontWeight: 700, padding: '0 8px' }}>
                History Logs <Badge count={history.length} style={{ backgroundColor: '#ec4899', marginLeft: 4 }} />
              </span>
            ),
            children: historyLoading ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <Spin size="large" tip="Loading history..." />
              </div>
            ) : history.length === 0 ? (
              <div style={{ ...cardBase, padding: '60px 24px', textAlign: 'center' }}>
                <Empty description="No historical requests found." />
              </div>
            ) : (
              <Card style={cardBase}>
                <Table 
                  columns={historyColumns}
                  dataSource={history}
                  rowKey={(r) => r.requestId}
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            )
          }
        ]}
      />

      {/* Dynamic Respond/Forward Modal */}
      <Modal
        title={
          <Space>
            {modalConfig.icon}
            <span style={{ fontWeight: 700 }}>{modalConfig.title}</span>
          </Space>
        }
        open={isRespondModalOpen}
        onCancel={() => setIsRespondModalOpen(false)}
        onOk={handleRespondSubmit}
        confirmLoading={submitting}
        okText={modalConfig.okText}
        okButtonProps={{ style: modalConfig.okStyle }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        destroyOnClose
      >
        <div style={{ 
          marginBottom: 16, 
          background: isDarkMode ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc', 
          border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#e2e8f0'}`,
          padding: 14, 
          borderRadius: 12,
          marginTop: 10
        }}>
          <Text type="secondary" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Employee Details</Text>
          <Text strong style={{ fontSize: 14 }}>{selectedRequest?.employeeName}</Text> <span style={{ color: '#94a3b8' }}>({selectedRequest?.employeeEmail})</span>
          
          <div style={{ marginTop: 10 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Requested Date: </Text>
            <Text strong style={{ fontSize: 12, color: '#6366f1' }}>
              {selectedRequest ? dayjs(selectedRequest.targetDate).format('dddd, DD MMMM YYYY') : ''}
            </Text>
          </div>
          
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Reason: </Text>
            <Text italic style={{ fontSize: 12, color: isDarkMode ? '#dfdfdf' : '#333' }}>"{selectedRequest?.reason}"</Text>
          </div>

          {selectedRequest?.reviewerComments && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Previous Notes: </Text>
              <Text strong style={{ fontSize: 12, color: '#d97706' }}>{selectedRequest.reviewerComments}</Text>
            </div>
          )}
        </div>

        <Text strong>Add Recommendation Remarks / Feedback</Text>
        <TextArea
          rows={4}
          value={reviewerComment}
          onChange={(e) => setReviewerComment(e.target.value)}
          placeholder="Provide context or comments for this action..."
          style={{ marginTop: 8, borderRadius: 10 }}
        />
      </Modal>
    </div>
  );
};

export default ReportAccessApprovalPage;
