import { Table, Button, Space, Typography, Tag, Modal, Input, message, Spin, Tabs, Badge, Empty } from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, DollarOutlined,
  ClockCircleOutlined, FileTextOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { timerRequestService } from '../../services/timerRequestService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Text } = Typography;
const { TextArea } = Input;

const Avatar = ({ name }) => {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%',
      background: 'linear-gradient(135deg,#10b981,#059669)',
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
      color: done || active ? '#fff' : '#94a3b8', fontWeight: 700, fontSize: 13,
    }}>{done ? '✓' : step}</div>
    <span style={{ fontSize: 11, color: active ? '#4f46e5' : done ? '#10b981' : '#94a3b8', fontWeight: active ? 700 : 500 }}>{label}</span>
  </div>
);
const WorkflowLine = ({ done }) => (
  <div style={{ flex: 1, height: 2, background: done ? '#10b981' : '#e2e8f0', marginBottom: 20, borderRadius: 2 }} />
);

const AccountsHoursApprovalPage = () => {
  const { isDarkMode } = useThemeStore();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isApproval, setIsApproval] = useState(true);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchRequests();
    fetchHistory();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await timerRequestService.getAccountsPendingRequests();
      setRequests(res.data.data || []);
    } catch { message.error('Failed to load additional hours requests'); }
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

  const handleSubmit = async () => {
    if (!selectedRequest) return;
    setSubmitting(true);
    try {
      await timerRequestService.accountsRespondToRequest(selectedRequest.request.requestId, { approved: isApproval, comments: comment });
      message.success(isApproval
        ? 'Approved! HR and PM have been notified to reassign the employee\'s daily quota.'
        : 'Rejected. Employee has been notified.');
      setIsModalOpen(false);
      fetchRequests();
      fetchHistory();
    } catch { message.error('Failed to submit response'); }
    finally { setSubmitting(false); }
  };

  const totalHours = requests.reduce((s, r) => s + Number(r.request?.requestedHours || 0), 0);
  const exceeded   = requests.filter(r => r.request?.requestType === 'HoursExceeded').length;

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
      render: (t) => (
        <Tag style={{
          borderRadius: 20, fontWeight: 600, fontSize: 11, padding: '3px 12px', border: 'none',
          background: t === 'TimerMissed' ? '#fff7ed' : '#f5f3ff',
          color: t === 'TimerMissed' ? '#c2410c' : '#7c3aed',
        }}>
          {t === 'TimerMissed' ? '⏱ Timer Missed' : '⚡ Extra Hours'}
        </Tag>
      ),
    },
    {
      title: 'Extra Hours',
      dataIndex: ['request', 'requestedHours'],
      key: 'requestedHours',
      width: 110,
      align: 'center',
      render: (h) => (
        <div style={{ background: 'rgba(16,185,129,0.1)', color: '#059669', borderRadius: 10, padding: '4px 12px', fontWeight: 800, fontSize: 15, display: 'inline-block' }}>
          +{h}h
        </div>
      ),
    },
    {
      title: 'Reason & Notes',
      key: 'reason',
      render: (_, r) => (
        <div>
          <div style={{ fontSize: 12, color: '#475569' }}>{r.request?.reason}</div>
          {r.request?.comments && (
            <div style={{ marginTop: 4, fontSize: 11, color: '#d97706', fontStyle: 'italic', background: '#fffbeb', padding: '2px 8px', borderRadius: 6, display: 'inline-block' }}>
              Chain: {r.request.comments}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space size={6}>
          <Button
            size="small"
            onClick={() => { setSelectedRequest(record); setIsApproval(true); setComment(''); setIsModalOpen(true); }}
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 12 }}
            icon={<CheckCircleOutlined />}
          >Approve</Button>
          <Button
            size="small"
            onClick={() => { setSelectedRequest(record); setIsApproval(false); setComment(''); setIsModalOpen(true); }}
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
          <Avatar name={r.employeeName} />
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

  const ModalDetail = ({ req, isApproval }) => (
    <div style={{
      background: isApproval ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)',
      border: `1px solid ${isApproval ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
      borderRadius: 12, padding: 14, marginBottom: 16,
    }}>
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
      <div style={{ marginTop: 8 }}>
        <Tag color="green" style={{ borderRadius: 20, border: 'none', fontWeight: 700 }}>+{req?.request?.requestedHours}h extra hours</Tag>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#475569', fontStyle: 'italic' }}>"{req?.request?.reason}"</div>
      {req?.request?.comments && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#d97706', fontStyle: 'italic' }}>Chain notes: {req?.request?.comments}</div>
      )}
      {isApproval && (
        <div style={{ marginTop: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#166534' }}>
          ✅ Approving will notify HR and PM to update this employee's daily quota so they can submit their EOD.
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Additional Hours Budget Approval"
        subtitle="Review and approve or reject additional hours requests forwarded by Project Managers"
        breadcrumbs={[{ label: 'Accounts' }, { label: 'Additional Hours Approval' }]}
      />

      {/* Workflow stepper */}
      <div style={{ ...cardBase, padding: '20px 28px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Approval Workflow</div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <WorkflowStep step={1} label="Employee" done />
          <WorkflowLine done />
          <WorkflowStep step={2} label="Team Lead" done />
          <WorkflowLine done />
          <WorkflowStep step={3} label="Project Manager" done />
          <WorkflowLine done />
          <WorkflowStep step={4} label="Accounts" active />
          <WorkflowLine />
          <WorkflowStep step={5} label="HR / Quota" />
        </div>
      </div>

      {/* Metric cards */}
      {!loading && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <MetricCard icon={<FileTextOutlined />} label="Pending Requests" value={requests.length} color="#6366f1" bg={isDarkMode ? '#18181b' : '#fafafa'} />
          <MetricCard icon={<ClockCircleOutlined />} label="Total Extra Hours" value={`${totalHours.toFixed(1)}h`} color="#f59e0b" bg={isDarkMode ? '#18181b' : '#fafafa'} />
          <MetricCard icon={<ThunderboltOutlined />} label="Hours Exceeded" value={exceeded} color="#7c3aed" bg={isDarkMode ? '#18181b' : '#fafafa'} />
          <MetricCard icon={<DollarOutlined />} label="Budget Decision Needed" value={requests.length} color="#10b981" bg={isDarkMode ? '#18181b' : '#fafafa'} />
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
                Pending Reviews <Badge count={requests.length} style={{ backgroundColor: '#6366f1', marginLeft: 4 }} />
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
                <Text type="secondary">No pending additional hours requests from any Project Manager.</Text>
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

      {/* Approve / Reject Modal */}
      <Modal
        title={
          <Space>
            {isApproval
              ? <CheckCircleOutlined style={{ color: '#10b981' }} />
              : <CloseCircleOutlined style={{ color: '#ef4444' }} />}
            <span style={{ fontWeight: 700 }}>{isApproval ? 'Approve' : 'Reject'} Additional Hours Request</span>
          </Space>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText={isApproval ? 'Approve & Notify HR/PM' : 'Reject Request'}
        okButtonProps={{
          style: {
            background: isApproval ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#ef4444,#dc2626)',
            border: 'none', borderRadius: 8, fontWeight: 600,
          },
        }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        destroyOnClose
      >
        <ModalDetail req={selectedRequest} isApproval={isApproval} />
        <Text strong>Accounts {isApproval ? 'Approval' : 'Rejection'} Notes</Text>
        <TextArea
          rows={3} value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={isApproval ? 'Optional: Add budget notes or conditions…' : 'Explain why this additional budget cannot be approved…'}
          style={{ marginTop: 8, borderRadius: 10 }}
        />
      </Modal>
    </div>
  );
};

export default AccountsHoursApprovalPage;
