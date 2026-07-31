import React, { useState, useEffect } from 'react';
import { 
  Button, notification, Skeleton, Typography, Modal, message,
  Row, Col, Card, Tag, Tooltip, Badge, Empty
} from 'antd';
import { 
  CalculatorOutlined, DeleteOutlined, 
  FolderOpenOutlined, ClockCircleOutlined, ExclamationCircleOutlined, 
  RollbackOutlined, CalendarOutlined, CodeOutlined, ArrowRightOutlined,
  CheckCircleOutlined, SyncOutlined, WarningOutlined, UserOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { projectService } from '../../services/projectService';
import { useThemeStore } from '../../store/themeStore';
import PageHeader from '../../components/common/PageHeader';
import { useAuthStore } from '../../store/authStore';

const { Text, Title } = Typography;

/* ── status config ─────────────────────────────────────────────── */
const STATUS_CONFIG = {
  Draft:               { label: 'Draft',                color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: <FolderOpenOutlined />  },
  PendingReview:       { label: 'Pending Review',       color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: <ClockCircleOutlined /> },
  PendingPMApproval:   { label: 'Pending PM Approval',  color: '#0284c7', bg: 'rgba(2,132,199,0.12)',   icon: <ClockCircleOutlined /> },
  Approved:            { label: 'Approved',             color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: <CheckCircleOutlined /> },
  ReturnedToAccounts:  { label: 'Returned by PM',       color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: <WarningOutlined />     },
  ReturnedForRevision: { label: 'Returned to Sales',    color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',  icon: <RollbackOutlined />    },
  InProgress:          { label: 'In Progress',          color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  icon: <SyncOutlined />        },
  OnHold:              { label: 'On Hold',              color: '#d97706', bg: 'rgba(217,119,6,0.12)',   icon: <ClockCircleOutlined /> },
  Completed:           { label: 'Completed',            color: '#059669', bg: 'rgba(5,150,105,0.12)',   icon: <CheckCircleOutlined /> },
  default:             { label: 'Unknown',              color: '#64748b', bg: 'rgba(100,116,139,0.12)', icon: <SyncOutlined />        },
};

const StatusPill = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.default;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: cfg.bg, color: cfg.color,
      padding: '5px 12px', borderRadius: 20,
      fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
      border: `1px solid ${cfg.color}40`,
      whiteSpace: 'nowrap',
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
};

/* ── TABS config ───────────────────────────────────────────────── */
const TABS = [
  { key: 'All',               label: 'All Projects',       filterStatus: null                  },
  { key: 'PendingReview',     label: 'Pending Review',     filterStatus: 'PendingReview'       },
  { key: 'PendingPMApproval',  label: 'Pending PM Approval', filterStatus: 'PendingPMApproval'  },
  { key: 'ReturnedToAccounts',label: 'Returned by PM',     filterStatus: 'ReturnedToAccounts'  },
  { key: 'ReturnedForRevision',label: 'Returned to Sales', filterStatus: 'ReturnedForRevision' },
];

/* ── Project Row Card ──────────────────────────────────────────── */
const ProjectCard = ({ record, isDarkMode, onAnalyze, onDelete }) => {
  const [hovered, setHovered] = useState(false);
  const cfg = STATUS_CONFIG[record.status] || STATUS_CONFIG.default;
  const isApproved = record.status === 'Approved';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isDarkMode
          ? hovered ? '#1e1e24' : '#17171d'
          : hovered ? '#f8f9ff' : '#ffffff',
        border: `1px solid ${hovered ? cfg.color + '60' : (isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)')}`,
        borderRadius: 16,
        padding: '20px 24px',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 20,
        cursor: 'default',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: hovered
          ? `0 8px 32px -8px ${cfg.color}30`
          : '0 2px 8px rgba(0,0,0,0.04)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Left accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 4, borderRadius: '16px 0 0 16px',
        background: `linear-gradient(180deg, ${cfg.color}, ${cfg.color}80)`,
        transition: 'all 0.2s',
      }} />

      {/* Project icon */}
      <div style={{
        minWidth: 48, height: 48,
        borderRadius: 12,
        background: `linear-gradient(135deg, ${cfg.color}25, ${cfg.color}10)`,
        border: `1px solid ${cfg.color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: cfg.color, fontSize: 22,
      }}>
        <AppstoreOutlined />
      </div>

      {/* Main info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          {/* Code tag */}
          <Tag color="geekblue" style={{
            borderRadius: 6, fontWeight: 700, fontSize: 11,
            padding: '2px 8px', margin: 0, display: 'inline-flex', alignItems: 'center', gap: 4
          }}>
            <CodeOutlined /> {record.code}
          </Tag>

          {/* Category tag */}
          {record.projectCategory ? (
            <Tag color="purple" style={{ borderRadius: 6, fontWeight: 600, fontSize: 11, margin: 0, padding: '2px 8px' }}>
              {record.projectCategory}
            </Tag>
          ) : (
            <Tag style={{ borderRadius: 6, fontWeight: 500, fontSize: 11, margin: 0, padding: '2px 8px', opacity: 0.5 }}>
              No Category
            </Tag>
          )}
        </div>

        {/* Project name */}
        <div
          onClick={() => onAnalyze(record)}
          style={{
            fontSize: '15.5px', fontWeight: 700,
            color: '#6366f1',
            cursor: 'pointer', marginBottom: 8,
            wordBreak: 'break-word', lineHeight: 1.4,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#4f46e5'}
          onMouseLeave={e => e.currentTarget.style.color = '#6366f1'}
        >
          {record.name}
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: isDarkMode ? '#a1a1aa' : '#71717a', fontWeight: 500 }}>
            <UserOutlined style={{ color: '#6366f1', fontSize: 13 }} />
            Client: <strong>{record.client || '—'}</strong>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: isDarkMode ? '#a1a1aa' : '#71717a', fontWeight: 500 }}>
            <CalendarOutlined style={{ color: '#6366f1', fontSize: 13 }} />
            Start: <strong>{record.startDate ? dayjs(record.startDate).format('DD MMM YYYY') : dayjs(record.createdAt).format('DD MMM YYYY')}</strong>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: isDarkMode ? '#a1a1aa' : '#71717a', fontWeight: 500 }}>
            <CalendarOutlined style={{ color: '#ef4444', fontSize: 13 }} />
            End: <strong>{record.endDate ? dayjs(record.endDate).format('DD MMM YYYY') : 'Not Set'}</strong>
          </span>
        </div>

        {/* Return reason (if any) */}
        {record.comments && record.status.startsWith('Returned') && (
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 8,
            background: isDarkMode ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)',
            borderLeft: '3px solid #ef4444',
            fontSize: 13, color: '#ef4444', lineHeight: 1.5,
            wordBreak: 'break-word',
          }}>
            <strong>Return Reason:</strong> {record.comments}
          </div>
        )}
      </div>

      {/* Right side: status + actions */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12, flexShrink: 0 }}>
        <StatusPill status={record.status} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button
            type={isApproved ? 'default' : 'primary'}
            icon={<CalculatorOutlined />}
            size="middle"
            style={{
              borderRadius: 10, fontWeight: 700, fontSize: 13,
              ...(isApproved ? {} : {
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none',
                boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
              }),
            }}
            onClick={() => onAnalyze(record)}
          >
            {isApproved ? 'Edit Cost' : 'Review & Analyze'}
          </Button>
          <Tooltip title="Delete project proposal">
            <Button
              type="text" danger
              size="middle"
              icon={<DeleteOutlined />}
              style={{ borderRadius: 10 }}
              onClick={() => onDelete(record)}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

/* ── MAIN PAGE ─────────────────────────────────────────────────── */
const PendingReviewPage = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useThemeStore();
  const { token, isAuthenticated } = useAuthStore();
  const [projects, setProjects]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('All');

  useEffect(() => {
    if (!token || !isAuthenticated) return;
    fetchPendingProjects();
  }, [token, isAuthenticated]);

  const fetchPendingProjects = async () => {
    setLoading(true);
    try {
      const response = await projectService.getProjects();
      const allProjects = response.data || [];
      // Keep all projects so Accounts has total visibility as requested
      setProjects(allProjects);
    } catch {
      notification.error({ message: 'Error', description: 'Failed to load pending projects.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: 'Delete this project?',
      content: `Permanently delete "${record.name}" (${record.code}) and all associated data. This cannot be undone.`,
      okText: 'Yes, Delete', okType: 'danger', cancelText: 'Cancel',
      onOk: async () => {
        try {
          await projectService.deleteProject(record.id);
          message.success('Project deleted.');
          fetchPendingProjects();
        } catch {
          message.error('Failed to delete project. Please try again.');
        }
      },
    });
  };

  // Counts
  const counts = {
    All:                projects.length,
    PendingReview:      projects.filter(p => p.status === 'PendingReview').length,
    PendingPMApproval:  projects.filter(p => p.status === 'PendingPMApproval').length,
    ReturnedToAccounts: projects.filter(p => p.status === 'ReturnedToAccounts').length,
    ReturnedForRevision:projects.filter(p => p.status === 'ReturnedForRevision').length,
  };

  const filteredProjects = projects.filter(p =>
    activeTab === 'All' ? true : p.status === activeTab
  );

  const statCards = [
    { key: 'All',                label: 'All Projects',      color: '#6366f1', icon: <FolderOpenOutlined style={{ fontSize: 20 }} />        },
    { key: 'PendingReview',      label: 'Pending Review',    color: '#f59e0b', icon: <ClockCircleOutlined style={{ fontSize: 20 }} />       },
    { key: 'PendingPMApproval',  label: 'Pending PM Approval',color: '#0284c7', icon: <ClockCircleOutlined style={{ fontSize: 20 }} />       },
    { key: 'ReturnedToAccounts', label: 'Returned by PM',    color: '#ef4444', icon: <ExclamationCircleOutlined style={{ fontSize: 20 }} /> },
    { key: 'ReturnedForRevision',label: 'Returned to Sales', color: '#8b5cf6', icon: <RollbackOutlined style={{ fontSize: 20 }} />          },
  ];

  return (
    <div style={{ paddingBottom: 60 }}>
      <PageHeader title="Pending Review" />

      {/* ── STAT CARDS ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 28, display: 'flex', flexWrap: 'wrap' }}>
        {statCards.map(card => {
          const isActive = activeTab === card.key;
          return (
            <Col xs={24} sm={12} md={8} style={{ flex: '1 0 18%', minWidth: 200 }} key={card.key}>
              <div
                onClick={() => setActiveTab(card.key)}
                style={{
                  borderRadius: 16,
                  padding: '20px 22px',
                  cursor: 'pointer',
                  position: 'relative', overflow: 'hidden',
                  background: isActive
                    ? `linear-gradient(135deg, ${card.color}20, ${card.color}08)`
                    : (isDarkMode ? '#17171d' : '#ffffff'),
                  border: `1.5px solid ${isActive ? card.color : (isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)')}`,
                  boxShadow: isActive ? `0 8px 28px -6px ${card.color}35` : '0 2px 10px rgba(0,0,0,0.03)',
                  transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                  height: '100%'
                }}
              >
                {/* Soft radial glow */}
                {isActive && (
                  <div style={{
                    position: 'absolute', right: -20, top: -20,
                    width: 100, height: 100, borderRadius: '50%',
                    background: `${card.color}18`,
                    pointerEvents: 'none',
                  }} />
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', height: '100%' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#a1a1aa' : '#71717a', marginBottom: 6 }}>
                      {card.label}
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 800, color: isActive ? card.color : (isDarkMode ? '#f4f4f5' : '#0f172a'), lineHeight: 1 }}>
                      {counts[card.key]}
                    </div>
                  </div>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: isActive ? `${card.color}20` : (isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: isActive ? card.color : (isDarkMode ? '#71717a' : '#94a3b8'),
                    transition: 'all 0.2s',
                  }}>
                    {card.icon}
                  </div>
                </div>
              </div>
            </Col>
          );
        })}
      </Row>

      {/* ── FILTER TABS + LIST ── */}
      <div style={{
        borderRadius: 18,
        background: isDarkMode ? '#131316' : '#ffffff',
        border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
        overflow: 'hidden',
      }}>
        {/* Tab bar */}
        <div style={{
          display: 'flex', gap: 4, padding: '16px 20px 0',
          borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          background: isDarkMode ? '#0f0f12' : '#fafafa',
        }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  background: isActive
                    ? (isDarkMode ? 'rgba(99,102,241,0.15)' : '#fff')
                    : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2.5px solid #6366f1' : '2.5px solid transparent',
                  borderRadius: '8px 8px 0 0',
                  padding: '10px 18px',
                  cursor: 'pointer',
                  fontSize: 13.5,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#6366f1' : (isDarkMode ? '#a1a1aa' : '#71717a'),
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
                <span style={{
                  marginLeft: 8,
                  background: isActive ? '#6366f1' : (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'),
                  color: isActive ? '#fff' : (isDarkMode ? '#a1a1aa' : '#71717a'),
                  borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700,
                }}>
                  {counts[tab.key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Project list */}
        <div style={{ padding: '20px 20px 8px' }}>
          {loading ? (
            [1,2,3,4,5].map(i => (
              <div key={i} style={{
                borderRadius: 16, padding: '20px 24px', marginBottom: 12,
                background: isDarkMode ? '#17171d' : '#f9fafb',
                border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
              }}>
                <Skeleton active paragraph={{ rows: 2 }} />
              </div>
            ))
          ) : filteredProjects.length > 0 ? (
            filteredProjects.map(record => (
              <ProjectCard
                key={record.id}
                record={record}
                isDarkMode={isDarkMode}
                onAnalyze={(r) => navigate(`/accounts/projects/${r.id}/cost`)}
                onDelete={handleDelete}
              />
            ))
          ) : (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Text type="secondary" style={{ fontSize: 14 }}>
                    No projects found in <strong>{TABS.find(t => t.key === activeTab)?.label}</strong>
                  </Text>
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PendingReviewPage;
