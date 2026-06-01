import React, { useState, useEffect } from 'react';
import { 
  Row, Col, Card, Typography, Select, Table, Button, 
  Statistic, Space, Avatar, Badge, Popconfirm, notification, Spin, Empty, Tag
} from 'antd';
import { 
  UserOutlined, ClockCircleOutlined, SwapOutlined, 
  ExclamationCircleOutlined, BookOutlined
} from '@ant-design/icons';
import { adminService } from '../../services/adminService';
import { ticketService } from '../../services/ticketService';
import { projectService } from '../../services/projectService';
import { useThemeStore } from '../../store/themeStore';
import PageHeader from '../../components/common/PageHeader';

const { Title, Text, Paragraph } = Typography;

const HROffboardingPage = () => {
  const { isDarkMode } = useThemeStore();
  
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, projectsRes, ticketsRes] = await Promise.all([
        adminService.getUsers(),
        projectService.getProjects(),
        ticketService.getTickets()
      ]);
      // Load all active employees and team leads who can have tickets assigned
      const activeStaff = (usersRes.data || []).filter(u => u.isActive !== false && u.role !== 'SuperAdmin');
      setUsers(activeStaff);
      setProjects(projectsRes.data || []);
      setTickets(ticketsRes.data || []);
    } catch (e) {
      notification.error({
        message: 'Error',
        description: 'Failed to load offboarding directory.'
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedUser = users.find(u => u.id === selectedUserId);

  // Tickets assigned to this user that are not Completed / Done
  const userActiveTickets = tickets.filter(t => {
    const isAssigned = String(t.assignedToUserId || t.assignedTo) === String(selectedUserId);
    const isNotDone = t.status !== 'Done';
    return isAssigned && isNotDone;
  });

  // Calculate remaining hours on each ticket
  const ticketDataWithHours = userActiveTickets.map(t => {
    // Base the estimation on the employee's allocated hours if available, otherwise fallback to ticket's estimated hours
    const allocated = Number(selectedUser?.allocatedHours || 0);
    const est = allocated > 0 ? allocated : Number(t.estimatedHours || 0);
    const spent = Number(t.consumedHours || 0);
    const remaining = Math.max(0, est - spent);
    return {
      ...t,
      estimatedHoursVal: est,
      spentHoursVal: spent,
      remainingHoursVal: remaining
    };
  });

  // Total remaining hours across all tickets
  const totalRemainingHours = ticketDataWithHours.reduce((acc, t) => acc + t.remainingHoursVal, 0);

  const columns = [
    {
      title: 'Ticket Code',
      dataIndex: 'code',
      key: 'code',
      width: 130,
      render: (code) => <Tag color="blue" style={{ fontFamily: 'monospace', fontWeight: 600 }}>{code}</Tag>
    },
    {
      title: 'Task Name',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => {
        const proj = projects.find(p => String(p.id) === String(record.projectId));
        return (
          <div>
            <Text strong>{title}</Text>
            <div style={{ marginTop: 2 }}>
              <Tag style={{ fontSize: 10 }}>Project: {proj?.name || 'General'}</Tag>
            </div>
          </div>
        );
      }
    },
    {
      title: 'Consumed Hours',
      dataIndex: 'spentHoursVal',
      key: 'spentHoursVal',
      width: 140,
      render: (hours) => <Text type="secondary">{hours.toFixed(2)} hrs</Text>
    }
  ];

  const handleOffboarding = async () => {
    if (!selectedUserId) return;
    setTransferring(true);
    try {
      // 1. Group remaining hours by project
      const projectHourIncrements = {};
      ticketDataWithHours.forEach(t => {
        if (!projectHourIncrements[t.projectId]) {
          projectHourIncrements[t.projectId] = 0;
        }
        projectHourIncrements[t.projectId] += t.remainingHoursVal;
      });

      // 2. Transfer hours to each project's totalHours
      for (const [projId, remainingHrs] of Object.entries(projectHourIncrements)) {
        if (remainingHrs > 0) {
          const proj = projects.find(p => String(p.id) === String(projId));
          if (proj) {
            const currentTotal = Number(proj.totalHours || 0);
            const newTotal = currentTotal + remainingHrs;
            
            await projectService.updateProjectStatus(proj.id, {
              status: proj.status || 'InProgress',
              totalHours: String(newTotal.toFixed(2))
            });
          }
        }
      }

      // 3. Unassign tickets from employee
      for (const ticket of ticketDataWithHours) {
        await ticketService.assignTicket(ticket.id, null);
      }

      // 4. Mark employee as Inactive
      await adminService.toggleUserStatus(selectedUserId);

      notification.success({
        message: 'Offboarding Successfully Completed',
        description: `Successfully deactivated employee "${selectedUser?.name || selectedUser?.fullName}". Transferred ${totalRemainingHours.toFixed(2)} hours back to the respective projects and unassigned ${ticketDataWithHours.length} active tasks.`
      });

      setSelectedUserId(null);
      await loadData();
    } catch (error) {
      notification.error({
        message: 'Offboarding Failed',
        description: 'An error occurred during the offboarding and hours transfer process.'
      });
    } finally {
      setTransferring(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader 
        title="Employee Offboarding & Hours Transfer" 
        subTitle="Deactivate departing employees, retrieve their remaining budget hours, and credit them back to the active projects."
      />

      <Row gutter={[24, 24]}>
        {/* Left Column: Selector */}
        <Col xs={24} lg={8}>
          <Card 
            title={
              <Space>
                <UserOutlined />
                <span>Select Employee Leaving</span>
              </Space>
            }
            style={{ 
              borderRadius: 16,
              boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(0,0,0,0.03)',
              border: isDarkMode ? '1px solid #3f3f46' : '1px solid #e8e8e8'
            }}
          >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Paragraph type="secondary">
                  Choose the active employee or team lead who is exiting the organization.
                </Paragraph>
                <Select
                  placeholder="Select employee..."
                  style={{ width: '100%', height: 45 }}
                  value={selectedUserId}
                  onChange={setSelectedUserId}
                  showSearch
                  optionFilterProp="children"
                >
                  {users.map(u => (
                    <Select.Option key={u.id} value={u.id}>
                      {u.name || u.fullName} ({u.role} - {u.email})
                    </Select.Option>
                  ))}
                </Select>
              </div>

              {selectedUser && (
                <Card 
                  style={{ 
                    borderRadius: 12, 
                    background: isDarkMode ? '#18181b' : '#fafafa',
                    border: 'none'
                  }}
                  bodyStyle={{ padding: 16 }}
                >
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar size="large" icon={<UserOutlined />} style={{ backgroundColor: '#4f46e5' }} />
                      <div>
                        <Title level={5} style={{ margin: 0 }}>{selectedUser.name || selectedUser.fullName}</Title>
                        <Text type="secondary" style={{ fontSize: 12 }}>{selectedUser.email}</Text>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text type="secondary">Role:</Text>
                        <Tag color="purple">{selectedUser.role}</Tag>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text type="secondary">Allocated Hours:</Text>
                        <Text strong>{selectedUser.allocatedHours || '0.00'} hrs</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary">Status:</Text>
                        <Badge status="success" text="Active Staff" />
                      </div>
                    </div>
                  </Space>
                </Card>
              )}
            </Space>
          </Card>
        </Col>

        {/* Right Column: Ticket details and Transfer Actions */}
        <Col xs={24} lg={16}>
          {!selectedUserId ? (
            <Card 
              style={{ 
                borderRadius: 16, 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                border: isDarkMode ? '1px solid #3f3f46' : '1px solid #e8e8e8'
              }}
            >
              <Empty 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Please select an exiting employee from the left panel to review offboarding details."
              />
            </Card>
          ) : (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* Stats and Transfer trigger */}
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
                    <Statistic 
                      title="Pending Tasks to Release" 
                      value={ticketDataWithHours.length} 
                      prefix={<BookOutlined style={{ color: '#1890ff' }} />} 
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12}>
                  <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
                    <Statistic 
                      title="Total Hours to Credit back" 
                      value={totalRemainingHours} 
                      precision={2}
                      prefix={<ClockCircleOutlined style={{ color: '#ef4444' }} />} 
                      suffix="hrs"
                    />
                  </Card>
                </Col>
              </Row>

              <Card 
                title="Active Assigned Tickets & Remaining Hours"
                style={{ 
                  borderRadius: 16,
                  boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(0,0,0,0.03)',
                  border: isDarkMode ? '1px solid #3f3f46' : '1px solid #e8e8e8'
                }}
                extra={
                  <Popconfirm
                    title="Confirm Offboarding"
                    description={`Are you sure you want to transfer ${totalRemainingHours.toFixed(2)} hours, unassign ${ticketDataWithHours.length} tasks, and deactivate this employee?`}
                    onConfirm={handleOffboarding}
                    okText="Yes, Offboard"
                    cancelText="Cancel"
                    icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
                  >
                    <Button 
                      type="primary" 
                      danger 
                      icon={<SwapOutlined />} 
                      loading={transferring}
                      disabled={transferring}
                    >
                      Complete Offboarding & Transfer Hours
                    </Button>
                  </Popconfirm>
                }
              >
                <Table 
                  dataSource={ticketDataWithHours}
                  columns={columns}
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                  locale={{ emptyText: 'This employee has no active/incomplete tickets to transfer.' }}
                />
              </Card>
            </Space>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default HROffboardingPage;
