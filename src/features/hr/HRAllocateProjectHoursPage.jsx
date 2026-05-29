import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Avatar, Button, InputNumber, Spin, Typography,
  Space, notification, Progress, Tag, Empty, Divider, Select
} from 'antd';
import {
  UserOutlined, SaveOutlined, ClockCircleOutlined,
  CheckCircleOutlined, ProjectOutlined, TeamOutlined,
  WarningOutlined, DownOutlined
} from '@ant-design/icons';
import { projectService } from '../../services/projectService';
import { adminService } from '../../services/adminService';
import { ticketService } from '../../services/ticketService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Text, Title } = Typography;
const { Option } = Select;

/* ── helpers ── */
const toDecimal = (h, m) => (Number(h) || 0) + (Number(m) || 0) / 60;
const fromDecimal = (d) => {
  const val = Number(d) || 0;
  return { h: Math.floor(val), m: Math.round((val % 1) * 60) };
};
const fmtHM = (h, m) => {
  const parts = [];
  if (h)  parts.push(`${h}h`);
  if (m)  parts.push(`${m}m`);
  return parts.length ? parts.join(' ') : '0h';
};

const HRAllocateProjectHoursPage = () => {
  const { isDarkMode } = useThemeStore();

  const [allProjects,     setAllProjects]     = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  const [selectedId,  setSelectedId]  = useState(null);
  const [project,     setProject]     = useState(null);
  const [employees,   setEmployees]   = useState([]);
  const [allUsers,    setAllUsers]    = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [alloc,  setAlloc]  = useState({});  /* { empId: { h, m } } */
  const [saving, setSaving] = useState(false);

  /* ── Derived totals ── */
  const projectTotal   = project ? Number(project.approvedHours || project.totalHours || 0) : 0;
  const totalAllocated = Object.values(alloc).reduce((s, v) => s + toDecimal(v.h, v.m), 0);
  const remaining      = projectTotal - totalAllocated;
  const allocPct       = projectTotal > 0 ? Math.min(100, Math.round((totalAllocated / projectTotal) * 100)) : 0;
  const isOver         = totalAllocated > projectTotal;

  const totalHrs = Math.floor(totalAllocated);
  const totalMins = Math.round((totalAllocated % 1) * 60);
  const remHrs   = Math.floor(Math.max(0, remaining));
  const remMins  = Math.round((Math.max(0, remaining) % 1) * 60);

  /* ── Load project list on mount ── */
  useEffect(() => {
    const load = async () => {
      setProjectsLoading(true);
      try {
        const res = await projectService.getProjects();
        setAllProjects(res.data || []);
      } catch { notification.error({ message: 'Could not load projects.' }); }
      finally { setProjectsLoading(false); }
    };
    load();
  }, []);

  /* ── Load selected project employees & Team Lead ── */
  useEffect(() => {
    if (!selectedId) { setProject(null); setEmployees([]); setAlloc({}); setAllUsers([]); return; }
    const load = async () => {
      setDetailLoading(true);
      try {
        const [projRes, usersRes, ticketsRes] = await Promise.all([
          projectService.getProjectById(selectedId),
          adminService.getUsers(),
          ticketService.getTickets()
        ]);
        const proj    = projRes.data;
        const users   = usersRes.data   || [];
        const tickets = ticketsRes.data || [];

        const tlAssignedIds = proj.assignedEmployeeIds && Array.isArray(proj.assignedEmployeeIds)
          ? proj.assignedEmployeeIds.map(String) : [];
        const ticketUserIds = [...new Set(
          tickets.filter(t => String(t.projectId) === String(selectedId))
            .map(t => t.assignedToUserId).filter(Boolean).map(String)
        )];
        const useIds = tlAssignedIds.length > 0 ? tlAssignedIds : ticketUserIds;
        
        const projectTLId = proj.assignedTeamLeadId ? String(proj.assignedTeamLeadId) : null;
        const projectPMId = proj.assignedProjectManagerId ? String(proj.assignedProjectManagerId) : null;
        
        const emps = users.filter(u => {
          const uid = String(u.id || u.userId);
          // Include Project Manager if assigned to this project
          if (uid === projectPMId && u.role === 'ProjectManager') return true;
          // Include Team Lead if assigned to this project
          if (uid === projectTLId && u.role === 'TeamLead') return true;
          // Include Employees assigned to this project
          if (useIds.includes(uid) && u.role === 'Employee') return true;
          return false;
        });

        const init = {};
        emps.forEach(emp => {
          const eid  = String(emp.id || emp.userId);
          init[eid]  = fromDecimal(proj.employeeAllocatedHours?.[eid] || 0);
        });

        setProject(proj);
        setAllUsers(users);
        setEmployees(emps);
        setAlloc(init);
      } catch (e) {
        console.error(e);
        notification.error({ message: 'Failed to load project details.' });
      } finally {
        setDetailLoading(false);
      }
    };
    load();
  }, [selectedId]);

  const handleChange = (empId, field, val) => {
    setAlloc(prev => ({
      ...prev,
      [String(empId)]: { ...prev[String(empId)], [field]: val || 0 }
    }));
  };

  const handleSave = async () => {
    if (!project) return;
    setSaving(true);
    try {
      const employeeAllocatedHours = {};
      Object.entries(alloc).forEach(([eid, { h, m }]) => {
        employeeAllocatedHours[eid] = toDecimal(h, m);
      });
      await projectService.updateProjectStatus(selectedId, {
        status: project.status,
        employeeAllocatedHours
      });
      notification.success({ message: 'Allocations Saved', description: 'Resource hours updated successfully.' });
      /* re-sync local project state */
      setProject(prev => prev ? { ...prev, employeeAllocatedHours } : prev);
    } catch {
      notification.error({ message: 'Save Failed', description: 'Could not save allocations.' });
    } finally {
      setSaving(false);
    }
  };

  /* ── Colours ── */
  const bg     = isDarkMode ? '#0d0d14' : '#f5f6ff';
  const cardBg = isDarkMode ? '#13131e' : '#ffffff';
  const border = isDarkMode ? '#1e1e2e' : '#e8ecf4';
  const accent = '#4f6ef7';
  const purple = '#7c3aed';
  const green  = '#10b981';

  const milestones = project?.milestones && Array.isArray(project.milestones)
    ? project.milestones : [];

  const projectTL = project && allUsers.length > 0
    ? allUsers.find(u => String(u.id || u.userId) === String(project.assignedTeamLeadId))
    : null;

  const projectPM = project && allUsers.length > 0
    ? allUsers.find(u => String(u.id || u.userId) === String(project.assignedProjectManagerId))
    : null;

  const getMilestoneHours = useCallback((m) => {
    // Extract explicitly defined hours
    const hrsVal = m.hours !== undefined && m.hours !== null ? m.hours : m.estimatedHours;
    if (hrsVal !== undefined && hrsVal !== null && Number(hrsVal) > 0) {
      return `${hrsVal} hrs`;
    }
    
    // Try to parse hours from title or description (e.g. "Milestone 1 (120 hours)")
    const searchStr = `${m.title || ''} ${m.name || ''} ${m.description || ''}`;
    const hoursRegex = /(\d+)\s*(?:hrs|hours|hour)/i;
    const match = searchStr.match(hoursRegex);
    if (match) {
      return `${match[1]} hrs`;
    }

    return 'nil';
  }, []);

  return (
    <div style={{ background: bg, minHeight: '100vh', paddingBottom: 48 }}>

      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(135deg, ${accent} 0%, ${purple} 100%)`,
        padding: '28px 32px 80px', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }} />
        <div style={{ position:'absolute', bottom:-20, right:120, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,0.04)' }} />

        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
          <div style={{
            width:52, height:52, borderRadius:14,
            background:'rgba(255,255,255,0.2)', backdropFilter:'blur(8px)',
            display:'flex', alignItems:'center', justifyContent:'center'
          }}>
            <ClockCircleOutlined style={{ fontSize:24, color:'#fff' }} />
          </div>
          <div>
            <div style={{ color:'rgba(255,255,255,0.65)', fontSize:12, marginBottom:2 }}>HR Portal</div>
            <Title level={3} style={{ color:'#fff', margin:0, fontSize:22 }}>Project Hour Allocation</Title>
          </div>
        </div>

        {/* Project selector inside header */}
        <div>
          <div style={{ color:'rgba(255,255,255,0.75)', fontSize:12, marginBottom:6, fontWeight:500 }}>
            Select a Project to Allocate Hours
          </div>
          <Select
            showSearch
            loading={projectsLoading}
            placeholder="— Choose a project —"
            value={selectedId}
            onChange={setSelectedId}
            filterOption={(input, opt) => (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            style={{ width: '100%', maxWidth: 520 }}
            size="large"
            suffixIcon={<DownOutlined style={{ color: '#fff' }} />}
            className="hr-project-select"
          >
            {allProjects.map(p => (
              <Option
                key={p.id || p.projectId}
                value={p.id || p.projectId}
                label={p.name || p.projectName}
              >
                <Space>
                  <ProjectOutlined style={{ color: accent }} />
                  <span style={{ fontWeight: 600 }}>{p.name || p.projectName}</span>
                  <Text type="secondary" style={{ fontSize: 11 }}>({p.code})</Text>
                </Space>
              </Option>
            ))}
          </Select>
        </div>
      </div>

      <div style={{ padding: '0 32px', marginTop: -48 }}>

        {/* ── No project selected ── */}
        {!selectedId && !detailLoading && (
          <Card style={{ borderRadius:14, border:`1px solid ${border}`, background:cardBg, textAlign:'center', padding:'40px 0' }}>
            <ProjectOutlined style={{ fontSize:48, color: isDarkMode?'#4b5563':'#d1d5db', marginBottom:16 }} />
            <Title level={4} style={{ color: isDarkMode?'#6b7280':'#9ca3af', margin:0 }}>
              Select a project above to begin allocating hours
            </Title>
          </Card>
        )}

        {/* ── Loading detail ── */}
        {detailLoading && (
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:200 }}>
            <Spin size="large" />
          </div>
        )}

        {/* ── Project loaded ── */}
        {project && !detailLoading && (
          <>
            {/* Summary stats */}
            <Row gutter={16} style={{ marginBottom:24 }}>
              {[
                { label:'Project Total',   value:`${projectTotal} hrs`,       icon:<ProjectOutlined />,     color:accent },
                { label:'Total Allocated', value:fmtHM(totalHrs, totalMins),  icon:<ClockCircleOutlined />, color:isOver?'#ef4444':green },
                { label:'Remaining',       value:fmtHM(remHrs, remMins),      icon:<CheckCircleOutlined />, color:remaining<0?'#ef4444':'#f59e0b' },
                { label:'Employees',       value:employees.length,             icon:<TeamOutlined />,        color:purple }
              ].map((s, i) => (
                <Col span={6} key={i}>
                  <Card size="small" style={{ borderRadius:14, border:`1px solid ${border}`, background:cardBg, boxShadow:isDarkMode?'none':'0 4px 20px rgba(79,110,247,0.08)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:40, height:40, borderRadius:10, background:`${s.color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:s.color }}>
                        {s.icon}
                      </div>
                      <div>
                        <div style={{ fontSize:10, color:isDarkMode?'#6b7280':'#9ca3af', marginBottom:2 }}>{s.label}</div>
                        <div style={{ fontSize:18, fontWeight:700, color:s.color }}>{s.value}</div>
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>

            <Row gutter={24}>
              {/* LEFT: Project Details & Milestones */}
              <Col xs={24} lg={8}>
                {/* Project Details Card */}
                <Card
                  title={<Space><ProjectOutlined style={{ color:accent }} /><span>Project Details</span></Space>}
                  style={{ borderRadius:14, border:`1px solid ${border}`, background:cardBg, marginBottom:20 }}
                  styles={{ header:{ borderBottom:`1px solid ${border}` } }}
                >
                  <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                    <div>
                      <div style={{ fontSize:11, color:isDarkMode?'#6b7280':'#9ca3af', marginBottom:4 }}>Project Name</div>
                      <Text strong style={{ fontSize:14 }}>{project.name}</Text>
                    </div>
                    <div>
                      <div style={{ fontSize:11, color:isDarkMode?'#6b7280':'#9ca3af', marginBottom:4 }}>Project Code</div>
                      <Tag color="cyan" style={{ borderRadius:4, fontWeight:600 }}>{project.code}</Tag>
                    </div>
                    <div>
                      <div style={{ fontSize:11, color:isDarkMode?'#6b7280':'#9ca3af', marginBottom:6 }}>Assigned Project Manager</div>
                      {projectPM ? (
                        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:isDarkMode?'#1a1a28':'#f8f9ff', borderRadius:10, border:`1px solid ${border}`, marginBottom: 12 }}>
                          <Avatar src={projectPM.avatar} icon={<UserOutlined />} size="small" style={{ backgroundColor:purple }} />
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontWeight:600, fontSize:13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{projectPM.name || projectPM.fullName}</div>
                            <div style={{ fontSize:10, color:isDarkMode?'#6b7280':'#9ca3af', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{projectPM.email}</div>
                          </div>
                        </div>
                      ) : (
                        <Text type="warning" style={{ fontSize:13, display: 'block', marginBottom: 12 }}>No Project Manager Assigned</Text>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize:11, color:isDarkMode?'#6b7280':'#9ca3af', marginBottom:6 }}>Assigned Team Lead</div>
                      {projectTL ? (
                        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:isDarkMode?'#1a1a28':'#f8f9ff', borderRadius:10, border:`1px solid ${border}` }}>
                          <Avatar src={projectTL.avatar} icon={<UserOutlined />} size="small" style={{ backgroundColor:accent }} />
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontWeight:600, fontSize:13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{projectTL.name || projectTL.fullName}</div>
                            <div style={{ fontSize:10, color:isDarkMode?'#6b7280':'#9ca3af', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{projectTL.email}</div>
                          </div>
                        </div>
                      ) : (
                        <Text type="warning" style={{ fontSize:13 }}>No Team Lead Assigned</Text>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Project Milestones Card */}
                <Card
                  title={<Space><ProjectOutlined style={{ color:accent }} /><span>Project Milestones</span></Space>}
                  style={{ borderRadius:14, border:`1px solid ${border}`, background:cardBg, marginBottom:24 }}
                  styles={{ header:{ borderBottom:`1px solid ${border}` } }}
                >
                  {milestones.length === 0 ? (
                    <Empty description="No milestones defined." image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {milestones.map((m, i) => (
                        <div key={i} style={{
                          display:'flex', flexDirection:'column', gap:6,
                          padding:'12px 16px',
                          background:isDarkMode?'#1a1a28':'#f8f9ff',
                          borderRadius:12, border:`1px solid ${border}`,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                        }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:10, flex: 1, overflow: 'hidden' }}>
                              <div style={{
                                width:26, height:26, borderRadius:'50%',
                                background:`linear-gradient(135deg, ${accent}30, ${purple}30)`,
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:11, fontWeight:700, color:accent, flexShrink: 0
                              }}>{i + 1}</div>
                              <Text strong style={{ fontSize:13, lineHeight: '1.4' }}>
                                {m.title || m.name || `Milestone ${i + 1}`}
                              </Text>
                            </div>
                            <Tag color="blue" style={{ borderRadius:6, fontSize:11, fontWeight:600, margin:0, padding: '2px 8px', flexShrink: 0 }}>
                              {getMilestoneHours(m)}
                            </Tag>
                          </div>
                          
                          {m.description && (
                            <div style={{ paddingLeft: 36, fontSize: 12, color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                              {m.description}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </Col>

              {/* RIGHT: Resource Hour Allocation */}
              <Col xs={24} lg={16}>
                <Card
                  title={
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <Space><TeamOutlined style={{ color:green }} /><span>Resource Hour Allocation</span></Space>
                      {isOver && (
                        <Tag color="error" icon={<WarningOutlined />}>
                          Over by {fmtHM(
                            Math.floor(Math.abs(remaining)),
                            Math.round((Math.abs(remaining) % 1) * 60)
                          )}
                        </Tag>
                      )}
                    </div>
                  }
                  style={{ borderRadius:14, border:`1px solid ${border}`, background:cardBg }}
                  styles={{ header:{ borderBottom:`1px solid ${border}` } }}
                >
                  {/* Overall progress */}
                  <div style={{ marginBottom:20 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                      <Text style={{ fontSize:12, color:isDarkMode?'#9ca3af':'#6b7280' }}>Total Allocation Progress</Text>
                      <Text style={{ fontSize:12, fontWeight:600, color:isOver?'#ef4444':accent }}>
                        {fmtHM(totalHrs, totalMins)} / {projectTotal} hrs ({allocPct}%)
                      </Text>
                    </div>
                    <Progress
                      percent={allocPct} showInfo={false} strokeWidth={10}
                      strokeColor={isOver?'#ef4444':{ from:accent, to:purple }}
                      trailColor={isDarkMode?'#1f2937':'#e5e7eb'}
                    />
                  </div>

                  <Divider style={{ margin:'0 0 16px', borderColor:border }} />

                  {employees.length === 0 ? (
                    <Empty
                      description={<Text type="secondary">No resources or team lead assigned to this project yet.</Text>}
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                      {employees.map(emp => {
                        const eid = String(emp.id || emp.userId);
                        const { h=0, m=0 } = alloc[eid] || {};
                        const dec   = toDecimal(h, m);
                        const pct   = projectTotal > 0 ? Math.min(100, Math.round((dec / projectTotal) * 100)) : 0;
                        const hasVal = dec > 0;

                        return (
                          <div key={eid} style={{
                            background:isDarkMode?'#0f0f1a':'#f9fafb',
                            border:`1.5px solid ${hasVal?`${green}55`:border}`,
                            borderRadius:14, padding:'16px 20px',
                            boxShadow:hasVal?`0 0 0 3px ${green}12`:'none',
                            transition:'border-color 0.2s, box-shadow 0.2s'
                          }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                              {/* Employee info */}
                              <Space align="start">
                                <Avatar src={emp.avatar} icon={<UserOutlined />} size={42} style={{ backgroundColor: emp.role === 'ProjectManager' ? purple : emp.role === 'TeamLead' ? accent : green }} />
                                <div>
                                  <div style={{ fontWeight:600, fontSize:14, color:isDarkMode?'#f3f4f6':'#111827', display:'flex', alignItems:'center', gap:8 }}>
                                    {emp.name || emp.fullName}
                                    {emp.role === 'ProjectManager' && <Tag color="purple" style={{ fontSize: 10, margin: 0, borderRadius: 4, lineHeight: '16px' }}>Project Manager</Tag>}
                                    {emp.role === 'TeamLead' && <Tag color="gold" style={{ fontSize: 10, margin: 0, borderRadius: 4, lineHeight: '16px' }}>Team Lead</Tag>}
                                  </div>
                                  <div style={{ fontSize:11, color:isDarkMode?'#6b7280':'#9ca3af' }}>{emp.email}</div>
                                  <div style={{ marginTop:5 }}>
                                    {hasVal ? (
                                      <Tag color="success" style={{ fontSize:10, borderRadius:4 }}>
                                        <CheckCircleOutlined /> {fmtHM(h, m)} assigned
                                      </Tag>
                                    ) : (
                                      <Tag color="default" style={{ fontSize:10, borderRadius:4 }}>Not yet allocated</Tag>
                                    )}
                                  </div>
                                </div>
                              </Space>

                              {/* H : M inputs */}
                              <div style={{ textAlign:'right' }}>
                                <div style={{ fontSize:11, color:isDarkMode?'#6b7280':'#9ca3af', marginBottom:6 }}>Allocate Time</div>
                                <Space size={6} align="center">
                                  <div style={{ textAlign:'center' }}>
                                    <InputNumber
                                      min={0}
                                      value={h}
                                      onChange={val => handleChange(eid, 'h', val)}
                                      style={{ width:80, borderRadius:8, borderColor:hasVal?green:border }}
                                      size="middle"
                                    />
                                    <div style={{ fontSize:10, color:isDarkMode?'#6b7280':'#9ca3af', marginTop:3 }}>Hours</div>
                                  </div>
                                  <div style={{ fontSize:18, color:isDarkMode?'#4b5563':'#d1d5db', paddingBottom:16 }}>:</div>
                                  <div style={{ textAlign:'center' }}>
                                    <InputNumber
                                      min={0} max={59}
                                      value={m}
                                      onChange={val => handleChange(eid, 'm', val)}
                                      style={{ width:72, borderRadius:8, borderColor:hasVal?green:border }}
                                      size="middle"
                                    />
                                    <div style={{ fontSize:10, color:isDarkMode?'#6b7280':'#9ca3af', marginTop:3 }}>Minutes</div>
                                  </div>
                                </Space>
                              </div>
                            </div>

                            {/* Per-employee progress */}
                            {projectTotal > 0 && (
                              <div>
                                <Progress
                                  percent={pct} showInfo={false} size="small"
                                  strokeColor={pct > 100 ? '#ef4444' : green}
                                  trailColor={isDarkMode?'#1f2937':'#e5e7eb'}
                                />
                                <Text style={{ fontSize:10, color:isDarkMode?'#6b7280':'#9ca3af' }}>
                                  {pct}% of project total · {fmtHM(h, m)} / {projectTotal} hrs
                                </Text>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ marginTop:24, display:'flex', justifyContent:'flex-end', gap:12 }}>
                    <Button
                      onClick={() => { setSelectedId(null); }}
                      style={{ borderRadius:8, minWidth:100 }}
                    >
                      Clear
                    </Button>
                    <Button
                      type="primary" icon={<SaveOutlined />}
                      loading={saving} onClick={handleSave}
                      disabled={employees.length === 0}
                      size="large"
                      style={{
                        borderRadius:8, minWidth:160, fontWeight:600,
                        background:`linear-gradient(135deg, ${accent}, ${purple})`,
                        border:'none', height:44
                      }}
                    >
                      Save Allocations
                    </Button>
                  </div>
                </Card>
              </Col>
            </Row>
          </>
        )}
      </div>
    </div>
  );
};

export default HRAllocateProjectHoursPage;
