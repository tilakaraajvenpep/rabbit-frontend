import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Table, Tag, Avatar, Space, Typography, Select, Spin,
  Empty, Tooltip, Badge, Row, Col, Statistic, theme
} from 'antd';
import {
  SwapOutlined, TeamOutlined, UserOutlined, ProjectOutlined,
  CheckCircleOutlined, ClockCircleOutlined, SyncOutlined,
  ExclamationCircleOutlined, ApartmentOutlined
} from '@ant-design/icons';
import { adminService } from '../../services/adminService';
import { projectService } from '../../services/projectService';
import { ticketService } from '../../services/ticketService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { Text, Title } = Typography;

/* ── Status helpers ─────────────────────────────────────── */
const statusColor = (s) => ({
  ToDo: '#8c8c8c', InProgress: '#1890ff',
  InReview: '#fa8c16', Done: '#52c41a'
}[s] || '#8c8c8c');

const statusIcon = (s) => ({
  ToDo: <ClockCircleOutlined />,
  InProgress: <SyncOutlined spin />,
  InReview: <ExclamationCircleOutlined />,
  Done: <CheckCircleOutlined />
}[s] || <ClockCircleOutlined />);

const statusLabel = (s) => ({
  ToDo: 'To Do', InProgress: 'In Progress',
  InReview: 'In Review', Done: 'Done'
}[s] || s);

/* ─────────────────────────────────────────────────────────── */

const CrossTeamPage = () => {
  const { token } = theme.useToken();
  const { isDarkMode } = useThemeStore();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [filterTeam, setFilterTeam] = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);

  /* ── Load all required data ── */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [uRes, pRes] = await Promise.all([
          adminService.getUsers(),
          projectService.getProjects()
        ]);
        setUsers(uRes.data);
        setProjects(pRes.data);

        // Load tickets for every active project
        const activeProjects = pRes.data.filter(p =>
          ['Approved', 'InProgress'].includes(p.status)
        );
        const ticketResults = await Promise.all(
          activeProjects.map(p =>
            ticketService.getTickets(p.id || p.projectId).catch(() => ({ data: [] }))
          )
        );
        setTickets(ticketResults.flatMap(r => r.data));
      } catch (err) {
        console.error('CrossTeam load error', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /* ── Derive cross-team assignments ── */
  const crossTeamRows = useMemo(() => {
    const rows = [];
    const seenKeys = new Set();

    // 1. Process from projects' assignedEmployeeIds
    projects.forEach(project => {
      const workingTL = users.find(u =>
        String(u.id || u.userId) === String(project.assignedTeamLeadId)
      );
      if (!workingTL) return;

      const isWorkingTeamId = String(workingTL.id || workingTL.userId);
      const empIds = Array.isArray(project.assignedEmployeeIds) ? project.assignedEmployeeIds : [];

      empIds.forEach(empId => {
        const employee = users.find(u => String(u.id || u.userId) === String(empId));
        if (!employee || employee.role !== 'Employee') return;

        const homeTL = users.find(u => String(u.id || u.userId) === String(employee.teamLeadId));
        if (!homeTL) return;

        const isHomeTeamId = String(homeTL.id || homeTL.userId);
        if (isHomeTeamId === isWorkingTeamId) return;

        // Find tickets in this project assigned to this employee
        const empTickets = tickets.filter(t =>
          String(t.projectId) === String(project.id || project.projectId) &&
          String(t.assignedToUserId) === String(empId)
        );

        const activeTickets = empTickets.filter(t => t.status !== 'Done');

        if (activeTickets.length > 0) {
          activeTickets.forEach(ticket => {
            const key = `${project.id || project.projectId}-${empId}-${ticket.ticketId || ticket.id}`;
            seenKeys.add(key);
            rows.push({
              key,
              employeeName: employee.name || employee.fullName,
              employeeId: employee.id || employee.userId,
              employeeEmail: employee.email,
              homeTeam: homeTL.name || homeTL.fullName,
              homeTeamId: isHomeTeamId,
              workingTeam: workingTL.name || workingTL.fullName,
              workingTeamId: isWorkingTeamId,
              projectName: project.name || project.projectName,
              projectStatus: project.status,
              ticketCode: ticket.ticketCode || ticket.code,
              ticketTitle: ticket.title,
              ticketStatus: ticket.status,
              estimatedHours: ticket.estimatedHours || 0,
            });
          });
        } else {
          const key = `${project.id || project.projectId}-${empId}-no-ticket`;
          seenKeys.add(key);
          rows.push({
            key,
            employeeName: employee.name || employee.fullName,
            employeeId: employee.id || employee.userId,
            employeeEmail: employee.email,
            homeTeam: homeTL.name || homeTL.fullName,
            homeTeamId: isHomeTeamId,
            workingTeam: workingTL.name || workingTL.fullName,
            workingTeamId: isWorkingTeamId,
            projectName: project.name || project.projectName,
            projectStatus: project.status,
            ticketCode: '—',
            ticketTitle: 'No active tickets',
            ticketStatus: '—',
            estimatedHours: 0,
          });
        }
      });
    });

    // 2. Fallback: scan tickets to ensure nothing is missed
    tickets.forEach(ticket => {
      if (!ticket.assignedToUserId || ticket.status === 'Done') return;

      const employee = users.find(u =>
        String(u.id || u.userId) === String(ticket.assignedToUserId)
      );
      if (!employee || employee.role !== 'Employee') return;

      const project = projects.find(p =>
        String(p.id || p.projectId) === String(ticket.projectId)
      );
      if (!project) return;

      const homeTL = users.find(u =>
        String(u.id || u.userId) === String(employee.teamLeadId)
      );
      const workingTL = users.find(u =>
        String(u.id || u.userId) === String(project.assignedTeamLeadId)
      );

      if (!homeTL || !workingTL) return;

      const isHomeTeamId = String(homeTL.id || homeTL.userId);
      const isWorkingTeamId = String(workingTL.id || workingTL.userId);

      if (isHomeTeamId !== isWorkingTeamId) {
        const key = `${project.id || project.projectId}-${employee.id || employee.userId}-${ticket.ticketId || ticket.id}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          rows.push({
            key,
            employeeName: employee.name || employee.fullName,
            employeeId: employee.id || employee.userId,
            employeeEmail: employee.email,
            homeTeam: homeTL.name || homeTL.fullName,
            homeTeamId: isHomeTeamId,
            workingTeam: workingTL.name || workingTL.fullName,
            workingTeamId: isWorkingTeamId,
            projectName: project.name || project.projectName,
            projectStatus: project.status,
            ticketCode: ticket.ticketCode || ticket.code,
            ticketTitle: ticket.title,
            ticketStatus: ticket.status,
            estimatedHours: ticket.estimatedHours || 0,
          });
        }
      }
    });

    return rows;
  }, [tickets, users, projects]);

  /* ── Filter ── */
  const filtered = useMemo(() => {
    return crossTeamRows.filter(r => {
      if (filterTeam && r.homeTeamId !== filterTeam) return false;
      if (filterStatus && r.ticketStatus !== filterStatus) return false;
      return true;
    });
  }, [crossTeamRows, filterTeam, filterStatus]);

  /* ── Stats ── */
  const stats = useMemo(() => ({
    total: crossTeamRows.length,
    employees: new Set(crossTeamRows.map(r => r.employeeId)).size,
    teamsInvolved: new Set([
      ...crossTeamRows.map(r => r.homeTeamId),
      ...crossTeamRows.map(r => r.workingTeamId)
    ]).size,
    inProgress: crossTeamRows.filter(r => r.ticketStatus === 'InProgress').length,
  }), [crossTeamRows]);

  /* ── Team lead options for filter ── */
  const tlOptions = useMemo(() => {
    const tls = {};
    crossTeamRows.forEach(r => { tls[r.homeTeamId] = r.homeTeam; });
    return Object.entries(tls).map(([id, name]) => ({ value: id, label: name }));
  }, [crossTeamRows]);

  /* ── Table columns ── */
  const columns = [
    {
      title: 'Employee',
      key: 'employee',
      width: 200,
      render: (_, r) => (
        <Space>
          <Avatar
            size={36}
            style={{ background: token.colorPrimary, flexShrink: 0 }}
            icon={<UserOutlined />}
          />
          <div>
            <Text strong style={{ display: 'block', fontSize: 13 }}>{r.employeeName}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{r.employeeEmail}</Text>
          </div>
        </Space>
      )
    },
    {
      title: 'Home Team (TL)',
      key: 'homeTeam',
      width: 160,
      render: (_, r) => (
        <Space size={6}>
          <TeamOutlined style={{ color: token.colorPrimary }} />
          <Text>{r.homeTeam}</Text>
        </Space>
      )
    },
    {
      title: '',
      key: 'arrow',
      width: 40,
      render: () => (
        <SwapOutlined style={{ fontSize: 18, color: '#fa8c16' }} />
      )
    },
    {
      title: 'Working Under (TL)',
      key: 'workingTeam',
      width: 160,
      render: (_, r) => (
        <Space size={6}>
          <ApartmentOutlined style={{ color: '#fa8c16' }} />
          <Text style={{ color: '#fa8c16', fontWeight: 600 }}>{r.workingTeam}</Text>
        </Space>
      )
    },
    {
      title: 'Project',
      dataIndex: 'projectName',
      key: 'project',
      width: 180,
      render: (name) => (
        <Space size={4}>
          <ProjectOutlined />
          <Text>{name}</Text>
        </Space>
      )
    },
    {
      title: 'Ticket',
      key: 'ticket',
      width: 220,
      render: (_, r) => (
        <div>
          <Text code style={{ fontSize: 11 }}>{r.ticketCode}</Text>
          <Text
            ellipsis={{ tooltip: r.ticketTitle }}
            style={{ display: 'block', fontSize: 12, marginTop: 2 }}
          >
            {r.ticketTitle}
          </Text>
        </div>
      )
    },
    {
      title: 'Ticket Status',
      key: 'status',
      width: 130,
      render: (_, r) => (
        <Tag
          icon={statusIcon(r.ticketStatus)}
          color="default"
          style={{
            color: statusColor(r.ticketStatus),
            borderColor: statusColor(r.ticketStatus),
            background: `${statusColor(r.ticketStatus)}15`,
            fontWeight: 600
          }}
        >
          {statusLabel(r.ticketStatus)}
        </Tag>
      )
    }
  ];

  const cardBg = isDarkMode ? '#18181b' : '#fff';
  const statCardStyle = {
    borderRadius: 12,
    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
    background: cardBg
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Cross-Team Assignments"
        subtitle="Employees currently working outside their assigned team"
      />

      {/* KPI Stats */}
      <Row gutter={16}>
        {[
          {
            label: 'Cross-Team Tickets',
            value: stats.total,
            icon: <SwapOutlined />,
            color: token.colorPrimary
          },
          {
            label: 'Employees Involved',
            value: stats.employees,
            icon: <UserOutlined />,
            color: '#52c41a'
          },
          {
            label: 'Teams Involved',
            value: stats.teamsInvolved,
            icon: <TeamOutlined />,
            color: '#fa8c16'
          },
          {
            label: 'In Progress',
            value: stats.inProgress,
            icon: <SyncOutlined spin={stats.inProgress > 0} />,
            color: '#1890ff'
          }
        ].map(s => (
          <Col xs={24} sm={12} md={6} key={s.label}>
            <Card style={statCardStyle} bodyStyle={{ padding: '16px 20px' }}>
              <Space>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: `${s.color}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, color: s.color
                }}>
                  {s.icon}
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{s.label}</Text>
                  <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, color: s.color }}>
                    {s.value}
                  </div>
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filters */}
      <Card
        style={statCardStyle}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <Space wrap>
          <Text strong>Filter by:</Text>
          <Select
            allowClear
            placeholder="Home Team Lead"
            style={{ width: 200 }}
            options={tlOptions}
            value={filterTeam}
            onChange={setFilterTeam}
          />
          <Select
            allowClear
            placeholder="Ticket Status"
            style={{ width: 160 }}
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: 'ToDo', label: 'To Do' },
              { value: 'InProgress', label: 'In Progress' },
              { value: 'InReview', label: 'In Review' },
            ]}
          />
          {(filterTeam || filterStatus) && (
            <Text
              type="secondary"
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => { setFilterTeam(null); setFilterStatus(null); }}
            >
              Clear filters
            </Text>
          )}
        </Space>
      </Card>

      {/* Table */}
      <Card style={statCardStyle} bodyStyle={{ padding: 0 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" tip="Analysing cross-team assignments..." />
          </div>
        ) : filtered.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: '60px 0' }}
            description={
              crossTeamRows.length === 0
                ? 'No cross-team assignments found. All employees are currently working within their home teams.'
                : 'No results match the selected filters.'
            }
          />
        ) : (
          <Table
            columns={columns}
            dataSource={filtered}
            rowKey="key"
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 15, showTotal: (t) => `${t} cross-team ticket${t !== 1 ? 's' : ''}` }}
            rowClassName={() => 'cross-team-row'}
            style={{ borderRadius: 12 }}
          />
        )}
      </Card>
    </div>
  );
};

export default CrossTeamPage;
