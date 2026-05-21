import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Progress, Typography, Skeleton, Tag, Button,
  Modal, Divider, Statistic, Badge, Space, Tooltip, notification, theme
} from 'antd';
import {
  CrownOutlined, TeamOutlined, ProjectOutlined, DatabaseOutlined,
  CheckCircleOutlined, CloseCircleOutlined, CalendarOutlined,
  ThunderboltOutlined, RocketOutlined, StarOutlined, SafetyOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminService } from '../../services/adminService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Title, Text, Paragraph } = Typography;

const PLAN_META = {
  Free:       { color: '#6b7280', gradient: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)', icon: <StarOutlined />,        badge: 'default' },
  Pro:        { color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', icon: <ThunderboltOutlined />, badge: 'processing' },
  Enterprise: { color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', icon: <CrownOutlined />,       badge: 'warning' },
};

const PLAN_LIMITS = {
  Free:       { users: 5,   projects: 3,  storage: 1   },
  Pro:        { users: 50,  projects: 20, storage: 100 },
  Enterprise: { users: 999, projects: 999, storage: 1000 },
};

const FEATURES = [
  { label: 'Max Users',           free: '5',          pro: '50',        enterprise: 'Unlimited', icon: <TeamOutlined /> },
  { label: 'Max Projects',        free: '3',          pro: '20',        enterprise: 'Unlimited', icon: <ProjectOutlined /> },
  { label: 'Storage',             free: '1 GB',       pro: '100 GB',    enterprise: '1 TB',      icon: <DatabaseOutlined /> },
  { label: 'Role-based Access',   free: 'Basic',      pro: 'Full',      enterprise: 'Custom',    icon: <SafetyOutlined /> },
  { label: 'AI Assistant',        free: false,        pro: true,        enterprise: true,         icon: <RocketOutlined /> },
  { label: 'Priority Support',    free: false,        pro: true,        enterprise: true,         icon: <CheckCircleOutlined /> },
  { label: 'Custom Domain',       free: false,        pro: false,       enterprise: true,         icon: <CrownOutlined /> },
  { label: 'SLA Guarantee',       free: false,        pro: false,       enterprise: true,         icon: <SafetyOutlined /> },
];

const UsageRing = ({ label, used, max, icon, color }) => {
  const pct = max > 0 ? Math.min(Math.round((used / max) * 100), 100) : 0;
  const isUnlimited = max >= 999;
  const status = pct >= 90 ? 'exception' : pct >= 70 ? 'normal' : 'success';

  return (
    <div style={{ textAlign: 'center' }}>
      <Progress
        type="circle"
        percent={isUnlimited ? 100 : pct}
        strokeColor={color}
        trailColor="rgba(255,255,255,0.08)"
        format={() => (
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{used}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{isUnlimited ? '∞' : `/ ${max}`}</div>
          </div>
        )}
        size={100}
        status={isUnlimited ? 'normal' : status}
      />
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <span style={{ color }}>{icon}</span>
        <Text strong style={{ fontSize: 13 }}>{label}</Text>
      </div>
      {!isUnlimited && (
        <Text type="secondary" style={{ fontSize: 11 }}>{pct}% used</Text>
      )}
    </div>
  );
};

const FeatureValue = ({ val }) => {
  if (val === true)  return <CheckCircleOutlined style={{ color: '#10b981', fontSize: 16 }} />;
  if (val === false) return <CloseCircleOutlined style={{ color: '#ef4444', fontSize: 16 }} />;
  return <Text style={{ fontWeight: 500 }}>{val}</Text>;
};

const SubscriptionPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isDarkMode } = useThemeStore();
  const { token } = theme.useToken();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await adminService.getSubscription();
      setData(res.data);
    } catch (err) {
      console.error('Failed to load subscription info', err);
      notification.error({ message: 'Error', description: 'Could not load subscription details.' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Skeleton active paragraph={{ rows: 14 }} style={{ padding: 24 }} />;
  if (!data) return null;

  const planKey = data.planName?.split(' ')[0] || 'Free';
  const planMeta = PLAN_META[planKey] || PLAN_META.Free;
  const planLimits = PLAN_LIMITS[planKey] || PLAN_LIMITS.Free;

  const daysLeft = data.renewalDate
    ? dayjs(data.renewalDate).diff(dayjs(), 'day')
    : null;

  const isExpired = daysLeft !== null && daysLeft < 0;
  const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 80 }}>
      <PageHeader
        title="Subscription & Usage"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Subscription' }]}
      />

      {/* Top Row: Plan Card + Stats */}
      <Row gutter={[20, 20]}>
        {/* Plan card */}
        <Col xs={24} lg={8}>
          <Card
            style={{
              background: planMeta.gradient,
              border: 'none',
              borderRadius: 16,
              color: '#fff',
              minHeight: 280,
              position: 'relative',
              overflow: 'hidden',
            }}
            bodyStyle={{ padding: 28 }}
          >
            {/* Decorative circle */}
            <div style={{
              position: 'absolute', top: -40, right: -40,
              width: 160, height: 160, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)'
            }} />
            <div style={{
              position: 'absolute', bottom: -60, left: -30,
              width: 200, height: 200, borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)'
            }} />

            <Space direction="vertical" size={16} style={{ width: '100%', position: 'relative', zIndex: 1 }}>
              <div>
                <div style={{ fontSize: 32, color: 'rgba(255,255,255,0.9)' }}>{planMeta.icon}</div>
                <Title level={2} style={{ color: '#fff', margin: '8px 0 4px', fontWeight: 800 }}>
                  {data.planName}
                </Title>
                <Badge
                  status={data.isActive ? 'success' : 'error'}
                  text={
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
                      {data.isActive ? 'Active' : 'Inactive'}
                    </Text>
                  }
                />
              </div>

              <Divider style={{ borderColor: 'rgba(255,255,255,0.2)', margin: '4px 0' }} />

              <div>
                <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Workspace
                </Text>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginTop: 2 }}>
                  {data.tenantName}
                </div>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                  Code: {data.tenantCode}
                </Text>
              </div>

              <div>
                <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Member since
                </Text>
                <div style={{ color: '#fff', fontWeight: 600, marginTop: 2 }}>
                  {dayjs(data.createdAt).format('DD MMM YYYY')}
                </div>
              </div>

              {daysLeft !== null && (
                <div style={{
                  background: isExpired ? 'rgba(239,68,68,0.25)' : isExpiringSoon ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <CalendarOutlined style={{ color: isExpired ? '#fca5a5' : '#fde68a' }} />
                  <Text style={{ color: '#fff', fontSize: 13 }}>
                    {isExpired
                      ? `Expired ${Math.abs(daysLeft)} days ago`
                      : `Renews in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
                  </Text>
                </div>
              )}

              <Button
                block
                size="large"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#fff',
                  fontWeight: 600,
                  borderRadius: 10,
                  backdropFilter: 'blur(8px)',
                }}
                onClick={() => Modal.info({
                  title: 'Upgrade Your Plan',
                  content: 'Contact our sales team at sales@rabbit.app or call +91-98765-43210 to upgrade your plan.',
                  icon: <CrownOutlined style={{ color: '#f59e0b' }} />,
                })}
              >
                <RocketOutlined /> Upgrade Plan
              </Button>
            </Space>
          </Card>
        </Col>

        {/* Usage Rings */}
        <Col xs={24} lg={16}>
          <Card
            title={<span style={{ fontWeight: 700, fontSize: 15 }}>📊 Live Usage</span>}
            style={{ borderRadius: 16, minHeight: 280 }}
            bodyStyle={{ padding: '32px 24px' }}
          >
            <Row gutter={[24, 32]} justify="space-around">
              <Col xs={8} style={{ textAlign: 'center' }}>
                <UsageRing
                  label="Users"
                  used={data.activeUsers}
                  max={data.maxUsers}
                  icon={<TeamOutlined />}
                  color="#6366f1"
                />
              </Col>
              <Col xs={8} style={{ textAlign: 'center' }}>
                <UsageRing
                  label="Projects"
                  used={data.activeProjects}
                  max={data.maxProjects}
                  icon={<ProjectOutlined />}
                  color="#10b981"
                />
              </Col>
              <Col xs={8} style={{ textAlign: 'center' }}>
                <UsageRing
                  label="Storage"
                  used={`${data.storageUsed}GB`}
                  max={data.storageQuota}
                  icon={<DatabaseOutlined />}
                  color="#f59e0b"
                />
              </Col>
            </Row>

            <Divider style={{ margin: '28px 0 20px' }} />

            <Row gutter={16}>
              <Col span={8}>
                <div style={{
                  padding: '14px 16px',
                  borderRadius: 12,
                  background: isDarkMode ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)',
                  border: '1px solid rgba(99,102,241,0.2)'
                }}>
                  <Statistic
                    title={<Text type="secondary" style={{ fontSize: 12 }}>Remaining Users</Text>}
                    value={Math.max(0, data.maxUsers - data.activeUsers)}
                    valueStyle={{ color: '#6366f1', fontSize: 22, fontWeight: 700 }}
                    prefix={<TeamOutlined />}
                  />
                </div>
              </Col>
              <Col span={8}>
                <div style={{
                  padding: '14px 16px',
                  borderRadius: 12,
                  background: isDarkMode ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.06)',
                  border: '1px solid rgba(16,185,129,0.2)'
                }}>
                  <Statistic
                    title={<Text type="secondary" style={{ fontSize: 12 }}>Remaining Projects</Text>}
                    value={Math.max(0, data.maxProjects - data.activeProjects)}
                    valueStyle={{ color: '#10b981', fontSize: 22, fontWeight: 700 }}
                    prefix={<ProjectOutlined />}
                  />
                </div>
              </Col>
              <Col span={8}>
                <div style={{
                  padding: '14px 16px',
                  borderRadius: 12,
                  background: isDarkMode ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.06)',
                  border: '1px solid rgba(245,158,11,0.2)'
                }}>
                  <Statistic
                    title={<Text type="secondary" style={{ fontSize: 12 }}>Free Storage</Text>}
                    value={`${Math.max(0, data.storageQuota - data.storageUsed)} GB`}
                    valueStyle={{ color: '#f59e0b', fontSize: 22, fontWeight: 700 }}
                    prefix={<DatabaseOutlined />}
                  />
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Plan Comparison Table */}
      <Card
        title={<span style={{ fontWeight: 700, fontSize: 15 }}>🏆 Plan Comparison</span>}
        style={{ marginTop: 20, borderRadius: 16 }}
        bodyStyle={{ padding: 0, overflowX: 'auto' }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: isDarkMode ? 'rgba(255,255,255,0.04)' : '#fafafa' }}>
              <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: token.colorTextHeading }}>Feature</th>
              {['Free', 'Pro', 'Enterprise'].map(plan => (
                <th key={plan} style={{
                  padding: '14px 20px',
                  textAlign: 'center',
                  fontWeight: 700,
                  color: planKey === plan ? PLAN_META[plan]?.color : token.colorTextHeading,
                  background: planKey === plan
                    ? isDarkMode ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)'
                    : 'transparent',
                  borderBottom: planKey === plan ? `2px solid ${PLAN_META[plan]?.color}` : undefined
                }}>
                  {planKey === plan && <CrownOutlined style={{ marginRight: 6 }} />}
                  {plan}
                  {planKey === plan && (
                    <Tag color={PLAN_META[plan]?.badge} style={{ marginLeft: 8, fontSize: 10 }}>Current</Tag>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((f, i) => (
              <tr
                key={f.label}
                style={{
                  background: i % 2 === 0
                    ? (isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)')
                    : 'transparent',
                  transition: 'background 0.2s'
                }}
              >
                <td style={{ padding: '13px 20px' }}>
                  <Space>
                    <span style={{ color: token.colorPrimary }}>{f.icon}</span>
                    <Text style={{ fontWeight: 500 }}>{f.label}</Text>
                  </Space>
                </td>
                {['free', 'pro', 'enterprise'].map((plan, pi) => (
                  <td key={plan} style={{
                    padding: '13px 20px',
                    textAlign: 'center',
                    background: planKey === ['Free', 'Pro', 'Enterprise'][pi]
                      ? isDarkMode ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.03)'
                      : 'transparent'
                  }}>
                    <FeatureValue val={f[plan]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

export default SubscriptionPage;
