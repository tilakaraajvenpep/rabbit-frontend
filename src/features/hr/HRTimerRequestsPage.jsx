import React, { useState, useEffect } from 'react';
import { Table, Button, Typography, Tag, message, Spin } from 'antd';
import { CheckCircleOutlined, SettingOutlined } from '@ant-design/icons';
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

const HRTimerRequestsPage = () => {
  const { isDarkMode } = useThemeStore();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchApprovedRequests();
  }, []);

  const fetchApprovedRequests = async () => {
    setLoading(true);
    try {
      const res = await timerRequestService.getHRApprovedRequests();
      setRequests(res.data.data || []);
    } catch {
      message.error('Failed to load approved additional hours requests');
    } finally {
      setLoading(false);
    }
  };

  const roleColors = { TeamLead: '#7c3aed', ProjectManager: '#3b82f6', Employee: '#f59e0b' };
  const cardBase = {
    borderRadius: 16,
    overflow: 'hidden',
    background: isDarkMode ? '#18181b' : '#fff',
    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.07)' : '#f1f5f9'}`
  };

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
      key: 'requestedHours',
      width: 130,
      align: 'center',
      render: (_, r) => {
        const h = r.request?.requestedHours || 0;
        return (
          <div style={{ background: 'rgba(16,185,129,0.12)', color: '#059669', borderRadius: 10, padding: '4px 12px', fontWeight: 800, fontSize: 15, display: 'inline-block' }}>
            +{h}h
          </div>
        );
      },
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
          onClick={() => navigate('/hr/allocate')}
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
        subtitle="Review approved additional hours budget from Accounts and reallocate daily quotas."
        breadcrumbs={[{ label: 'HR' }, { label: 'Additional Hours' }]}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#94a3b8' }}>Loading approved requests…</div>
        </div>
      ) : requests.length === 0 ? (
        <div style={{ ...cardBase, padding: '60px 24px', textAlign: 'center' }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#10b981', marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>All Quotas Updated!</div>
          <Text type="secondary">No pending additional hours adjustments from Accounts.</Text>
        </div>
      ) : (
        <div style={cardBase}>
          <Table
            columns={columns}
            dataSource={requests}
            rowKey={(r) => r.request?.requestId || Math.random()}
            pagination={{ pageSize: 10, style: { padding: '0 20px 16px' } }}
            style={{ borderRadius: 16 }}
          />
        </div>
      )}
    </div>
  );
};

export default HRTimerRequestsPage;
