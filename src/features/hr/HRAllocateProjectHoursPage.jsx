import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Avatar, Button, InputNumber, Spin, Typography,
  Space, notification, Progress, Tag, Empty, Divider, Statistic, Badge
} from 'antd';
import {
  UserOutlined, ArrowLeftOutlined, SaveOutlined, ClockCircleOutlined,
  CheckCircleOutlined, ProjectOutlined, TeamOutlined, WarningOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { projectService } from '../../services/projectService';
import { adminService } from '../../services/adminService';
import { ticketService } from '../../services/ticketService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Text, Title } = Typography;

const HRAllocateProjectHoursPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDarkMode } = useThemeStore();

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [project, setProject]   = useState(null);
  const [employees, setEmployees] = useState([]);
  const [allocatedHours, setAllocatedHours] = useState({});

  /* ── Derived totals ── */
  const projectTotal  = project ? Number(project.approvedHours || project.totalHours || 0) : 0;
  const totalAllocated = Object.values(allocatedHours).reduce((s, v) => s + (Number(v) || 0), 0);
  const remaining      = projectTotal - totalAllocated;
  const allocPct       = projectTotal > 0 ? Math.min(100, Math.round((totalAllocated / projectTotal) * 100)) : 0;
  const isOver         = totalAllocated > projectTotal;

  /* ── Load data ── */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [projRes, usersRes, ticketsRes] = await Promise.all([
          projectService.getProjectById(id),
          adminService.getUsers(),
          ticketService.getTickets()
        ]);

        const proj  = projRes.data;
        const users = usersRes.data || [];
        const tickets = ticketsRes.data || [];

        // Resolve assigned employees
        const tlAssignedIds = proj.assignedEmployeeIds && Array.isArray(proj.assignedEmployeeIds)
          ? proj.assignedEmployeeIds.map(String) : [];
        const ticketUserIds = [...new Set(
          tickets.filter(t => String(t.projectId) === String(id)).map(t => t.assignedToUserId).filter(Boolean).map(String)
        )];
        const useIds = tlAssignedIds.length > 0 ? tlAssignedIds : ticketUserIds;
        const emps = users.filter(u => useIds.includes(String(u.id || u.userId)) && u.role === 'Employee');

        // Init hours from saved allocations
        const init = {};
        emps.forEach(emp => {
          const eid = String(emp.id || emp.userId);
          init[eid] = proj.employeeAllocatedHours?.[eid] || 0;
        });

        setProject(proj);
        setEmployees(emps);
        setAllocatedHours(init);
      } catch (e) {
        console.error(e);
        notification.error({ message: 'Failed to load project data.' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleChange = (empId, val) => {
    setAllocatedHours(prev => ({ ...prev, [String(empId)]: val || 0 }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await projectService.updateProjectStatus(id, {
        status: project.status,
        employeeAllocatedHours: allocatedHours
      });
      notification.success({ message: 'Hour Allocations Saved', description: 'Employee hours updated successfully.' });
      navigate('/hr/projects');
    } catch {
      notification.error({ message: 'Save Failed', description: 'Could not save allocations. Try again.' });
    } finally {
      setSaving(false);
    }
  };

  /* ── Colours ── */
  const bg       = isDarkMode ? '#0d0d14' : '#f5f6ff';
  const cardBg   = isDarkMode ? '#13131e' : '#ffffff';
  const border   = isDarkMode ? '#1e1e2e' : '#e8ecf4';
  const accent   = '#4f6ef7';
  const purple   = '#7c3aed';
  const green    = '#10b981';

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: 32 }}>
        <Empty description="Project not found." />
      </div>
    );
  }

  const milestones = project.milestones && Array.isArray(project.milestones) ? project.milestones : [];

  return (
    <div style={{ background: bg, minHeight: '100vh', padding: '0 0 48px' }}>

      {/* ── Page Header ── */}
      <div style={{
        background: `linear-gradient(135deg, ${accent} 0%, ${purple} 100%)`,
        padding: '28px 32px 80px',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* decorative circles */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -20, right: 120, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/hr/projects')}
          style={{ color: 'rgba(255,255,255,0.8)', marginBottom: 16, paddingLeft: 0 }}
        >
          Back to Projects
        </Button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <ClockCircleOutlined style={{ fontSize: 24, color: '#fff' }} />
          </div>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginBottom: 2 }}>
              Hour Allocation — {project.code}
            </div>
            <Title level={3} style={{ color: '#fff', margin: 0, fontSize: 22 }}>
              {project.name || project.projectName}
            </Title>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 32px', marginTop: -48 }}>

        {/* ── Summary stats row ── */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          {[
            { label: 'Project Total Hours', value: `${projectTotal} hrs`, icon: <ProjectOutlined />, color: accent },
            { label: 'Total Allocated',     value: `${totalAllocated} hrs`, icon: <ClockCircleOutlined />, color: isOver ? '#ef4444' : green },
            { label: 'Remaining',           value: `${Math.max(0, remaining)} hrs`, icon: <CheckCircleOutlined />, color: remaining < 0 ? '#ef4444' : '#f59e0b' },
            { label: 'Employees',           value: employees.length, icon: <TeamOutlined />, color: purple }
          ].map((s, i) => (
            <Col span={6} key={i}>
              <Card
                size="small"
                style={{
                  borderRadius: 14, border: `1px solid ${border}`,
                  background: cardBg,
                  boxShadow: isDarkMode ? 'none' : '0 4px 20px rgba(79,110,247,0.08)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: `${s.color}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, color: s.color
                  }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: 10, color: isDarkMode ? '#6b7280' : '#9ca3af', marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={24}>

          {/* ── LEFT: Milestones ── */}
          <Col xs={24} lg={8}>
            <Card
              title={
                <Space>
                  <ProjectOutlined style={{ color: accent }} />
                  <span>Project Milestones</span>
                </Space>
              }
              style={{ borderRadius: 14, border: `1px solid ${border}`, background: cardBg, marginBottom: 24 }}
              styles={{ header: { borderBottom: `1px solid ${border}` } }}
            >
              {milestones.length === 0 ? (
                <Empty description="No milestones defined." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {milestones.map((m, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 12px',
                      background: isDarkMode ? '#1a1a28' : '#f8f9ff',
                      borderRadius: 10, border: `1px solid ${border}`
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: '50%',
                          background: `linear-gradient(135deg, ${accent}30, ${purple}30)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: accent
                        }}>{i + 1}</div>
                        <Text style={{ fontSize: 13 }}>{m.title || m.name || `Milestone ${i + 1}`}</Text>
                      </div>
                      <Tag color="blue" style={{ borderRadius: 6, fontSize: 11, fontWeight: 600, margin: 0 }}>
                        {projectTotal} hrs
                      </Tag>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Col>

          {/* ── RIGHT: Employee Allocation ── */}
          <Col xs={24} lg={16}>
            <Card
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <TeamOutlined style={{ color: green }} />
                    <span>Employee Hour Allocation</span>
                  </Space>
                  {isOver && (
                    <Tag color="error" icon={<WarningOutlined />}>
                      Over-allocated by {totalAllocated - projectTotal} hrs
                    </Tag>
                  )}
                </div>
              }
              style={{ borderRadius: 14, border: `1px solid ${border}`, background: cardBg }}
              styles={{ header: { borderBottom: `1px solid ${border}` } }}
            >

              {/* Allocation progress */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 12, color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                    Total Allocation Progress
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: 600, color: isOver ? '#ef4444' : accent }}>
                    {totalAllocated} / {projectTotal} hrs ({allocPct}%)
                  </Text>
                </div>
                <Progress
                  percent={allocPct}
                  showInfo={false}
                  strokeColor={isOver ? '#ef4444' : { from: accent, to: purple }}
                  trailColor={isDarkMode ? '#1f2937' : '#e5e7eb'}
                  strokeWidth={10}
                  style={{ borderRadius: 6 }}
                />
              </div>

              <Divider style={{ margin: '0 0 16px', borderColor: border }} />

              {employees.length === 0 ? (
                <Empty
                  description={
                    <Text type="secondary">
                      No employees assigned to this project by the Team Lead yet.
                    </Text>
                  }
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {employees.map(emp => {
                    const eid   = String(emp.id || emp.userId);
                    const hours = Number(allocatedHours[eid] || 0);
                    const pct   = projectTotal > 0 ? Math.min(100, Math.round((hours / projectTotal) * 100)) : 0;
                    const saved = (project.employeeAllocatedHours?.[eid] || 0);
                    const changed = hours !== Number(saved);

                    return (
                      <div key={eid} style={{
                        background: isDarkMode ? '#0f0f1a' : '#f9fafb',
                        border: `1.5px solid ${hours > 0 ? `${green}50` : border}`,
                        borderRadius: 14, padding: '16px 20px',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                        boxShadow: hours > 0 ? `0 0 0 3px ${green}10` : 'none'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          {/* Employee info */}
                          <Space>
                            <Avatar
                              src={emp.avatar}
                              icon={<UserOutlined />}
                              size={42}
                              style={{ backgroundColor: green }}
                            />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14, color: isDarkMode ? '#f3f4f6' : '#111827' }}>
                                {emp.name || emp.fullName}
                                {changed && <Badge dot offset={[4, 0]} color="orange" />}
                              </div>
                              <div style={{ fontSize: 11, color: isDarkMode ? '#6b7280' : '#9ca3af' }}>
                                {emp.email}
                              </div>
                              <div style={{ marginTop: 4 }}>
                                {hours > 0 ? (
                                  <Tag color="success" style={{ fontSize: 10, borderRadius: 4 }}>
                                    <CheckCircleOutlined /> {hours} hrs assigned
                                  </Tag>
                                ) : (
                                  <Tag color="default" style={{ fontSize: 10, borderRadius: 4 }}>
                                    Not yet allocated
                                  </Tag>
                                )}
                              </div>
                            </div>
                          </Space>

                          {/* Hour input */}
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: isDarkMode ? '#6b7280' : '#9ca3af', marginBottom: 4 }}>
                              Allocate Hours
                            </div>
                            <InputNumber
                              min={0}
                              max={projectTotal || undefined}
                              value={allocatedHours[eid]}
                              onChange={(val) => handleChange(eid, val)}
                              style={{
                                width: 140, borderRadius: 8,
                                borderColor: hours > 0 ? green : border
                              }}
                              size="large"
                              addonAfter={<span style={{ fontSize: 12, color: '#6b7280' }}>hrs</span>}
                            />
                          </div>
                        </div>

                        {/* Per-employee progress */}
                        {projectTotal > 0 && (
                          <div>
                            <Progress
                              percent={pct}
                              showInfo={false}
                              size="small"
                              strokeColor={pct > 100 ? '#ef4444' : green}
                              trailColor={isDarkMode ? '#1f2937' : '#e5e7eb'}
                            />
                            <Text style={{ fontSize: 10, color: isDarkMode ? '#6b7280' : '#9ca3af' }}>
                              {pct}% of project total · {hours} / {projectTotal} hrs
                            </Text>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Action buttons ── */}
              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <Button
                  onClick={() => navigate('/hr/projects')}
                  style={{ borderRadius: 8, minWidth: 100 }}
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={saving}
                  onClick={handleSave}
                  disabled={employees.length === 0}
                  size="large"
                  style={{
                    borderRadius: 8, minWidth: 160, fontWeight: 600,
                    background: `linear-gradient(135deg, ${accent}, ${purple})`,
                    border: 'none', height: 44
                  }}
                >
                  Save Allocations
                </Button>
              </div>

            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default HRAllocateProjectHoursPage;
