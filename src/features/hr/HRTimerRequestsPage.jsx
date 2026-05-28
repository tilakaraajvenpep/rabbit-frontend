import React, { useState, useEffect } from 'react';
import { Table, Button, Typography, Tag, message, Spin } from 'antd';
import {
  CheckCircleOutlined, SettingOutlined,
  ClockCircleOutlined, FileTextOutlined, UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { timerRequestService } from '../../services/timerRequestService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Text } = Typography;

const Avatar = ({ name }) => {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%',
      background: 'linear-gradient(135deg,#10b981,#0d9488)',
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

const HRTimerRequestsPage = () => {
  const { isDarkMode } = useThemeStore();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const navigate = useNavigate();

  useEffect(() => { fetchApprovedRequests(); }, []);

  const fetchApprovedRequests = async () => {
    setLoading(true);
    try {
      const res = await timerRequestService.getHRApprovedRequests();
      setRequests(res.data.data || []);
    } catch { message.error('Failed to load approved additional hours requests'); }
    finally { setLoading(false); }
  };

  const totalHours = requests.reduce((s, r) => s + Number(r.request?.requestedHours || 0), 0);
  const roleColors = { TeamLead: '#7c3aed', ProjectManager: '#3b82f6', Employee: '#f59e0b' };

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
            <Tag style={{
              marginTop: 2, borderRadius: 20, fontSize: 10, padding: '0 8px', border: 'none',
              background: `${roleColors[r.employeeRole] || '#6366f1'}18`,
              color: roleColors[r.employeeRole] || '#6366f1',
            }}>{r.employeeRole || 'Employee'}</Tag>
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
      title: 'Current Allocation',
      dataIndex: 'currentAllocatedHours',
      key: 'currentAllocatedHours',
      width: 140,
      align: 'center',
      render: (h) => (
        <div style={{ background: 'rgba(100,116,139,0.08)', color: '#475569', borderRadius: 10, padding: '4px 10px', fontWeight: 600, fontSize: 13, display: 'inline-block' }}>
          {h || '0.00'}h/day
        </div>
      ),
    },
    {
      title: 'Approved Extra',
      dataIndex: ['request', 'requestedHours'],
      key: 'requestedHours',
      width: 130,
      align: 'center',
      render: (h) => (
        <div style={{ background: 'rgba(16,185,129,0.12)', color: '#059669', borderRadius: 10, padding: '4px 12px', fontWeight: 800, fontSize: 15, display: 'inline-block' }}>
          +{h}h
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 160,
      render: () => (
        <Tag icon={<CheckCircleOutlined />} style={{
          borderRadius: 20, fontWeight: 600, fontSize: 11, padding: '3px 12px', border: 'none',
          background: '#ecfdf5', color: '#065f46',
        }}>
          Accounts Approved
        </Tag>
      ),
    },
    {
      title: 'Action Required',
      key: 'actions',
      width: 170,
      render: (_, record) => (
        <Button
          size="small"
          onClick={() => navigate('/hr/hours')}
          style={{
            background: 'linear-gradient(135deg,#6366f1,#7c3aed)',
            border: 'none', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 12,
          }}
          icon={<SettingOutlined />}
        >
          Reallocate Hours
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Accounts Approved Additional Hours"
        subtitle="Budget has been cleared. Reallocate daily quotas so employees can submit their EOD reports."
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
          <WorkflowStep step={4} label="Accounts" done />
          <WorkflowLine done />
          <WorkflowStep step={5} label="HR / Quota" active />
        </div>
      </div>

      {/* Success notice */}
      <div style={{
        background: 'linear-gradient(135deg,rgba(16,185,129,0.08),rgba(5,150,105,0.04))',
        border: '1px solid rgba(16,185,129,0.2)', borderRadius: 14, padding: '14px 20px',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        <CheckCircleOutlined style={{ color: '#10b981', fontSize: 18, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 600, color: '#065f46', marginBottom: 2 }}>Budget Cleared by Accounts</div>
          <div style={{ fontSize: 13, color: '#047857' }}>
            The requests below have been financially approved. Please navigate to <strong>Hour Allocation</strong> to update each employee's daily quota so they can submit their EOD reports.
          </div>
        </div>
      </div>

      {/* Metric cards */}
      {!loading && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <MetricCard icon={<UserOutlined />} label="Employees Needing Update" value={requests.length} color="#6366f1" bg={isDarkMode ? '#18181b' : '#fafafa'} />
          <MetricCard icon={<ClockCircleOutlined />} label="Total Extra Hours Approved" value={`${totalHours.toFixed(1)}h`} color="#10b981" bg={isDarkMode ? '#18181b' : '#fafafa'} />
          <MetricCard icon={<FileTextOutlined />} label="Pending Reallocations" value={requests.length} color="#f59e0b" bg={isDarkMode ? '#18181b' : '#fafafa'} />
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#94a3b8' }}>Loading approved requests…</div>
        </div>
      ) : requests.length === 0 ? (
        <div style={{ ...cardBase, padding: '60px 24px', textAlign: 'center' }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#10b981', marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>All Quotas Updated!</div>
          <Text type="secondary">No pending additional hours adjustments needed.</Text>
        </div>
      ) : (
        <div style={cardBase}>
          <Table
            columns={columns}
            dataSource={requests}
            rowKey={(r) => r.request.requestId}
            pagination={{ pageSize: 10, style: { padding: '0 20px 16px' } }}
          />
        </div>
      )}
    </div>
  );
};

export default HRTimerRequestsPage;
