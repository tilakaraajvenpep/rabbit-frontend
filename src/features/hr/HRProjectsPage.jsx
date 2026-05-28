import React, { useState, useEffect } from 'react';
import { Card, Table, Avatar, Badge, Spin, Typography, Space, notification, Tooltip, Drawer, InputNumber, Divider, Button, Empty, Progress, Tag } from 'antd';
import { UserOutlined, ClockCircleOutlined, CheckCircleOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
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
        const empId = String(emp.id || emp.userId);
        initHours[empId] = project.employeeAllocatedHours?.[empId] || 0;
      });
    }
    setAllocatedHoursInput(initHours);
    setIsDrawerOpen(true);
  };

  const handleHourChange = (employeeId, value) => {
    setAllocatedHoursInput(prev => ({ ...prev, [String(employeeId)]: value || 0 }));
  };

  const totalAllocated = Object.values(allocatedHoursInput).reduce((s, v) => s + (Number(v) || 0), 0);
  const projectTotalHours = selectedProject ? Number(selectedProject.approvedHours || selectedProject.totalHours || 0) : 0;
  const allocationPercent = projectTotalHours > 0 ? Math.min(100, Math.round((totalAllocated / projectTotalHours) * 100)) : 0;

  const handleSaveAllocations = async () => {
    if (!selectedProject) return;
    setSavingAllocations(true);
    try {
      const projId = selectedProject.id || selectedProject.projectId;
      await projectService.updateProjectStatus(projId, {
        status: selectedProject.status,
        employeeAllocatedHours: allocatedHoursInput
      });
      // Update local state so table reflects new allocations immediately
      setProjectList(prev => prev.map(p => {
        if (String(p.id || p.projectId) === String(projId)) {
          return { ...p, employeeAllocatedHours: { ...allocatedHoursInput } };
        }
        return p;
      }));
      setSelectedProject(prev => prev ? { ...prev, employeeAllocatedHours: { ...allocatedHoursInput } } : prev);
      notification.success({ message: 'Allocations Saved', description: 'Hours assigned to employees successfully.' });
      setIsDrawerOpen(false);
    } catch {
      notification.error({ message: 'Save Failed', description: 'Failed to update hour allocations.' });
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

      const detailedProjects = projects.map(p => {
        const projectTickets = tickets.filter(t => String(t.projectId) === String(p.id || p.projectId));
        const assignedUserIds = [...new Set(projectTickets.map(t => t.assignedToUserId).filter(Boolean))];
        const tlAssignedIds = p.assignedEmployeeIds && Array.isArray(p.assignedEmployeeIds) ? p.assignedEmployeeIds : [];
        const employees = users.filter(u =>
          (tlAssignedIds.includes(u.id || u.userId) || (tlAssignedIds.length === 0 && assignedUserIds.includes(u.id || u.userId))) && u.role === 'Employee'
        );
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
      notification.error({ message: 'Error Loading Projects', description: 'Could not load project data.' });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Project',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ fontSize: 14 }}>{name || record.projectName}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>Code: {record.code}</Text>
        </Space>
      ),
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
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
    },
    {
      title: 'Team Lead',
      dataIndex: 'teamLeadName',
      key: 'teamLeadName',
      render: (name, record) => (
        <Space>
          <Avatar src={record.teamLeadAvatar} icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
          <Text>{name}</Text>
        </Space>
      )
    },
    {
      title: 'Employees',
      dataIndex: 'employees',
      key: 'employees',
      render: (employees) => {
        if (!employees || employees.length === 0) return <Text type="secondary">None assigned</Text>;
        return (
          <Avatar.Group maxCount={4} maxStyle={{ color: '#f56a00', backgroundColor: '#fde3cf' }}>
            {employees.map(emp => (
              <Tooltip key={emp.id || emp.userId} title={emp.name || emp.fullName}>
                <Avatar src={emp.avatar} icon={<UserOutlined />} style={{ backgroundColor: '#87d068' }} />
              </Tooltip>
            ))}
          </Avatar.Group>
        );
      }
    },
    {
      title: 'Tickets',
      dataIndex: 'ticketCount',
      key: 'ticketCount',
      align: 'center',
      render: (count) => <Badge count={count} style={{ backgroundColor: '#52c41a' }} />
    },
    {
      title: 'Action',
      key: 'action',
      align: 'center',
      render: (_, record) => (
        <Button type="primary" size="small" icon={<ClockCircleOutlined />} onClick={() => handleSelectProject(record)}>
          Allocate Hours
        </Button>
      )
    }
  ];

  // Drawer colours
  const drawerBg = isDarkMode ? '#0f0f13' : '#f8f9ff';
  const cardBg  = isDarkMode ? '#1a1a24' : '#ffffff';
  const borderC = isDarkMode ? '#2a2a3a' : '#e8ecf4';
  const accentBlue = '#4f6ef7';

  const milestones = selectedProject?.milestones && Array.isArray(selectedProject.milestones)
    ? selectedProject.milestones : [];

  return (
    <div>
      <PageHeader
        title="Project Allocations"
        subTitle="Track projects, approved hours, team lead mappings, and employee hour allocations."
      />

      <Card
        style={{
          borderRadius: 12,
          boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(0,0,0,0.05)',
          border: isDarkMode ? `1px solid ${borderC}` : `1px solid ${borderC}`
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin size="large" /></div>
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

      {/* ── Hour Allocation Drawer ── */}
      <Drawer
        title={null}
        placement="right"
        width={520}
        onClose={() => setIsDrawerOpen(false)}
        open={isDrawerOpen}
        bodyStyle={{ padding: 0, background: drawerBg }}
        headerStyle={{ display: 'none' }}
      >
        {selectedProject ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

            {/* ── Header ── */}
            <div style={{
              background: `linear-gradient(135deg, ${accentBlue} 0%, #7c3aed 100%)`,
              padding: '24px 24px 20px',
              position: 'relative'
            }}>
              <Button
                type="text"
                icon={<CloseOutlined />}
                onClick={() => setIsDrawerOpen(false)}
                style={{ position: 'absolute', top: 16, right: 16, color: 'rgba(255,255,255,0.8)' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <ClockCircleOutlined style={{ fontSize: 20, color: '#fff' }} />
                </div>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginBottom: 2 }}>Allocating Hours For</div>
                  <Title level={5} style={{ color: '#fff', margin: 0, fontSize: 16 }}>
                    {selectedProject.name || selectedProject.projectName}
                  </Title>
                </div>
              </div>

              {/* Summary pills */}
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{
                  background: 'rgba(255,255,255,0.15)', borderRadius: 8,
                  padding: '6px 14px', backdropFilter: 'blur(4px)'
                }}>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>Project Total</div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{projectTotalHours} hrs</div>
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.15)', borderRadius: 8,
                  padding: '6px 14px', backdropFilter: 'blur(4px)'
                }}>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>Allocated</div>
                  <div style={{ color: totalAllocated > projectTotalHours ? '#fca5a5' : '#86efac', fontWeight: 700, fontSize: 16 }}>
                    {totalAllocated} hrs
                  </div>
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.15)', borderRadius: 8,
                  padding: '6px 14px', backdropFilter: 'blur(4px)'
                }}>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>Remaining</div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
                    {Math.max(0, projectTotalHours - totalAllocated)} hrs
                  </div>
                </div>
              </div>
            </div>

            {/* ── Allocation progress bar ── */}
            <div style={{ padding: '12px 24px 0', background: cardBg, borderBottom: `1px solid ${borderC}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 11, color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Allocation Progress</Text>
                <Text style={{ fontSize: 11, fontWeight: 600, color: allocationPercent > 100 ? '#ef4444' : accentBlue }}>
                  {allocationPercent}%
                </Text>
              </div>
              <Progress
                percent={allocationPercent}
                showInfo={false}
                strokeColor={allocationPercent > 100 ? '#ef4444' : { from: accentBlue, to: '#7c3aed' }}
                trailColor={isDarkMode ? '#2a2a3a' : '#e5e7eb'}
                style={{ marginBottom: 12 }}
              />
            </div>

            {/* ── Scrollable body ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

              {/* Milestones section — name + total hours only */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{
                    width: 6, height: 18, borderRadius: 3,
                    background: `linear-gradient(${accentBlue}, #7c3aed)`
                  }} />
                  <Text strong style={{ fontSize: 13, color: isDarkMode ? '#e5e7eb' : '#1f2937' }}>
                    Project Milestones
                  </Text>
                </div>

                {milestones.length === 0 ? (
                  <Empty description="No milestones defined." image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {milestones.map((m, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 14px',
                        background: cardBg,
                        border: `1px solid ${borderC}`,
                        borderRadius: 10,
                        transition: 'box-shadow 0.2s'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: `linear-gradient(135deg, ${accentBlue}22, #7c3aed22)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, color: accentBlue
                          }}>{i + 1}</div>
                          <Text style={{ fontSize: 13, fontWeight: 500 }}>{m.title || m.name || `Milestone ${i + 1}`}</Text>
                        </div>
                        <Tag color="blue" style={{ borderRadius: 6, fontWeight: 600 }}>
                          {Number(projectTotalHours)} hrs total
                        </Tag>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Divider style={{ margin: '4px 0 16px', borderColor: borderC }} />

              {/* Employee allocation section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{
                    width: 6, height: 18, borderRadius: 3,
                    background: `linear-gradient(#10b981, #059669)`
                  }} />
                  <Text strong style={{ fontSize: 13, color: isDarkMode ? '#e5e7eb' : '#1f2937' }}>
                    Employee Hour Allocation
                  </Text>
                </div>

                {!selectedProject.employees || selectedProject.employees.length === 0 ? (
                  <Empty
                    description={<Text type="secondary" style={{ fontSize: 12 }}>No employees assigned by the Team Lead yet.</Text>}
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {selectedProject.employees.map(emp => {
                      const empId = String(emp.id || emp.userId);
                      const hours = Number(allocatedHoursInput[empId] || 0);
                      const empPercent = projectTotalHours > 0 ? Math.min(100, Math.round((hours / projectTotalHours) * 100)) : 0;
                      return (
                        <div key={empId} style={{
                          background: cardBg,
                          border: `1px solid ${borderC}`,
                          borderRadius: 12,
                          padding: '14px 16px',
                          transition: 'border-color 0.2s, box-shadow 0.2s',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <Space>
                              <Avatar
                                src={emp.avatar}
                                icon={<UserOutlined />}
                                style={{ backgroundColor: '#10b981', width: 36, height: 36 }}
                              />
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: isDarkMode ? '#f3f4f6' : '#111827' }}>
                                  {emp.name || emp.fullName}
                                </div>
                                <div style={{ fontSize: 11, color: isDarkMode ? '#6b7280' : '#9ca3af' }}>
                                  {emp.email}
                                </div>
                              </div>
                            </Space>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {hours > 0 && (
                                <CheckCircleOutlined style={{ color: '#10b981', fontSize: 14 }} />
                              )}
                              <InputNumber
                                min={0}
                                max={projectTotalHours || undefined}
                                style={{
                                  width: 110,
                                  borderRadius: 8,
                                  borderColor: hours > 0 ? '#10b981' : borderC
                                }}
                                placeholder="0"
                                value={allocatedHoursInput[empId]}
                                onChange={(val) => handleHourChange(empId, val)}
                                addonAfter={<span style={{ fontSize: 11, color: '#6b7280' }}>hrs</span>}
                              />
                            </div>
                          </div>

                          {/* Per-employee mini progress */}
                          {projectTotalHours > 0 && (
                            <div>
                              <Progress
                                percent={empPercent}
                                showInfo={false}
                                size="small"
                                strokeColor={empPercent > 100 ? '#ef4444' : '#10b981'}
                                trailColor={isDarkMode ? '#1f2937' : '#f3f4f6'}
                              />
                              <Text style={{ fontSize: 10, color: isDarkMode ? '#6b7280' : '#9ca3af' }}>
                                {empPercent}% of project hours
                              </Text>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Footer actions ── */}
            <div style={{
              padding: '16px 24px',
              borderTop: `1px solid ${borderC}`,
              background: cardBg,
              display: 'flex',
              gap: 10,
              justifyContent: 'flex-end'
            }}>
              <Button onClick={() => setIsDrawerOpen(false)} style={{ borderRadius: 8 }}>
                Cancel
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={savingAllocations}
                onClick={handleSaveAllocations}
                style={{
                  borderRadius: 8,
                  background: `linear-gradient(135deg, ${accentBlue}, #7c3aed)`,
                  border: 'none',
                  fontWeight: 600
                }}
              >
                Save Allocations
              </Button>
            </div>

          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Spin size="large" />
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default HRProjectsPage;
