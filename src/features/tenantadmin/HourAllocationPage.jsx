import React, { useState, useEffect } from 'react';
import {
  Card, Select, InputNumber, Button, Table, Typography, Space, Tag,
  notification, Skeleton, Avatar, Tooltip, Row, Col, Statistic, theme
} from 'antd';
import {
  ClockCircleOutlined, UserOutlined, SaveOutlined, TeamOutlined,
  CheckCircleOutlined, EditOutlined
} from '@ant-design/icons';
import { adminService } from '../../services/adminService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Title, Text } = Typography;

const ROLE_COLORS = {
  Employee: 'blue',
  TeamLead: 'purple',
  Sales: 'cyan',
  Accounts: 'gold',
  ProjectManager: 'green',
};

const HourAllocationPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [editingHours, setEditingHours] = useState({}); // { userId: hours }
  const { isDarkMode } = useThemeStore();
  const { token } = theme.useToken();

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await adminService.getUsers();
      // Only show non-admin users
      const filtered = res.data.filter(u => !['TenantAdmin', 'SuperAdmin'].includes(u.role));
      setUsers(filtered);
      // Seed editingHours with current allocatedHours
      const initial = {};
      filtered.forEach(u => { initial[u.id] = Number(u.allocatedHours) || 8.5; });
      setEditingHours(initial);
    } catch (err) {
      notification.error({ message: 'Error', description: 'Failed to load users.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (userId) => {
    const hours = editingHours[userId];
    if (!hours || hours <= 0) {
      notification.warning({ message: 'Invalid', description: 'Hours must be greater than 0.' });
      return;
    }
    setSavingId(userId);
    try {
      await adminService.setAllocatedHours(userId, hours);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, allocatedHours: hours } : u));
      notification.success({ message: 'Saved', description: `Allocated ${hours}h/day for this employee.` });
    } catch (err) {
      notification.error({ message: 'Error', description: 'Failed to update allocated hours.' });
    } finally {
      setSavingId(null);
    }
  };

  const totalEmployees = users.length;
  const avgHours = users.length > 0
    ? (users.reduce((sum, u) => sum + (Number(u.allocatedHours) || 8.5), 0) / users.length).toFixed(1)
    : 0;
  const totalHoursPerDay = users.reduce((sum, u) => sum + (Number(u.allocatedHours) || 8.5), 0);

  const columns = [
    {
      title: 'Employee',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <Avatar
            style={{ background: token.colorPrimary, flexShrink: 0 }}
            icon={<UserOutlined />}
            size={36}
          />
          <div>
            <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{name}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: role => <Tag color={ROLE_COLORS[role] || 'default'}>{role}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: active => active
        ? <Tag color="success" icon={<CheckCircleOutlined />}>Active</Tag>
        : <Tag color="error">Inactive</Tag>,
    },
    {
      title: 'Current Allocated Hours/Day',
      dataIndex: 'allocatedHours',
      key: 'allocatedHours',
      render: (h) => (
        <Space>
          <ClockCircleOutlined style={{ color: token.colorPrimary }} />
          <Text strong style={{ color: token.colorPrimary }}>{Number(h || 8.5).toFixed(1)}h</Text>
        </Space>
      ),
    },
    {
      title: 'Set New Hours',
      key: 'setHours',
      render: (_, record) => (
        <Space>
          <InputNumber
            value={editingHours[record.id] ?? Number(record.allocatedHours) ?? 8.5}
            min={1}
            max={24}
            step={0.5}
            precision={1}
            style={{ width: 100 }}
            onChange={val => setEditingHours(prev => ({ ...prev, [record.id]: val }))}
            addonAfter="h/day"
          />
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={savingId === record.id}
            onClick={() => handleSave(record.id)}
            disabled={editingHours[record.id] === Number(record.allocatedHours)}
          >
            Save
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 80 }}>
      <PageHeader
        title="Work Hour Allocation"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Hour Allocation' }]}
      />

      {/* Summary Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, borderLeft: `4px solid ${token.colorPrimary}` }}>
            <Statistic
              title={<Text type="secondary">Total Team Members</Text>}
              value={totalEmployees}
              prefix={<TeamOutlined style={{ color: token.colorPrimary }} />}
              valueStyle={{ color: token.colorPrimary, fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #10b981' }}>
            <Statistic
              title={<Text type="secondary">Avg Hours/Day</Text>}
              value={avgHours}
              suffix="h"
              prefix={<ClockCircleOutlined style={{ color: '#10b981' }} />}
              valueStyle={{ color: '#10b981', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #f59e0b' }}>
            <Statistic
              title={<Text type="secondary">Total Team Hours/Day</Text>}
              value={totalHoursPerDay.toFixed(1)}
              suffix="h"
              prefix={<ClockCircleOutlined style={{ color: '#f59e0b' }} />}
              valueStyle={{ color: '#f59e0b', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        style={{ borderRadius: 16 }}
        title={
          <Space>
            <EditOutlined style={{ color: token.colorPrimary }} />
            <span style={{ fontWeight: 700 }}>Employee Hour Quotas</span>
          </Space>
        }
        extra={
          <Text type="secondary" style={{ fontSize: 12 }}>
            Set the maximum daily hours each employee can report in their EOD
          </Text>
        }
      >
        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <Table
            columns={columns}
            dataSource={users}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            rowClassName={(_, i) => i % 2 === 0 ? '' : (isDarkMode ? 'dark-alt-row' : 'light-alt-row')}
          />
        )}
      </Card>
    </div>
  );
};

export default HourAllocationPage;
