import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Space, Typography, notification, Spin, Row, Col, Statistic, Select } from 'antd';
import { CalendarOutlined, CheckCircleOutlined, InfoCircleOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { leaveService } from '../../services/leaveService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Title, Text } = Typography;

const HRApprovedLeavesPage = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const { isDarkMode } = useThemeStore();

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await leaveService.getAllLeaves();
      // Filter only Approved leaves
      const approved = (res.data || []).filter(l => l.status === 'Approved');
      setLeaves(approved);
    } catch (e) {
      notification.error({
        message: 'Error',
        description: 'Failed to fetch approved leave logs.'
      });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Employee Name',
      dataIndex: ['user', 'fullName'],
      key: 'employeeName',
      render: (name, record) => (
        <Space>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: '#87d068',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff'
          }}>
            <UserOutlined />
          </div>
          <Space direction="vertical" size={0}>
            <Text strong>{name || record.user?.email || 'N/A'}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{record.user?.email}</Text>
          </Space>
        </Space>
      )
    },
    {
      title: 'Leave Date',
      dataIndex: 'leaveDate',
      key: 'leaveDate',
      render: (date) => dayjs(date).format('DD MMM YYYY (dddd)'),
      sorter: (a, b) => dayjs(a.leaveDate).unix() - dayjs(b.leaveDate).unix(),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color={type === 'FullDay' ? 'indigo' : 'cyan'} style={{ borderRadius: 4 }}>
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
      title: 'Approval Status',
      dataIndex: 'status',
      key: 'status',
      render: () => (
        <Tag color="green" icon={<CheckCircleOutlined />} style={{ borderRadius: 4 }}>
          Approved
        </Tag>
      )
    }
  ];

  // Filtering by Month logic
  const months = [
    { value: 'all', label: 'All Months' },
    ...Array.from({ length: 12 }, (_, i) => {
      const date = dayjs().month(i);
      return { value: date.format('YYYY-MM'), label: date.format('MMMM YYYY') };
    })
  ];

  const filteredLeaves = leaves.filter(l => {
    if (selectedMonth === 'all') return true;
    return dayjs(l.leaveDate).format('YYYY-MM') === selectedMonth;
  });

  const totalFullDay = filteredLeaves.filter(l => l.type === 'FullDay').length;
  const totalHalfDay = filteredLeaves.filter(l => l.type === 'HalfDay').length;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader 
        title="Approved Leave Logs" 
        subTitle="Historical record of all approved employee and team lead absences."
      />

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
              <Statistic 
                title="Total Approved Absences" 
                value={filteredLeaves.length} 
                prefix={<CalendarOutlined style={{ color: '#52c41a' }} />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
              <Statistic 
                title="Full Day Leaves" 
                value={totalFullDay} 
                prefix={<CheckCircleOutlined style={{ color: '#4f46e5' }} />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
              <Statistic 
                title="Half Day Leaves" 
                value={totalHalfDay} 
                prefix={<InfoCircleOutlined style={{ color: '#06b6d4' }} />} 
              />
            </Card>
          </Col>
        </Row>

        <Card 
          style={{ 
            borderRadius: 12,
            boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(0,0,0,0.05)',
            border: isDarkMode ? '1px solid #3f3f46' : '1px solid #e8e8e8'
          }}
        >
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>Filter by Month:</Text>
            <Select
              style={{ width: 220 }}
              placeholder="Select a month"
              value={selectedMonth}
              onChange={setSelectedMonth}
              options={months}
            />
          </div>

          <Table
            dataSource={filteredLeaves}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: 'No approved leave logs found for this period.' }}
          />
        </Card>
      </Space>
    </div>
  );
};

export default HRApprovedLeavesPage;
