import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Avatar, Button, Modal, Form, Input, Select, DatePicker,
  message, Row, Col, Space, Typography, Spin, Empty, Tooltip, Tag, List
} from 'antd';
import {
  UserOutlined, SwapOutlined, TeamOutlined, SolutionOutlined,
  CalendarOutlined, FieldTimeOutlined, InfoCircleOutlined, RightOutlined
} from '@ant-design/icons';
import { adminService } from '../../services/adminService';
import { projectService } from '../../services/projectService';
import { ticketService } from '../../services/ticketService';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import PageHeader from '../../components/common/PageHeader';

const { Text, Title, Paragraph } = Typography;

const CrossTeamSharePage = () => {
  const { currentUser } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [myProjects, setMyProjects] = useState([]);
  const [tickets, setTickets] = useState([]);
  
  // Borrow Modal State
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedTL, setSelectedTL] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [userRes, projRes, ticketRes] = await Promise.all([
        adminService.getUsers(),
        projectService.getProjects(),
        ticketService.getTickets().catch(err => { console.error(err); return { data: [] }; })
      ]);
      setUsers(userRes.data);
      setTickets(ticketRes.data || []);
      
      // Filter projects that are active (Approved or InProgress) 
      // AND either assigned to me as Team Lead, or general active projects where I can assign.
      const activeProj = projRes.data.filter(p => 
        ['Approved', 'InProgress'].includes(p.status) &&
        (String(p.assignedTeamLeadId) === String(currentUser?.id || currentUser?.userId))
      );
      setMyProjects(activeProj);
    } catch (err) {
      message.error('Failed to load user, project and ticket data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Group employees under their home Team Leads
  const groupedTeams = useMemo(() => {
    const teamLeads = users.filter(u => u.role === 'TeamLead');
    const employees = users.filter(u => u.role === 'Employee');

    return teamLeads.map(tl => {
      const tlIdStr = String(tl.id || tl.userId);
      const teamEmployees = employees.filter(emp => String(emp.teamLeadId) === tlIdStr);
      return {
        teamLead: tl,
        employees: teamEmployees
      };
    }).filter(t => t.teamLead.id !== currentUser?.id && t.teamLead.userId !== currentUser?.userId); // filter out logged-in TL's own team
  }, [users, currentUser]);

  // Compute borrowed employees mapped by employee ID
  const borrowedEmployeesMap = useMemo(() => {
    const map = {};
    const currentTLIdStr = String(currentUser?.id || currentUser?.userId);
    
    myProjects.forEach(proj => {
      const projTickets = tickets.filter(t => String(t.projectId) === String(proj.id));
      projTickets.forEach(ticket => {
        const assigneeId = ticket.assignedToUserId || ticket.assignedTo;
        if (!assigneeId) return;
        
        const assignee = users.find(u => String(u.id || u.userId) === String(assigneeId));
        if (!assignee || assignee.role !== 'Employee') return;
        
        if (String(assignee.teamLeadId) !== currentTLIdStr) {
          if (!map[assigneeId]) {
            map[assigneeId] = [];
          }
          map[assigneeId].push({
            ticket,
            project: proj
          });
        }
      });
    });
    return map;
  }, [tickets, myProjects, users, currentUser]);

  const handleOpenBorrowModal = (employee, tl) => {
    setSelectedEmployee(employee);
    setSelectedTL(tl);
    form.resetFields();
    setIsBorrowModalOpen(true);
  };

  const handleBorrowSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!selectedEmployee) return;

      setSubmitting(true);

      const borrowingTLName = currentUser?.name || currentUser?.fullName || 'Another Team Lead';
      const homeTLName = selectedTL?.name || selectedTL?.fullName || 'Home Team Lead';
      
      // Append cross-team sharing details to the ticket description
      const fullDescription = `${values.description || ''}\n\n` + 
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🔄 [CROSS-TEAM BORROWED TICKET]\n` +
        `• Borrowing Team Lead: ${borrowingTLName}\n` +
        `• Home Team Lead: ${homeTLName}\n` +
        `• Status: Approved Sharing\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      const ticketPayload = {
        title: `Borrowed: ${values.title}`,
        description: fullDescription,
        priority: values.priority || 'Medium',
        estimatedHours: 0,
        startDate: values.startDate ? values.startDate.toISOString() : null,
        dueDate: values.dueDate ? values.dueDate.toISOString() : null,
        assignedToUserId: selectedEmployee.id || selectedEmployee.userId,
        milestone: values.milestone || 'Cross-Team Sharing'
      };

      await ticketService.createTicket(values.projectId, ticketPayload);
      
      message.success(`Successfully borrowed ${selectedEmployee.name || selectedEmployee.fullName}! Ticket assigned.`);
      setIsBorrowModalOpen(false);
      loadData();
    } catch (err) {
      if (err?.errorFields) return; // form validation error
      message.error('Failed to create borrow ticket');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader 
        title="Cross-Team Resource Sharing" 
        subtitle="View other team leads and borrow employees for active project tasks" 
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" tip="Loading teams & structures..." />
        </div>
      ) : groupedTeams.length === 0 ? (
        <Empty description="No other Team Leads found in this workspace." />
      ) : (
        <>
          <Row gutter={[24, 24]}>
          {groupedTeams.map(({ teamLead, employees }) => {
            const tlName = teamLead.name || teamLead.fullName;
            return (
              <Col xs={24} md={12} lg={8} key={teamLead.id || teamLead.userId}>
                <Card 
                  hoverable
                  style={{
                    borderRadius: 16,
                    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(99, 102, 241, 0.08)'}`,
                    background: isDarkMode ? '#18181b' : '#ffffff',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                  }}
                  bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', flex: 1 }}
                >
                  {/* Team Lead Header */}
                  <div style={{
                    padding: '20px 24px',
                    background: isDarkMode ? '#27272a' : 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
                    borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : '#ede9fe'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                  }}>
                    <Avatar 
                      size={44} 
                      style={{ backgroundColor: '#6366f1' }}
                      src={teamLead.avatar}
                      icon={<TeamOutlined />}
                    />
                    <div>
                      <Title level={5} style={{ margin: 0, fontSize: 16 }}>{tlName}</Title>
                      <Tag color="purple" style={{ marginTop: 4, borderRadius: 4 }}>Team Lead</Tag>
                    </div>
                  </div>

                  {/* Employees List */}
                  <div style={{ padding: '16px 24px', flex: 1 }}>
                    <Text type="secondary" strong style={{ fontSize: 11, display: 'block', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Allotted Employees ({employees.length})
                    </Text>

                    {employees.length === 0 ? (
                      <Empty 
                        image={Empty.PRESENTED_IMAGE_SIMPLE} 
                        description={<span style={{ fontSize: 12 }}>No employees allotted to this team.</span>} 
                      />
                    ) : (
                      <List
                        dataSource={employees}
                        renderItem={emp => {
                          const borrowDetails = borrowedEmployeesMap[emp.id || emp.userId];
                          return (
                            <List.Item 
                              style={{ 
                                padding: '10px 0', 
                                borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.04)' : '#f1f5f9'}`
                              }}
                              actions={[
                                borrowDetails ? (
                                  <Tag color="green" style={{ borderRadius: 6, fontWeight: 600, margin: 0 }}>
                                    Borrowed
                                  </Tag>
                                ) : (
                                  <Button 
                                    type="primary" 
                                    size="small"
                                    icon={<SwapOutlined />}
                                    onClick={() => handleOpenBorrowModal(emp, teamLead)}
                                    style={{ borderRadius: 6, fontSize: 12 }}
                                  >
                                    Borrow
                                  </Button>
                                )
                              ]}
                            >
                              <List.Item.Meta
                                avatar={
                                  <Avatar 
                                    src={emp.avatar} 
                                    icon={<UserOutlined />} 
                                    style={{ backgroundColor: isDarkMode ? '#3f3f46' : '#e2e8f0' }} 
                                  />
                                }
                                title={
                                  <Space direction="vertical" size={2} style={{ display: 'flex' }}>
                                    <Text strong style={{ fontSize: 13 }}>{emp.name || emp.fullName}</Text>
                                    {borrowDetails && (
                                      <Text type="success" style={{ fontSize: 11, fontWeight: 600 }}>
                                        (Borrowed for: {borrowDetails[0].project.name})
                                      </Text>
                                    )}
                                  </Space>
                                }
                                description={<Text type="secondary" style={{ fontSize: 11 }}>{emp.email}</Text>}
                              />
                            </List.Item>
                          );
                        }}
                      />
                    )}
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>

        {/* Borrowed Resources Status Section */}
        <Card 
          title={
            <Space>
              <SolutionOutlined style={{ color: '#10b981' }} />
              <span style={{ fontWeight: 600 }}>Active Borrowed Resources</span>
            </Space>
          }
          style={{ borderRadius: 16, border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(16, 185, 129, 0.08)'}`, marginTop: 24, background: isDarkMode ? '#18181b' : '#fff' }}
        >
          {Object.keys(borrowedEmployeesMap).length === 0 ? (
            <Empty description="No employees borrowed from other teams currently." />
          ) : (
            <List
              itemLayout="horizontal"
              dataSource={Object.keys(borrowedEmployeesMap)}
              renderItem={empId => {
                const emp = users.find(u => String(u.id || u.userId) === String(empId));
                const details = borrowedEmployeesMap[empId];
                if (!emp) return null;
                
                const homeTL = users.find(u => String(u.id || u.userId) === String(emp.teamLeadId));
                
                return (
                  <List.Item
                    style={{ padding: '16px 24px', borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.04)' : '#f1f5f9'}` }}
                    actions={details.map(d => (
                      <Tag color="geekblue" key={d.ticket.id} style={{ padding: '4px 10px', borderRadius: 6, fontWeight: 500 }}>
                        Ticket: {d.ticket.title} ({d.ticket.code})
                      </Tag>
                    ))}
                  >
                    <List.Item.Meta
                      avatar={<Avatar size="large" src={emp.avatar} icon={<UserOutlined />} style={{ backgroundColor: '#10b981' }} />}
                      title={
                        <Space>
                          <Text strong style={{ fontSize: 14 }}>{emp.name || emp.fullName}</Text>
                          <Tag color="success" style={{ borderRadius: 4, fontWeight: 500 }}>Borrowed by You</Tag>
                        </Space>
                      }
                      description={
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Home Team Lead: <strong style={{ color: isDarkMode ? '#e2e8f0' : '#475569' }}>{homeTL ? (homeTL.name || homeTL.fullName) : 'Unknown'}</strong>
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Working on Project: <strong style={{ color: '#6366f1' }}>{details[0].project.name}</strong>
                          </Text>
                        </div>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          )}
        </Card>
      </>
    )}

      {/* Borrow Employee & Ticket Assignment Modal */}
      <Modal
        title={
          <Space>
            <SwapOutlined style={{ color: '#6366f1' }} />
            <span>Borrow {selectedEmployee?.name || selectedEmployee?.fullName}</span>
          </Space>
        }
        open={isBorrowModalOpen}
        onCancel={() => setIsBorrowModalOpen(false)}
        onOk={handleBorrowSubmit}
        confirmLoading={submitting}
        okText="Assign & Borrow"
        cancelText="Cancel"
        destroyOnClose
        width="min(550px, calc(100vw - 32px))"
        styles={{ body: { paddingTop: 16 } }}
      >
        {myProjects.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <InfoCircleOutlined style={{ fontSize: 32, color: '#fa8c16', marginBottom: 12 }} />
            <Paragraph>
              You do not have any active projects assigned to you as Team Lead.
            </Paragraph>
            <Text type="secondary" style={{ fontSize: 12 }}>
              To borrow resources, you must first have an active project assigned to your team.
            </Text>
          </div>
        ) : (
          <Form form={form} layout="vertical" requiredMark={false}>
            <Form.Item 
              name="projectId" 
              label="Select Project (to assign resource to)" 
              rules={[{ required: true, message: 'Please select a project' }]}
            >
              <Select placeholder="Select one of your active projects">
                {myProjects.map(p => (
                  <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item 
              name="title" 
              label="Ticket Title" 
              rules={[{ required: true, message: 'Please enter a ticket title' }]}
            >
              <Input placeholder="E.g., Assistance with Database Schema Migration" />
            </Form.Item>

            <Form.Item 
              name="description" 
              label="Description of Task" 
              rules={[{ required: true, message: 'Please enter description of tasks' }]}
            >
              <Input.TextArea rows={4} placeholder="Please detail the precise tasks this employee will help you complete..." />
            </Form.Item>

            <div style={{ display: 'flex', gap: 16 }}>
              <Form.Item name="startDate" label="Start Date" rules={[{ required: true, message: 'Start date is required' }]} style={{ flex: 1 }}>
                <DatePicker style={{ width: '100%' }} suffixIcon={<CalendarOutlined />} />
              </Form.Item>
              <Form.Item name="dueDate" label="Due Date" rules={[{ required: true, message: 'Due date is required' }]} style={{ flex: 1 }}>
                <DatePicker style={{ width: '100%' }} suffixIcon={<CalendarOutlined />} />
              </Form.Item>
            </div>

            <Form.Item name="priority" label="Priority" initialValue="Medium">
              <Select>
                <Select.Option value="Low">Low</Select.Option>
                <Select.Option value="Medium">Medium</Select.Option>
                <Select.Option value="High">High</Select.Option>
                <Select.Option value="Critical">Critical</Select.Option>
              </Select>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default CrossTeamSharePage;
