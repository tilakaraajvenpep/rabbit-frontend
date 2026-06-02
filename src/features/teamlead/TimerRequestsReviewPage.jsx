import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Typography, Tag, Modal, Input, message, Spin, Empty, Tooltip, Tabs, Badge } from 'antd';
import {
  ClockCircleOutlined, SendOutlined, CheckCircleOutlined, CloseCircleOutlined,
  UserOutlined, TeamOutlined, FileTextOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { timerRequestService } from '../../services/timerRequestService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Text } = Typography;
const { TextArea } = Input;

/* ─── tiny helpers ──────────────────────────────────────────────── */
const Avatar = ({ name, color }) => {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%',
      background: color || 'linear-gradient(135deg,#4f46e5,#7c3aed)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0,
    }}>{initials}</div>
  );
};

const MetricCard = ({ icon, label, value, color, bg }) => (
  <div style={{
    background: bg, border: `1px solid ${color}30`,
    borderRadius: 16, padding: '18px 22px',
    flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 16,
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
  }}>
    <div style={{
      width: 46, height: 46, borderRadius: 12,
      background: `${color}15`, display: 'flex', alignItems: 'center',
      justifyContent: 'center', color, fontSize: 20,
    }}>{icon}</div>
    <div>
      <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, color: '#0f172a' }}>{value}</div>
    </div>
  </div>
);

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

/* ─── main component ─────────────────────────────────────────────── */
const TimerRequestsReviewPage = () => {
  const { isDarkMode } = useThemeStore();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);

  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [forwardComment, setForwardComment] = useState('');
  const [forwarding, setForwarding] = useState(false);

  const [isRespondModalOpen, setIsRespondModalOpen] = useState(false);
  const [isApproval, setIsApproval] = useState(true);
  const [tlComment, setTlComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchTLRequests();
    fetchHistory();
  }, []);

  const fetchTLRequests = async () => {
    setLoading(true);
    try {
      const res = await timerRequestService.getTLPendingRequests();
      setRequests(res.data.data || []);
    } catch { message.error('Failed to load pending timer requests'); }
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

  const handleForwardSubmit = async () => {
    if (!selectedRequest) return;
    setForwarding(true);
    try {
      await timerRequestService.forwardToPM(selectedRequest.request.requestId, { comments: forwardComment });
      message.success('Request forwarded to Project Manager!');
      setIsForwardModalOpen(false);
      fetchTLRequests();
      fetchHistory();
    } catch { message.error('Failed to forward request'); }
    finally { setForwarding(false); }
  };

  const handleRespondSubmit = async () => {
    if (!selectedRequest) return;
    setSubmitting(true);
    try {
      await timerRequestService.respondToRequest(selectedRequest.request.requestId, { approved: isApproval, comments: tlComment });
      message.success(`Request ${isApproval ? 'Approved' : 'Rejected'} successfully! Employee has been notified.`);
      setIsRespondModalOpen(false);
      fetchTLRequests();
      fetchHistory();
    } catch (err) { message.error(err?.response?.data?.message || 'Failed to submit response'); }
    finally { setSubmitting(false); }
  };

  const totalApprovedHours = Array.isArray(history) 
    ? history
        .filter(r => ['PendingPM', 'PendingAccounts', 'AccountsApproved', 'Approved'].includes(r?.request?.status))
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
          <Avatar name={r.employeeName} />
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
            <Tag color={Number(r.bufferHours || 0) > 0 ? 'cyan' : 'red'} style={{ border: 'none', fontWeight: 600, fontSize: 10, padding: '1px 6px', borderRadius: 10 }}>
              Buffer: {r.bufferHours || '0.00'}h
            </Tag>
          </div>
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
          {type === 'TimerMissed' ? '⏱ Timer Missed' : '⚡ Hours Exceeded'}
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
      title: 'Reason',
      dataIndex: ['request', 'reason'],
      key: 'reason',
      render: (r) => <Text type="secondary" style={{ fontSize: 12 }}>{r}</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 260,
      render: (_, record) => {
        return (
          <Space size={6}>
            <Button
              size="small"
              onClick={() => { setSelectedRequest(record); setForwardComment(''); setIsForwardModalOpen(true); }}
              style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', border: 'none', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 12 }}
              icon={<SendOutlined />}
            >Forward PM</Button>
            <Button
              size="small"
              onClick={() => { setSelectedRequest(record); setIsApproval(false); setTlComment(''); setIsRespondModalOpen(true); }}
              style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 12 }}
              icon={<CloseCircleOutlined />}
            >Reject</Button>
          </Space>
        );
      },
    },
  ];

  const historyColumns = [
    {
      title: 'Employee',
      key: 'employee',
      width: 180,
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={r.employeeName} />
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
        <Avatar name={req?.employeeName} />
        <div>
          <div style={{ fontWeight: 700 }}>{req?.employeeName}</div>
          <div style={{ fontSize: 12, color: '#6366f1' }}>{req?.projectName}</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#64748b' }}>
        <span style={{ background: '#f1f5f9', padding: '1px 7px', borderRadius: 5, fontFamily: 'monospace', marginRight: 6 }}>{req?.ticketCode}</span>
        {req?.ticketTitle}
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        <Tag color="purple" style={{ borderRadius: 20, border: 'none', fontWeight: 700 }}>+{req?.request?.requestedHours}h requested</Tag>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#475569', fontStyle: 'italic' }}>"{req?.request?.reason}"</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Review Employee Hours Requests"
        subtitle="Review and approve, reject, or forward additional hour requests from your team"
      />

      {/* Workflow stepper */}
      <div style={{ ...cardBase, padding: '20px 28px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Approval Workflow</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <WorkflowStep step={1} label="Employee" done />
          <WorkflowLine done />
          <WorkflowStep step={2} label="Team Lead" active />
          <WorkflowLine />
          <WorkflowStep step={3} label="Project Manager" />
          <WorkflowLine />
          <WorkflowStep step={4} label="Accounts" />
          <WorkflowLine />
          <WorkflowStep step={5} label="HR / Quota" />
        </div>
      </div>

      {/* Metric cards */}
      {!loading && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <MetricCard icon={<FileTextOutlined />} label="Pending Requests" value={requests.length} color="#6366f1" bg={isDarkMode ? '#18181b' : '#fafafa'} />
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
                Pending Requests <Badge count={requests.length} style={{ backgroundColor: '#6366f1', marginLeft: 4 }} />
              </span>
            ),
            children: loading ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <Spin size="large" />
                <div style={{ marginTop: 16, color: '#94a3b8' }}>Loading requests…</div>
              </div>
            ) : requests.length === 0 ? (
              <div style={{ ...cardBase, padding: '60px 24px', textAlign: 'center' }}>
                <CheckCircleOutlined style={{ fontSize: 48, color: '#10b981', marginBottom: 12 }} />
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>All Clear!</div>
                <Text type="secondary">No pending additional hours requests from your team.</Text>
              </div>
            ) : (
              <div style={cardBase}>
                <Table
                  columns={columns}
                  dataSource={requests}
                  rowKey={(r) => r.request.requestId}
                  pagination={{ pageSize: 10, style: { padding: '0 20px 16px' } }}
                  style={{ borderRadius: 16 }}
                  rowClassName={() => 'timer-row'}
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

      {/* Forward to PM Modal */}
      <Modal
        title={<Space><SendOutlined style={{ color: '#6366f1' }} /><span style={{ fontWeight: 700 }}>Forward to Project Manager</span></Space>}
        open={isForwardModalOpen}
        onCancel={() => setIsForwardModalOpen(false)}
        onOk={handleForwardSubmit}
        confirmLoading={forwarding}
        okText="Forward to PM"
        okButtonProps={{ style: { background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none', borderRadius: 8, fontWeight: 600 } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        destroyOnClose
      >
        <ModalDetail req={selectedRequest} />
        <Text strong>Add Recommendation / Comment</Text>
        <TextArea
          rows={4} value={forwardComment}
          onChange={(e) => setForwardComment(e.target.value)}
          placeholder="Write your recommendation to help the Project Manager review this request…"
          style={{ marginTop: 8, borderRadius: 10 }}
        />
      </Modal>

      {/* Approve / Reject Modal */}
      <Modal
        title={
          <Space>
            {isApproval
              ? <CheckCircleOutlined style={{ color: '#10b981' }} />
              : <CloseCircleOutlined style={{ color: '#ef4444' }} />}
            <span style={{ fontWeight: 700 }}>{isApproval ? 'Approve' : 'Reject'} Hours Request</span>
          </Space>
        }
        open={isRespondModalOpen}
        onCancel={() => setIsRespondModalOpen(false)}
        onOk={handleRespondSubmit}
        confirmLoading={submitting}
        okText={isApproval ? 'Approve Request' : 'Reject Request'}
        okButtonProps={{
          style: {
            background: isApproval ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#ef4444,#dc2626)',
            border: 'none', borderRadius: 8, fontWeight: 600,
          },
        }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        destroyOnClose
      >
        <ModalDetail req={selectedRequest} />
        <Text strong>Team Lead Comments</Text>
        <TextArea
          rows={4} value={tlComment}
          onChange={(e) => setTlComment(e.target.value)}
          placeholder="Provide remarks to the employee…"
          style={{ marginTop: 8, borderRadius: 10 }}
        />
      </Modal>
    </div>
  );
};

export default TimerRequestsReviewPage;
