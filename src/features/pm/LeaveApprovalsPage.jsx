import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Space, Typography, notification, Avatar, Row, Col, Statistic } from 'antd';
import { CalendarOutlined, CheckCircleOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { leaveService } from '../../services/leaveService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';
import { adminService } from '../../services/adminService';
import { useAuthStore } from '../../store/authStore';

const { Text } = Typography;

const LeaveApprovalsPage = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const { isDarkMode } = useThemeStore();
  const { currentUser, role } = useAuthStore();

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const [leaveRes, userRes] = await Promise.all([
        leaveService.getAllLeaves(),
        adminService.getUsers()
      ]);

      const allUsers = userRes.data || [];
      const pmId = currentUser?.userId || currentUser?.id;

      // Filter users who are associated with the current user
      const associatedUsers = allUsers.filter(u => {
        if (u.role !== 'Employee' && u.role !== 'TeamLead') return false;
        if (role === 'ProjectManager') {
          if (u.role === 'TeamLead') {
            return String(u.projectManagerId) === String(pmId);
          }
          if (u.role === 'Employee') {
            if (String(u.projectManagerId) === String(pmId)) return true;
            if (u.teamLeadId) {
              const tl = allUsers.find(tlUser => String(tlUser.id) === String(u.teamLeadId));
              if (tl && String(tl.projectManagerId) === String(pmId)) return true;
            }
            return false;
          }
        } else if (role === 'TeamLead') {
          if (u.role === 'TeamLead') {
            return String(u.id || u.userId) === String(pmId);
          }
          if (u.role === 'Employee') {
            return String(u.teamLeadId) === String(pmId);
          }
        }
        return true;
      });

      const associatedUserIds = new Set(associatedUsers.map(u => String(u.id || u.userId)));

      // Show only HR-approved leaves for associated users — descending order (newest first)
      const approved = (leaveRes.data || [])
        .filter(l => l.status === 'Approved' && associatedUserIds.has(String(l.userId)))
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
      render: (type) => {
        let color = 'cyan';
        let label = 'Half Day';
        if (type === 'FullDay') {
          color = 'purple';
          label = 'Full Day';
        } else if (type === 'Permission') {
          color = 'orange';
          label = 'Permission';
        }
        return (
          <Tag color={color} style={{ borderRadius: 6 }}>
            {label}
          </Tag>
        );
      },
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
          pagination={{ 
            pageSize: pageSize, 
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, size) => setPageSize(size),
            onShowSizeChange: (current, size) => setPageSize(size)
          }}
          locale={{ emptyText: 'No HR-approved leaves found.' }}
        />
      </Card>
    </div>
  );
};

export default LeaveApprovalsPage;
