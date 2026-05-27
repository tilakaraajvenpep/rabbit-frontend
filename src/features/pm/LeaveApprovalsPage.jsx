import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Space, Typography, notification, Avatar, Row, Col, Statistic } from 'antd';
import { CalendarOutlined, CheckCircleOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { leaveService } from '../../services/leaveService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Text } = Typography;

const LeaveApprovalsPage = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const { isDarkMode } = useThemeStore();

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await leaveService.getAllLeaves();
      // Show only HR-approved leaves — descending order (newest first)
      const approved = (res.data || [])
        .filter(l => l.status === 'Approved')
        .sort((a, b) => dayjs(b.leaveDate).unix() - dayjs(a.leaveDate).unix());
      setLeaves(approved);
    } catch (e) {
      notification.error({ message: 'Error', description: 'Failed to fetch leave records.' });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Employee',
      dataIndex: ['user', 'fullName'],
      key: 'employeeName',
      render: (name, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#10b981' }} size="small" />
          <Space direction="vertical" size={0}>
            <Text strong>{name || 'N/A'}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{record.user?.email}</Text>
          </Space>
        </Space>
      )
    },
    {
      title: 'Leave Date',
      dataIndex: 'leaveDate',
      key: 'leaveDate',
      defaultSortOrder: 'descend',
      sorter: (a, b) => dayjs(a.leaveDate).unix() - dayjs(b.leaveDate).unix(),
      render: (date) => dayjs(date).format('DD MMM YYYY (dddd)'),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type) => (
        <Tag color={type === 'FullDay' ? 'purple' : 'cyan'} style={{ borderRadius: 6 }}>
          {type === 'FullDay' ? 'Full Day' : 'Half Day'}
        </Tag>
      ),
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason) => reason || <Text type="secondary">N/A</Text>,
    },
    {
      title: 'Applied On',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 190,
      render: (date) => dayjs(date).format('DD MMM YYYY, hh:mm A'),
    },
    {
      title: 'Status',
      key: 'status',
      width: 140,
      render: () => (
        <Tag icon={<CheckCircleOutlined />} color="success" style={{ borderRadius: 6 }}>
          Approved by HR
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
      <PageHeader
        title="Leave Approvals"
        subTitle="View all HR-approved employee leaves for awareness and project planning."
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12}>
          <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
            <Statistic
              title="Total HR-Approved Leaves"
              value={leaves.length}
              prefix={<CalendarOutlined style={{ color: '#10b981' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
            <Statistic
              title="Unique Employees on Leave"
              value={new Set(leaves.map(l => l.userId)).size}
              prefix={<TeamOutlined style={{ color: '#6366f1' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#10b981' }} />
            <span>HR-Approved Leaves ({leaves.length})</span>
          </Space>
        }
        style={{ borderRadius: 12, boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)' }}
      >
        <Table
          columns={columns}
          dataSource={leaves}
          rowKey="leaveId"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          locale={{ emptyText: 'No HR-approved leaves found.' }}
        />
      </Card>
    </div>
  );
};

export default LeaveApprovalsPage;
