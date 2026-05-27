import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, InputNumber, Button, Typography, Space, Tag, Avatar,
  notification, Skeleton, Row, Col, Divider, Tooltip, theme, Badge
} from 'antd';
import {
  ClockCircleOutlined, UserOutlined, SaveOutlined,
  CheckCircleOutlined, EditOutlined, CloseOutlined
} from '@ant-design/icons';
import { adminService } from '../../services/adminService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Title, Text } = Typography;

const ROLE_META = {
  Employee:       { color: '#6366f1', bg: 'rgba(99,102,241,0.1)',   label: 'Employee'        },
  TeamLead:       { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',   label: 'Team Lead'       },
  Sales:          { color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',    label: 'Sales'           },
  Accounts:       { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   label: 'Accounts'        },
  ProjectManager: { color: '#10b981', bg: 'rgba(16,185,129,0.1)',   label: 'Project Manager' },
};

const getInitials = (name = '') =>
  name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

const EmployeeCard = ({ user, onSave }) => {
  const { token } = theme.useToken();
  const { isDarkMode } = useThemeStore();
  const currentSaved = user.allocatedHours !== undefined && user.allocatedHours !== null
    ? Number(user.allocatedHours)
    : 0.0;
  const [hours, setHours] = useState(currentSaved);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isDirty = hours !== currentSaved;

  const meta = ROLE_META[user.role] || { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', label: user.role };

  const handleSave = async () => {
    if (hours === undefined || hours === null || hours < 0) {
      notification.warning({ message: 'Invalid', description: 'Hours must be 0 or greater.' });
      return;
    }
    setSaving(true);
    try {
      await onSave(user.id, hours);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      // error shown by parent
    } finally {
      setSaving(false);
    }
  };

  const pct = Math.min(Math.round((hours / 12) * 100), 100);

  return (
    <Card
      style={{
        borderRadius: 16,
        border: isDirty
          ? `1.5px solid ${meta.color}`
          : `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : '#f0f0f0'}`,
        transition: 'border 0.2s, box-shadow 0.2s',
        boxShadow: isDirty ? `0 0 0 3px ${meta.color}22` : undefined,
        background: isDarkMode ? 'rgba(255,255,255,0.02)' : '#fff',
        position: 'relative',
        overflow: 'visible',
      }}
      bodyStyle={{ padding: '20px 20px 16px' }}
      hoverable
    >
      {/* Top row: avatar + info */}
      <Row align="middle" gutter={12} wrap={false}>
        <Col flex="none">
          <Avatar
            size={48}
            style={{ background: `${meta.color}30`, color: meta.color, fontWeight: 700, fontSize: 16, flexShrink: 0 }}
          >
            {getInitials(user.name)}
          </Avatar>
        </Col>
        <Col flex="auto" style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.name}
          </div>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.email}
          </Text>
        </Col>
        <Col flex="none">
          <Tag
            style={{
              background: meta.bg,
              color: meta.color,
              border: `1px solid ${meta.color}40`,
              borderRadius: 20,
              fontWeight: 600,
              fontSize: 11,
              padding: '2px 10px',
            }}
          >
            {meta.label}
          </Tag>
        </Col>
      </Row>

      <Divider style={{ margin: '14px 0 12px' }} />

      {/* Current allocation display */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10
      }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Current Quota</Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ClockCircleOutlined style={{ color: meta.color, fontSize: 13 }} />
          <Text strong style={{ color: meta.color, fontSize: 15 }}>{currentSaved}h/day</Text>
        </div>
      </div>

      {/* Hour bar */}
      <div style={{
        height: 6, borderRadius: 99, background: isDarkMode ? 'rgba(255,255,255,0.08)' : '#f0f0f0', marginBottom: 14
      }}>
        <div style={{
          height: '100%', borderRadius: 99, width: `${pct}%`,
          background: `linear-gradient(90deg, ${meta.color}, ${meta.color}99)`,
          transition: 'width 0.4s ease'
        }} />
      </div>

      {/* Input + Save row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Set hours:</Text>
        <InputNumber
          value={hours}
          min={0}
          step={0.5}
          precision={1}
          style={{ flex: 1 }}
          onChange={val => { if (val != null) setHours(val); }}
          keyboard
          controls
          size="middle"
        />
        <Button
          type={isDirty ? 'primary' : 'default'}
          icon={saved ? <CheckCircleOutlined /> : <SaveOutlined />}
          loading={saving}
          onClick={handleSave}
          disabled={!isDirty || saving}
          style={{
            background: isDirty ? meta.color : undefined,
            borderColor: isDirty ? meta.color : undefined,
            color: isDirty ? '#fff' : undefined,
            transition: 'all 0.2s',
            minWidth: 80,
          }}
        >
          {saved ? 'Saved!' : 'Save'}
        </Button>
      </div>

      {isDirty && (
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Change: {currentSaved}h → <Text strong style={{ color: meta.color }}>{hours}h</Text>
          </Text>
          <Button
            type="link"
            size="small"
            icon={<CloseOutlined />}
            onClick={() => setHours(currentSaved)}
            style={{ padding: 0, fontSize: 11, height: 'auto' }}
          >
            Reset
          </Button>
        </div>
      )}
    </Card>
  );
};

const HourAllocationPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token } = theme.useToken();

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await adminService.getUsers();
      const filtered = (res.data || []).filter(u =>
        ['Employee', 'TeamLead', 'ProjectManager'].includes(u.role)
      );
      setUsers(filtered);
    } catch (err) {
      notification.error({ message: 'Error', description: 'Failed to load users.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = useCallback(async (userId, hours) => {
    try {
      await adminService.setAllocatedHours(userId, hours);
      // Update local state so the card reflects the new saved value
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, allocatedHours: String(hours) } : u
      ));
      notification.success({
        message: '✅ Hours Updated',
        description: `Daily quota set to ${hours}h for this employee.`,
        duration: 3,
      });
    } catch (err) {
      notification.error({ message: 'Save Failed', description: err?.response?.data?.message || 'Please try again.' });
      throw err;
    }
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 80 }}>
      <PageHeader
        title="Work Hour Allocation"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Hour Allocation' }]}
      />

      <div style={{ marginBottom: 20 }}>
        <Title level={5} style={{ margin: 0 }}>
          <EditOutlined style={{ color: token.colorPrimary, marginRight: 8 }} />
          Employee Quotas
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Set the maximum daily hours each employee can report in their EOD. Changes take effect immediately on next login.
        </Text>
      </div>

      {loading ? (
        <Row gutter={[16, 16]}>
          {[1, 2, 3].map(i => (
            <Col xs={24} sm={12} lg={8} key={i}>
              <Card style={{ borderRadius: 16 }}><Skeleton active avatar paragraph={{ rows: 3 }} /></Card>
            </Col>
          ))}
        </Row>
      ) : users.length === 0 ? (
        <Card style={{ borderRadius: 16, textAlign: 'center', padding: 40 }}>
          <UserOutlined style={{ fontSize: 48, color: token.colorTextQuaternary }} />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">No employees found in this workspace.</Text>
          </div>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {users.map(user => (
            <Col xs={24} sm={12} lg={8} key={user.id}>
              <EmployeeCard user={user} onSave={handleSave} />
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export default HourAllocationPage;
