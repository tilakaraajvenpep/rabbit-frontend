import React, { useState, useEffect } from 'react';
import { 
  Row, Col, Card, Typography, Select, Table, Button, 
  Statistic, Space, Avatar, Badge, Popconfirm, notification, Spin, Empty, Tag, Alert
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
  const [allUsersList, setAllUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userTickets, setUserTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, projectsRes] = await Promise.all([
        adminService.getUsers(),
        projectService.getProjects()
      ]);
      const rawUsers = usersRes.data || [];
      setAllUsersList(rawUsers);
      // Load all active employees and team leads who can have tickets assigned
      const activeStaff = rawUsers.filter(u => u.isActive !== false && u.role !== 'SuperAdmin');
      setUsers(activeStaff);
      setProjects(projectsRes.data || []);
    } catch (e) {
      notification.error({
        message: 'Error',
        description: 'Failed to load offboarding directory.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedUserId) {
      fetchUserTickets(selectedUserId);
    } else {
      setUserTickets([]);
    }
  }, [selectedUserId]);

  const fetchUserTickets = async (userId) => {
    setLoadingTickets(true);
    try {
      const ticketsRes = await ticketService.getTickets();
      const allTickets = ticketsRes.data || [];
      const filtered = allTickets.filter(t => String(t.assignedToUserId || t.assignedTo) === String(userId));
      setUserTickets(filtered);
    } catch (e) {
      notification.error({
        message: 'Error',
        description: 'Failed to fetch tickets for the selected employee.'
      });
    } finally {
      setLoadingTickets(false);
    }
  };

  const selectedUser = users.find(u => u.id === selectedUserId);
  const teamLead = allUsersList.find(u => String(u.id || u.userId) === String(selectedUser?.teamLeadId));
  const pm = allUsersList.find(u => String(u.id || u.userId) === String(selectedUser?.projectManagerId));

  // Compute ticket-level hours
  const totalEstimatedHours = userTickets.reduce((sum, t) => sum + Number(t.estimatedHours || 0), 0);
  const totalConsumedHours = userTickets.reduce((sum, t) => sum + Number(t.consumedHours || 0), 0);
  const totalRemainingHours = userTickets.reduce((sum, t) => sum + Math.max(0, Number(t.estimatedHours || 0) - Number(t.consumedHours || 0)), 0);
  const hasUtilized = totalConsumedHours > 0;

  const ticketColumns = [
    {
      title: 'Ticket Code',
      dataIndex: 'code',
      key: 'code',
      width: 120,
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
      title: 'Estimated Hours',
      dataIndex: 'estimatedHours',
      key: 'estimatedHours',
      width: 130,
      render: (hours) => <Text>{Number(hours || 0).toFixed(2)} hrs</Text>
    },
    {
      title: 'Consumed Hours',
      dataIndex: 'consumedHours',
      key: 'consumedHours',
      width: 130,
      render: (hours) => <Text type="secondary">{Number(hours || 0).toFixed(2)} hrs</Text>
    },
    {
      title: 'Remaining Hours',
      key: 'remainingHours',
      width: 130,
      render: (_, record) => {
        const est = Number(record.estimatedHours || 0);
        const cons = Number(record.consumedHours || 0);
        const rem = Math.max(0, est - cons);
        return <Text type={rem > 0 ? 'success' : 'secondary'} strong={rem > 0}>{rem.toFixed(2)} hrs</Text>;
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        let color = 'default';
        if (status === 'Done') color = 'success';
        if (status === 'InProgress') color = 'processing';
        if (status === 'ToDo') color = 'default';
        return <Tag color={color}>{status}</Tag>;
      }
    }
  ];

  const handleOffboarding = async () => {
    if (!selectedUserId) return;
    setTransferring(true);
    try {
      // 1. Update project allocations and credit back remaining hours if they utilized hours
      const projectHoursUpdate = {};
      userTickets.forEach(t => {
        const est = Number(t.estimatedHours || 0);
        const cons = Number(t.consumedHours || 0);
        const rem = Math.max(0, est - cons);
        if (!projectHoursUpdate[t.projectId]) {
          projectHoursUpdate[t.projectId] = { consumed: 0, remaining: 0 };
        }
        projectHoursUpdate[t.projectId].consumed += cons;
        projectHoursUpdate[t.projectId].remaining += rem;
      });

      // Update projects' totalHours and employeeAllocatedHours
      for (const proj of projects) {
        const hasAllocation = proj.employeeAllocatedHours && proj.employeeAllocatedHours[selectedUserId] !== undefined;
        const hasTickets = projectHoursUpdate[proj.id] !== undefined;

        if (hasAllocation || hasTickets) {
          const currentAllocations = { ...(proj.employeeAllocatedHours || {}) };
          
          if (!hasUtilized) {
            // Case 1: Not utilized. Set allocation to 0, no hours credited back.
            currentAllocations[selectedUserId] = 0;
            await projectService.updateProjectStatus(proj.id, {
              status: proj.status || 'InProgress',
              employeeAllocatedHours: currentAllocations
            });
          } else {
            // Case 2: Utilized. Set allocation to consumed hours, credit remaining back.
            const consumedOnProject = hasTickets ? projectHoursUpdate[proj.id].consumed : 0;
            const remainingOnProject = hasTickets ? projectHoursUpdate[proj.id].remaining : 0;
            
            currentAllocations[selectedUserId] = consumedOnProject;
            
            if (remainingOnProject > 0) {
              const currentTotal = Number(proj.totalHours || 0);
              const newTotal = currentTotal + remainingOnProject;
              await projectService.updateProjectStatus(proj.id, {
                status: proj.status || 'InProgress',
                totalHours: String(newTotal.toFixed(2)),
                employeeAllocatedHours: currentAllocations
              });
            } else {
              await projectService.updateProjectStatus(proj.id, {
                status: proj.status || 'InProgress',
                employeeAllocatedHours: currentAllocations
              });
            }
          }
        }
      }

      // 2. Unassign tickets from employee
      for (const ticket of userTickets) {
        await ticketService.assignTicket(ticket.id, null);
      }

      // 3. Mark employee as Inactive
      await adminService.toggleUserStatus(selectedUserId);

      notification.success({
        message: 'Offboarding Successfully Completed',
        description: hasUtilized 
          ? `Successfully deactivated employee "${selectedUser?.name || selectedUser?.fullName}". Credited back ${totalRemainingHours.toFixed(2)} remaining hours to projects and unassigned ${userTickets.length} tasks.`
          : `Successfully deactivated employee "${selectedUser?.name || selectedUser?.fullName}" and unassigned ${userTickets.length} tasks. (No hours utilized, so no hours were credited back).`
      });

      setSelectedUserId(null);
      setUserTickets([]);
      await loadData();
    } catch (error) {
      notification.error({
        message: 'Offboarding Failed',
        description: 'An error occurred during the offboarding process.'
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
        subTitle="Deactivate departing employees, retrieve their remaining ticket hours, and credit them back to the active projects."
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
                        <Text type="secondary">Team Leader:</Text>
                        <Text strong>{teamLead ? (teamLead.name || teamLead.fullName) : 'Not Assigned'}</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text type="secondary">Project Manager:</Text>
                        <Text strong>{pm ? (pm.name || pm.fullName) : 'Not Assigned'}</Text>
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
              {/* Stats / Overall Hours Display */}
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                  <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
                    <Statistic 
                      title="Total Estimated Hours" 
                      value={totalEstimatedHours} 
                      precision={2}
                      prefix={<BookOutlined style={{ color: '#1890ff' }} />} 
                      suffix="hrs"
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
                    <Statistic 
                      title="Total Consumed Hours" 
                      value={totalConsumedHours} 
                      precision={2}
                      prefix={<ClockCircleOutlined style={{ color: '#ef4444' }} />} 
                      suffix="hrs"
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card style={{ borderRadius: 12, border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0' }}>
                    <Statistic 
                      title="Overall Remaining Hours" 
                      value={totalRemainingHours} 
                      precision={2}
                      prefix={<SwapOutlined style={{ color: '#52c41a' }} />} 
                      suffix="hrs"
                    />
                  </Card>
                </Col>
              </Row>

              {/* Status Alert */}
              <Alert 
                message={hasUtilized ? "Hours Utilized on Tickets" : "No Hours Utilized"}
                description={
                  hasUtilized 
                    ? `This employee has utilized hours on their tasks. Completing offboarding will deactivate the user, unassign their tickets, and credit back their remaining ticket hours (${totalRemainingHours.toFixed(2)} hrs) individually to the respective projects' total hours.`
                    : "This employee has not utilized any hours on their tasks. Completing offboarding will just deactivate the user and unassign their tickets. No hours will be credited back to any projects."
                }
                type={hasUtilized ? "warning" : "info"}
                showIcon
                style={{ borderRadius: 12 }}
              />

              {/* Tickets Table Card */}
              <Card 
                title="Assigned Tickets & Hours Breakdown"
                style={{ 
                  borderRadius: 16,
                  boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(0,0,0,0.03)',
                  border: isDarkMode ? '1px solid #3f3f46' : '1px solid #e8e8e8'
                }}
                extra={
                  <Popconfirm
                    title="Confirm Offboarding"
                    description={
                      hasUtilized
                        ? `Are you sure you want to deactivate this employee and transfer ${totalRemainingHours.toFixed(2)} remaining hours back to the projects?`
                        : "Are you sure you want to deactivate this employee? (No hours were utilized)."
                    }
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
                      {hasUtilized ? "Complete Offboarding & Transfer Hours" : "Complete Offboarding"}
                    </Button>
                  </Popconfirm>
                }
              >
                <Table 
                  dataSource={userTickets}
                  columns={ticketColumns}
                  rowKey="id"
                  loading={loadingTickets}
                  pagination={{ pageSize: 5 }}
                  scroll={{ x: 750 }}
                  locale={{ emptyText: 'No tickets assigned to this employee.' }}
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
