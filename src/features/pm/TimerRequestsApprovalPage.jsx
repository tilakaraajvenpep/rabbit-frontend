import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Typography, Tag, Modal, Input, message, Spin, Tabs, Badge, Empty } from 'antd';
import {
  CloseCircleOutlined, DollarOutlined, CheckCircleOutlined,
  ClockCircleOutlined, FileTextOutlined, UserOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { timerRequestService } from '../../services/timerRequestService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Text } = Typography;
const { TextArea } = Input;

const Avatar = ({ name, color }) => {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%',
      background: color || 'linear-gradient(135deg,#6366f1,#7c3aed)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0,
    }}>{initials}</div>
  );
};

const MetricCard = ({ icon, label, value, color, bg }) => (
  <div style={{
    background: bg, border: `1px solid ${color}30`,
    borderRadius: 16, padding: '18px 22px',
    display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 140,
  }}>
    <div style={{
      width: 44, height: 44, borderRadius: 12, background: `${color}18`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color,
    }}>{icon}</div>
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{label}</div>
    </div>
  </div>
);

const WorkflowStep = ({ step, label, active, done }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: done ? '#10b981' : active ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#e2e8f0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: done || active ? '#fff' : '#94a3b8', fontWeight: 700, fontSize: 13, transition: 'all .3s',
    }}>{done ? '✓' : step}</div>
    <span style={{ fontSize: 11, color: active ? '#4f46e5' : done ? '#10b981' : '#94a3b8', fontWeight: active ? 700 : 500 }}>{label}</span>
  </div>
);
const WorkflowLine = ({ done }) => (
  <div style={{ flex: 1, height: 2, background: done ? '#10b981' : '#e2e8f0', marginBottom: 20, borderRadius: 2, transition: 'background .3s' }} />
);

const TimerRequestsApprovalPage = () => {
  const { isDarkMode } = useThemeStore();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);

  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [pmComment, setPmComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchPMRequests();
    fetchHistory();
  }, []);

  const fetchPMRequests = async () => {
    setLoading(true);
    try {
      const res = await timerRequestService.getPMPendingRequests();
      setRequests(res.data.data || []);
    } catch { message.error('Failed to load pending timer approvals'); }
    finally { setLoading(false); }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await timerRequestService.getHistoryRequests();
      setHistory(res.data.data || []);
    } catch { message.error('Failed to load history logs'); }
    finally { setHistoryLoading(false); }
  };

  const handleForwardToAccounts = async () => {
    if (!selectedRequest) return;
    setSubmitting(true);
    try {
      await timerRequestService.forwardToAccounts(selectedRequest.request.requestId, { comments: pmComment });
      message.success('Request forwarded to Accounts for budget approval!');
      setIsForwardModalOpen(false);
      fetchPMRequests();
      fetchHistory();
    } catch { message.error('Failed to forward request'); }
    finally { setSubmitting(false); }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    setRejecting(true);
    try {
      await timerRequestService.respondToRequest(selectedRequest.request.requestId, { approved: false, comments: rejectComment });
      message.success('Request rejected. Employee has been notified.');
      setIsRejectModalOpen(false);
      fetchPMRequests();
      fetchHistory();
    } catch { message.error('Failed to reject request'); }
    finally { setRejecting(false); }
  };

  const totalApprovedHours = Array.isArray(history) 
    ? history
        .filter(r => ['Approved', 'AccountsApproved', 'PendingAccounts'].includes(r?.request?.status))
        .reduce((s, r) => s + Number(r?.request?.requestedHours || 0), 0)
    : 0;

  const cardBase = { borderRadius: 16, overflow: 'hidden', background: isDarkMode ? '#18181b' : '#fff', border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.07)' : '#f1f5f9'}` };

  const columns = [
    {
      title: 'Employee',
      key: 'employee',
      width: 180,
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={r.employeeName} color="linear-gradient(135deg,#6366f1,#8b5cf6)" />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{r.employeeName}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Employee</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Project & Ticket',
      key: 'project',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#6366f1', fontSize: 13 }}>{r.projectName || '—'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ background: '#f1f5f9', color: '#475569', fontSize: 11, padding: '1px 7px', borderRadius: 5, fontFamily: 'monospace' }}>{r.ticketCode}</span>
            <span style={{ fontSize: 12, color: '#64748b' }}>{r.ticketTitle}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: ['request', 'requestType'],
      key: 'requestType',
      width: 140,
      render: (type) => (
        <Tag style={{
          borderRadius: 20, fontWeight: 600, fontSize: 11, padding: '3px 12px', border: 'none',
          background: type === 'TimerMissed' ? '#fff7ed' : '#f5f3ff',
          color: type === 'TimerMissed' ? '#c2410c' : '#7c3aed',
        }}>
          {type === 'TimerMissed' ? '⏱ Timer Missed' : '⚡ Extra Hours'}
        </Tag>
      ),
    },
    {
      title: 'Hours',
      dataIndex: ['request', 'requestedHours'],
      key: 'requestedHours',
      width: 100,
      align: 'center',
      render: (h) => (
        <div style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1', borderRadius: 10, padding: '4px 10px', fontWeight: 800, fontSize: 15, display: 'inline-block' }}>
          +{h}h
        </div>
      ),
    },
    {
      title: 'Reason & TL Notes',
      key: 'reason',
      render: (_, r) => (
        <div>
          <div style={{ fontSize: 12, color: '#475569' }}>{r.request?.reason}</div>
          {r.request?.comments && (
            <div style={{ marginTop: 4, fontSize: 11, color: '#d97706', fontStyle: 'italic', background: '#fffbeb', padding: '2px 8px', borderRadius: 6, display: 'inline-block' }}>
              TL: {r.request.comments}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 240,
      render: (_, record) => (
        <Space size={6}>
          <Button
            size="small"
            onClick={() => { setSelectedRequest(record); setPmComment(''); setIsForwardModalOpen(true); }}
            style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)', border: 'none', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 12 }}
            icon={<DollarOutlined />}
          >→ Accounts</Button>
          <Button
            size="small"
            onClick={() => { setSelectedRequest(record); setRejectComment(''); setIsRejectModalOpen(true); }}
            style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 12 }}
            icon={<CloseCircleOutlined />}
          >Reject</Button>
        </Space>
      ),
    },
  ];

  const historyColumns = [
    {
      title: 'Employee',
      key: 'employee',
      width: 180,
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={r.employeeName} color="linear-gradient(135deg,#6366f1,#8b5cf6)" />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{r.employeeName}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Team Member</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Project & Ticket',
      key: 'project',
      render: (_, r) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, color: '#6366f1', fontSize: 13 }}>{r.projectName || '—'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ background: '#f1f5f9', color: '#475569', fontSize: 11, padding: '1px 7px', borderRadius: 5, fontFamily: 'monospace' }}>{r.ticketCode}</span>
            <span style={{ fontSize: 12, color: '#64748b' }}>{r.ticketTitle}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Requested',
      dataIndex: ['request', 'requestedHours'],
      key: 'requestedHours',
      width: 120,
      render: (h) => <Tag color="purple" style={{ fontWeight: 700, borderRadius: 6 }}>+{h}h</Tag>,
    },
    {
      title: 'Status',
      dataIndex: ['request', 'status'],
      key: 'status',
      width: 140,
      render: (status) => {
        const conf = {
          PendingTL: { color: 'gold', label: 'Pending TL' },
          PendingPM: { color: 'blue', label: 'Pending PM' },
          PendingAccounts: { color: 'purple', label: 'Pending Accounts' },
          AccountsApproved: { color: 'cyan', label: 'Accounts Approved' },
          Approved: { color: 'green', label: 'Fully Approved' },
          Rejected: { color: 'red', label: 'Rejected' },
        }[status] || { color: 'default', label: status };
        return <Badge status={conf.color === 'green' ? 'success' : conf.color === 'red' ? 'error' : 'processing'} text={conf.label} />;
      }
    },
    {
      title: 'Comments / Reason',
      key: 'reason',
      render: (_, r) => (
        <div style={{ fontSize: 12 }}>
          <div><Text type="secondary">Reason: </Text>"{r.request?.reason}"</div>
          {r.request?.comments && <div style={{ marginTop: 2 }}><Text type="secondary">Reviewer Comments: </Text><Text italic>{r.request?.comments}</Text></div>}
        </div>
      )
    }
  ];

  const ModalDetail = ({ req }) => (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Request Summary</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
        <Avatar name={req?.employeeName} color="linear-gradient(135deg,#6366f1,#8b5cf6)" />
        <div>
          <div style={{ fontWeight: 700 }}>{req?.employeeName}</div>
          <div style={{ fontSize: 12, color: '#6366f1' }}>{req?.projectName}</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#64748b' }}>
        <span style={{ background: '#f1f5f9', padding: '1px 7px', borderRadius: 5, fontFamily: 'monospace', marginRight: 6 }}>{req?.ticketCode}</span>
        {req?.ticketTitle}
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Tag color="purple" style={{ borderRadius: 20, border: 'none', fontWeight: 700 }}>+{req?.request?.requestedHours}h requested</Tag>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#475569', fontStyle: 'italic' }}>"{req?.request?.reason}"</div>
      {req?.request?.comments && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#d97706', fontStyle: 'italic' }}>TL Notes: {req?.request?.comments}</div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Review Additional Hours Requests"
        subtitle="Review requests forwarded by team leads. Send to Accounts for budget clearance."
      />

      {/* Workflow stepper */}
      <div style={{ ...cardBase, padding: '20px 28px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Approval Workflow</div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <WorkflowStep step={1} label="Employee" done />
          <WorkflowLine done />
          <WorkflowStep step={2} label="Team Lead" done />
          <WorkflowLine done />
          <WorkflowStep step={3} label="Project Manager" active />
          <WorkflowLine />
          <WorkflowStep step={4} label="Accounts" />
          <WorkflowLine />
          <WorkflowStep step={5} label="HR / Quota" />
        </div>
      </div>

      {/* Metric cards */}
      {!loading && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <MetricCard icon={<FileTextOutlined />} label="Pending Approvals" value={requests.length} color="#6366f1" bg={isDarkMode ? '#18181b' : '#fafafa'} />
          <MetricCard icon={<ClockCircleOutlined />} label="Total Extra Hours" value={`${totalApprovedHours.toFixed(1)}h`} color="#f59e0b" bg={isDarkMode ? '#18181b' : '#fafafa'} />
        </div>
      )}

      {/* Tabs Layout */}
      <Tabs
        defaultActiveKey="1"
        style={{ marginTop: 8 }}
        items={[
          {
            key: '1',
            label: (
              <span style={{ fontWeight: 700, padding: '0 8px' }}>
                Pending Approvals <Badge count={requests.length} style={{ backgroundColor: '#6366f1', marginLeft: 4 }} />
              </span>
            ),
            children: loading ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <Spin size="large" />
                <div style={{ marginTop: 16, color: '#94a3b8' }}>Loading approvals…</div>
              </div>
            ) : requests.length === 0 ? (
              <div style={{ ...cardBase, padding: '60px 24px', textAlign: 'center' }}>
                <CheckCircleOutlined style={{ fontSize: 48, color: '#10b981', marginBottom: 12 }} />
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Queue Empty!</div>
                <Text type="secondary">No pending additional hours requests forwarded by team leads.</Text>
              </div>
            ) : (
              <div style={cardBase}>
                <Table
                  columns={columns}
                  dataSource={requests}
                  rowKey={(r) => r.request.requestId}
                  pagination={{ pageSize: 10, style: { padding: '0 20px 16px' } }}
                  style={{ borderRadius: 16 }}
                />
              </div>
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
                <Spin size="large" />
                <div style={{ marginTop: 16, color: '#94a3b8' }}>Loading history logs…</div>
              </div>
            ) : history.length === 0 ? (
              <div style={{ ...cardBase, padding: '60px 24px', textAlign: 'center' }}>
                <Empty description="No historical requests found." />
              </div>
            ) : (
              <div style={cardBase}>
                <Table
                  columns={historyColumns}
                  dataSource={history}
                  rowKey={(r) => r.request?.requestId || Math.random()}
                  pagination={{ pageSize: 10, style: { padding: '0 20px 16px' } }}
                  style={{ borderRadius: 16 }}
                />
              </div>
            )
          }
        ]}
      />

      {/* Forward to Accounts Modal */}
      <Modal
        title={<Space><DollarOutlined style={{ color: '#6366f1' }} /><span style={{ fontWeight: 700 }}>Forward to Accounts for Budget Clearance</span></Space>}
        open={isForwardModalOpen}
        onCancel={() => setIsForwardModalOpen(false)}
        onOk={handleForwardToAccounts}
        confirmLoading={submitting}
        okText="Forward to Accounts"
        okButtonProps={{ style: { background: 'linear-gradient(135deg,#6366f1,#7c3aed)', border: 'none', borderRadius: 8, fontWeight: 600 } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        destroyOnClose
      >
        <ModalDetail req={selectedRequest} />
        <Text strong>Add PM Notes for Accounts</Text>
        <TextArea
          rows={3} value={pmComment}
          onChange={(e) => setPmComment(e.target.value)}
          placeholder="Add context or budget recommendations for Accounts review…"
          style={{ marginTop: 8, borderRadius: 10 }}
        />
      </Modal>

      {/* Reject Modal */}
      <Modal
        title={<Space><CloseCircleOutlined style={{ color: '#ef4444' }} /><span style={{ fontWeight: 700 }}>Reject Additional Hours Request</span></Space>}
        open={isRejectModalOpen}
        onCancel={() => setIsRejectModalOpen(false)}
        onOk={handleReject}
        confirmLoading={rejecting}
        okText="Reject Request"
        okButtonProps={{ style: { background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', borderRadius: 8, fontWeight: 600 } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        destroyOnClose
      >
        <ModalDetail req={selectedRequest} />
        <Text strong>Rejection Reason</Text>
        <TextArea
          rows={3} value={rejectComment}
          onChange={(e) => setRejectComment(e.target.value)}
          placeholder="Explain why this request is being rejected…"
          style={{ marginTop: 8, borderRadius: 10 }}
        />
      </Modal>
    </div>
  );
};

export default TimerRequestsApprovalPage;
