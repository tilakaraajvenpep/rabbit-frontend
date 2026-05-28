import React, { useState, useEffect } from 'react';
import { Card, Table, Avatar, Badge, Spin, Typography, Space, notification, Tooltip, Drawer, InputNumber, Divider, Timeline, Descriptions, Button, Empty, Tag } from 'antd';
import { UserOutlined, ClockCircleOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { projectService } from '../../services/projectService';
import { ticketService } from '../../services/ticketService';
import { adminService } from '../../services/adminService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Text, Title } = Typography;

const HRProjectsPage = () => {
  const [loading, setLoading] = useState(true);
  const [projectList, setProjectList] = useState([]);
  const { isDarkMode } = useThemeStore();

  const [selectedProject, setSelectedProject] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [allocatedHoursInput, setAllocatedHoursInput] = useState({});
  const [savingAllocations, setSavingAllocations] = useState(false);

  const handleSelectProject = (project) => {
    setSelectedProject(project);
    const initHours = {};
    if (project.employees && project.employees.length > 0) {
      project.employees.forEach(emp => {
        const empId = emp.id || emp.userId;
        initHours[empId] = project.employeeAllocatedHours?.[empId] || 0;
      });
    }
    setAllocatedHoursInput(initHours);
    setIsDrawerOpen(true);
  };

  const handleHourChange = (employeeId, value) => {
    setAllocatedHoursInput(prev => ({
      ...prev,
      [employeeId]: value || 0
    }));
  };

  const handleSaveAllocations = async () => {
    if (!selectedProject) return;
    setSavingAllocations(true);
    try {
      await projectService.updateProjectStatus(selectedProject.id || selectedProject.projectId, {
        status: selectedProject.status,
        employeeAllocatedHours: allocatedHoursInput
      });
      notification.success({
        message: 'Allocations Saved',
        description: 'Hours assigned to employees successfully.'
      });
      setIsDrawerOpen(false);
      fetchData();
    } catch (e) {
      notification.error({
        message: 'Save Failed',
        description: 'Failed to update hour allocations.'
      });
    } finally {
      setSavingAllocations(false);
    }
  };

  useEffect(() => {
    fetchData();
    const onVisible = () => { if (document.visibilityState === 'visible') fetchData(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projectsRes, ticketsRes, usersRes] = await Promise.all([
        projectService.getProjects(),
        ticketService.getTickets(),
        adminService.getUsers()
      ]);

      const projects = projectsRes.data || [];
      const tickets = ticketsRes.data || [];
      const users = usersRes.data || [];

      // Map projects with their team lead and unique working employees
      const detailedProjects = projects.map(p => {
        // Find tickets for this project
        const projectTickets = tickets.filter(t => String(t.projectId) === String(p.id || p.projectId));
        
        // Find unique user IDs assigned to those tickets
        const assignedUserIds = [...new Set(projectTickets.map(t => t.assignedToUserId).filter(Boolean))];
        
        // Lookup employees assigned: check if Team Lead assigned them via assignedEmployeeIds first.
        // Fallback to ticket assigned user IDs if assignedEmployeeIds is empty.
        const tlAssignedIds = p.assignedEmployeeIds && Array.isArray(p.assignedEmployeeIds) ? p.assignedEmployeeIds : [];
        const employees = users.filter(u => 
          (tlAssignedIds.includes(u.id || u.userId) || (tlAssignedIds.length === 0 && assignedUserIds.includes(u.id || u.userId))) && u.role === 'Employee'
        );

        // Find Team Lead assigned to project
        const tlUser = users.find(u => String(u.id || u.userId) === String(p.assignedTeamLeadId));

        return {
          ...p,
          teamLeadName: p.teamLead || (tlUser ? (tlUser.name || tlUser.fullName) : 'None'),
          teamLeadAvatar: tlUser ? tlUser.avatar : null,
          employees,
          ticketCount: projectTickets.length
        };
      });

      setProjectList(detailedProjects);
    } catch (error) {
      console.error(error);
      notification.error({
        message: 'Error Loading Projects',
        description: 'Could not load projects, tickets, or user allocations.'
      });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Project Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ fontSize: '15px' }}>{name || record.projectName}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>Code: {record.code}</Text>
        </Space>
      ),
      sorter: (a, b) => (a.name || a.projectName || '').localeCompare(b.name || b.projectName || ''),
    },
    {
      title: 'Approved Hours',
      dataIndex: 'approvedHours',
      key: 'approvedHours',
      render: (hours) => (
        <Space>
          <ClockCircleOutlined style={{ color: '#1890ff' }} />
          <Text strong>{hours ? `${Number(hours)} hrs` : '0 hrs'}</Text>
        </Space>
      ),
      sorter: (a, b) => Number(a.approvedHours || 0) - Number(b.approvedHours || 0),
    },
    {
      title: 'Assigned Team Lead',
      dataIndex: 'teamLeadName',
      key: 'teamLeadName',
      render: (name, record) => (
        <Space>
          <Avatar 
            src={record.teamLeadAvatar} 
            icon={<UserOutlined />} 
            style={{ backgroundColor: '#1890ff' }}
          />
          <Text strong>{name}</Text>
        </Space>
      )
    },
    {
      title: 'Employees Working',
      dataIndex: 'employees',
      key: 'employees',
      render: (employees) => {
        if (!employees || employees.length === 0) {
          return <Text type="secondary">No employees assigned</Text>;
        }
        return (
          <Avatar.Group maxCount={4} maxStyle={{ color: '#f56a00', backgroundColor: '#fde3cf' }}>
            {employees.map(emp => (
              <Tooltip key={emp.id || emp.userId} title={`${emp.name || emp.fullName}`}>
                <Avatar 
                  src={emp.avatar} 
                  icon={<UserOutlined />} 
                  style={{ backgroundColor: '#87d068' }}
                />
              </Tooltip>
            ))}
          </Avatar.Group>
        );
      }
    },
    {
      title: 'Total Tickets',
      dataIndex: 'ticketCount',
      key: 'ticketCount',
      align: 'center',
      render: (count) => (
        <Badge count={count} style={{ backgroundColor: '#52c41a' }} />
      )
    },
    {
      title: 'Action',
      key: 'action',
      align: 'center',
      render: (_, record) => (
        <Button 
          type="primary" 
          size="small" 
          onClick={() => handleSelectProject(record)}
        >
          Manage Hours
        </Button>
      )
    }
  ];

  return (
    <div>
      <PageHeader 
        title="Project Allocations" 
        subTitle="Track projects, approved hours, team lead mappings, and active employees."
      />

      <Card 
        style={{ 
          borderRadius: 12,
          boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(0,0,0,0.05)',
          border: isDarkMode ? '1px solid #3f3f46' : '1px solid #e8e8e8'
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <Spin size="large" />
          </div>
        ) : (
          <Table 
            dataSource={projectList}
            columns={columns}
            rowKey={(record) => String(record.id || record.projectId)}
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: 'No projects found.' }}
          />
        )}
      </Card>

      {/* Hour Allocation Drawer */}
      <Drawer
        title={
          <Space direction="vertical" size={2}>
            <Text strong style={{ fontSize: 16 }}>Manage Hours</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{selectedProject?.name || selectedProject?.projectName}</Text>
          </Space>
        }
        placement="right"
        width={480}
        onClose={() => setIsDrawerOpen(false)}
        open={isDrawerOpen}
        extra={
          <Space>
            <Button onClick={() => setIsDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={savingAllocations} onClick={handleSaveAllocations}>
              Save Allocations
            </Button>
          </Space>
        }
      >
        {selectedProject ? (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            
            {/* Project Overview Card */}
            <Card size="small" style={{ background: isDarkMode ? '#1e1e24' : '#fafafa', borderRadius: 8 }}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Project Code" span={2}>
                  <Text code>{selectedProject.code}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Total Allotted Hours">
                  <Text strong>{selectedProject.totalHours || selectedProject.approvedHours || '0.00'} hrs</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Buffer Hours">
                  <Text>{selectedProject.bufferHours || '0.00'} hrs</Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Milestones / Budget Hours Section */}
            <div>
              <Title level={5} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <CalendarOutlined style={{ color: '#1890ff' }} />
                <span>Project Milestones & Hours</span>
              </Title>
              {selectedProject.milestones && Array.isArray(selectedProject.milestones) && selectedProject.milestones.length > 0 ? (
                <Timeline mode="left" style={{ marginTop: 10 }}>
                  {selectedProject.milestones.map((m, index) => (
                    <Timeline.Item 
                      key={index}
                      dot={<CalendarOutlined style={{ fontSize: '14px', color: '#52c41a' }} />}
                    >
                      <div style={{ marginBottom: 8 }}>
                        <Text strong style={{ fontSize: '13px', display: 'block' }}>{m.title}</Text>
                        {m.description && <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>{m.description}</Text>}
                        {m.amount && (
                          <Tag color="success" style={{ marginTop: 4, fontSize: '10px' }}>
                            Value: ₹{Number(m.amount).toLocaleString('en-IN')}
                          </Tag>
                        )}
                        <div style={{ fontSize: '10px', color: '#8c8c8c', marginTop: 4 }}>
                          Target Date: {m.date ? dayjs(m.date).format('DD MMM YYYY') : 'Not Set'}
                        </div>
                      </div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              ) : (
                <Empty description="No milestones defined for this project." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>

            <Divider style={{ margin: '12px 0' }} />

            {/* Employee Allocation Section */}
            <div>
              <Title level={5} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <UserOutlined style={{ color: '#1890ff' }} />
                <span>Employee Hour Allocations</span>
              </Title>
              {!selectedProject.employees || selectedProject.employees.length === 0 ? (
                <Empty description="No employees assigned to this project by the Team Lead yet." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {selectedProject.employees.map(emp => {
                    const empId = emp.id || emp.userId;
                    return (
                      <div 
                        key={empId}
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '10px 12px',
                          border: `1px solid ${isDarkMode ? '#303030' : '#f0f0f0'}`,
                          borderRadius: 8,
                          background: isDarkMode ? '#141414' : '#fff'
                        }}
                      >
                        <Space>
                          <Avatar src={emp.avatar} icon={<UserOutlined />} style={{ backgroundColor: '#87d068' }} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{emp.name || emp.fullName}</div>
                            <div style={{ fontSize: 11, color: '#8c8c8c' }}>{emp.email}</div>
                          </div>
                        </Space>
                        <InputNumber 
                          min={0}
                          style={{ width: 120 }}
                          placeholder="Hours"
                          value={allocatedHoursInput[empId]}
                          onChange={(val) => handleHourChange(empId, val)}
                          addonAfter="hrs"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </Space>
        ) : (
          <Spin />
        )}
      </Drawer>
    </div>
  );
};

export default HRProjectsPage;
