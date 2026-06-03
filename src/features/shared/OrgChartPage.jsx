import React, { useState, useEffect, useCallback } from 'react';
import { Input, Spin, Empty } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { adminService } from '../../services/adminService';
import { useThemeStore } from '../../store/themeStore';

/* ── Role colours ── */
const C = {
  PM:  { dot: '#2563eb', glow: '#1d4ed8', text: '#1e40af', label: 'Project Manager' },
  TL:  { dot: '#ea580c', glow: '#c2410c', text: '#9a3412', label: 'Team Leader'     },
  Emp: { dot: '#16a34a', glow: '#15803d', text: '#14532d', label: 'Employee'        },
};

/* ── Layout constants ── */
const DOT_PM  = 9;   // PM dot radius
const DOT_TL  = 7;   // TL dot radius
const DOT_EMP = 6;   // Employee dot radius
const VGAP    = 38;  // vertical gap between child nodes
const HGAP    = 80;  // horizontal gap between PM columns
const CHILD_DX = 70; // horizontal offset: PM center → child column
const CHILD_TOP_GAP = 48; // PM dot bottom → first child dot
const TOP_PAD  = 30;
const LEFT_PAD = 40;
const EMP_INDENT = 18; // extra indent for employees under a TL

/* ── Build positioned node + edge lists ── */
function buildSection(pm, secX) {
  const nodes = [];
  const edges = [];

  const pmX = secX;
  const pmY = TOP_PAD + DOT_PM;
  nodes.push({ id: pm.id, role: 'PM', name: pm.name || pm.fullName, x: pmX, y: pmY, r: DOT_PM });

  /* flatten children: TL then its Employees, then direct Emps */
  const rows = [];
  (pm.children || []).forEach(ch => {
    if (ch.type === 'TeamLead') {
      rows.push({ ...ch, role: 'TL', indent: 0 });
      (ch.children || []).forEach(e => rows.push({ ...e, role: 'Emp', indent: EMP_INDENT }));
    } else {
      rows.push({ ...ch, role: 'Emp', indent: 0 });
    }
  });

  const childX   = pmX + CHILD_DX;
  let   curY     = pmY + CHILD_TOP_GAP;
  const branchYs = [];

  rows.forEach(row => {
    const r  = row.role === 'TL' ? DOT_TL : DOT_EMP;
    const cx = childX + row.indent;
    const cy = curY + r;
    nodes.push({ id: row.id, role: row.role, name: row.name || row.fullName, x: cx, y: cy, r });
    branchYs.push({ cx, cy, r });
    curY += (r * 2) + VGAP;
  });

  /* vertical trunk from PM dot bottom to last child */
  if (branchYs.length > 0) {
    const trunkX = pmX;
    edges.push({ x1: trunkX, y1: pmY + DOT_PM, x2: trunkX, y2: branchYs[branchYs.length - 1].cy, type: 'trunk' });
    branchYs.forEach(({ cx, cy }) => {
      edges.push({ x1: trunkX, y1: cy, x2: cx - DOT_TL - 2, y2: cy, type: 'branch' });
    });
  }

  const sectionW = rows.length
    ? CHILD_DX + EMP_INDENT + DOT_EMP * 2 + 100 /* name label space */
    : DOT_PM * 2 + 100;
  const bottomY  = curY;
  return { nodes, edges, sectionW, bottomY };
}

/* ── Main Component ── */
const OrgChartPage = () => {
  const { isDarkMode }            = useThemeStore();
  const [users,    setUsers]      = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [search,   setSearch]     = useState('');

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try { const r = await adminService.getUsers(); setUsers(r.data || []); }
    catch { /* silent */ } finally { setLoading(false); }
  };

  const buildHierarchy = useCallback(() => {
    const pms  = users.filter(u => u.role === 'ProjectManager' || u.role === 'TenantAdmin');
    const tls  = users.filter(u => u.role === 'TeamLead');
    const emps = users.filter(u => u.role === 'Employee');

    const hier = pms.map(pm => ({
      ...pm, type: 'PM',
      children: [
        ...tls.filter(tl => String(tl.projectManagerId) === String(pm.id)).map(tl => ({
          ...tl, type: 'TeamLead',
          children: emps.filter(e => String(e.teamLeadId) === String(tl.id))
        })),
        ...emps.filter(e => String(e.projectManagerId) === String(pm.id) && !e.teamLeadId)
               .map(e => ({ ...e, type: 'Employee', children: [] }))
      ]
    }));

    const unTls  = tls.filter(tl => !tl.projectManagerId);
    const unEmps = emps.filter(e  => !e.teamLeadId && !e.projectManagerId);
    if (unTls.length || unEmps.length) {
      hier.push({
        id: '__unassigned__', name: 'Unassigned', fullName: 'Unassigned',
        role: 'ProjectManager', type: 'PM',
        children: [
          ...unTls.map(tl => ({ ...tl, type: 'TeamLead', children: emps.filter(e => String(e.teamLeadId) === String(tl.id)) })),
          ...unEmps.map(e  => ({ ...e,  type: 'Employee', children: [] }))
        ]
      });
    }
    return hier;
  }, [users]);

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: isDarkMode ? '#0a0e1a' : '#f0f4f8' }}>
      <Spin size="large" />
      <div style={{ marginTop: 16, color: '#64748b', fontWeight: 500 }}>Building Organization Chart…</div>
    </div>
  );

  const hierarchy = buildHierarchy();
  const q = search.toLowerCase();

  let cursorX = LEFT_PAD;
  const allNodes = [];
  const allEdges = [];

  hierarchy.forEach(pm => {
    const { nodes, edges, sectionW } = buildSection(pm, cursorX);
    allNodes.push(...nodes);
    allEdges.push(...edges);
    cursorX += sectionW + HGAP;
  });

  const VB_W = cursorX - HGAP + LEFT_PAD;
  const VB_H = allNodes.reduce((m, n) => Math.max(m, n.y + n.r + 20), 100);
  const bg   = isDarkMode ? '#0d1117' : '#f0f4f8';
  const lineC = isDarkMode ? '#334155' : '#94a3b8';
  const FONT  = 'Inter,system-ui,sans-serif';

  return (
    <div style={{
      position: 'fixed', top: 64, left: 240, right: 0, bottom: 0,
      overflow: 'hidden', background: bg,
      display: 'flex', flexDirection: 'column', userSelect: 'none',
    }}>
      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 20px', flexShrink: 0, gap: 16, flexWrap: 'wrap',
        background: isDarkMode ? 'rgba(15,23,42,0.96)' : 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(8px)',
        borderBottom: isDarkMode ? '1px solid #1e293b' : '1px solid #e2e8f0',
        zIndex: 10,
      }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: isDarkMode ? '#f1f5f9' : '#0f172a' }}>
          🏢 Organization Chart
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {Object.entries(C).map(([key, col]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: col.dot, boxShadow: `0 0 7px ${col.dot}` }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#475569' }}>{col.label}</span>
            </div>
          ))}
        </div>

        {/* Search */}
        <Input
          prefix={<SearchOutlined style={{ color: '#6366f1' }} />}
          placeholder="Search members…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
          style={{ width: 200, borderRadius: 8, background: isDarkMode ? '#1e293b' : '#f8fafc' }}
        />
      </div>

      {/* ── Chart ── */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {allNodes.length === 0
          ? <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Empty /></div>
          : (
          <svg width="100%" height="100%"
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="xMidYMin meet"
            style={{ display: 'block' }}
          >
            <defs>
              <pattern id="dotbg" width="22" height="22" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.7" fill={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'} />
              </pattern>
            </defs>
            <rect width={VB_W} height={VB_H} fill="url(#dotbg)" />

            {/* Lines */}
            {allEdges.map((e, i) => (
              <line key={i}
                x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                stroke={lineC}
                strokeWidth={e.type === 'trunk' ? 1.5 : 1.2}
                strokeDasharray={e.type === 'branch' ? '5 3' : 'none'}
                opacity={q ? 0.12 : 0.75}
              />
            ))}

            {/* Nodes */}
            {allNodes.map(node => {
              const col  = C[node.role];
              const hit  = q && (node.name || '').toLowerCase().includes(q);
              const dim  = !!q && !hit;
              const name = (node.name || '');
              const labelX = node.x + node.r + 6;

              return (
                <g key={node.id} opacity={dim ? 0.1 : 1}>
                  {/* glow ring on highlight */}
                  {hit && (
                    <circle cx={node.x} cy={node.y} r={node.r + 5}
                      fill="none" stroke={col.dot} strokeWidth={1.8}
                      style={{ filter: `drop-shadow(0 0 5px ${col.dot})` }}
                    />
                  )}
                  {/* dot */}
                  <circle cx={node.x} cy={node.y} r={node.r}
                    fill={col.dot}
                    stroke={isDarkMode ? '#0d1117' : '#ffffff'}
                    strokeWidth={node.role === 'PM' ? 2.2 : 1.6}
                    style={{ filter: `drop-shadow(0 2px 5px ${col.glow}88)` }}
                  />
                  {/* name label */}
                  <text
                    x={labelX} y={node.y + node.r * 0.4}
                    fontSize={node.role === 'PM' ? 10 : node.role === 'TL' ? 9 : 8}
                    fontWeight={node.role === 'PM' ? 700 : node.role === 'TL' ? 600 : 500}
                    fill={hit ? col.dot : (isDarkMode ? (node.role === 'PM' ? '#93c5fd' : node.role === 'TL' ? '#fdba74' : '#86efac') : col.text)}
                    style={{ fontFamily: FONT }}
                  >
                    {name.length > 20 ? name.slice(0, 19) + '…' : name}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
};

export default OrgChartPage;
