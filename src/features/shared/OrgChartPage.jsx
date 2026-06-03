import React, { useState, useEffect, useCallback } from 'react';
import { Input, Spin, Empty } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { adminService } from '../../services/adminService';
import { useThemeStore } from '../../store/themeStore';

/* ─────────────────────────── Layout Constants ─────────────────────────── */
// Compact node: just a dot + label
const NODE_R    = 7;    // circle radius
const H_GAP     = 52;   // horizontal gap between sibling nodes
const V_GAP     = 64;   // vertical gap between levels
const LABEL_H   = 28;   // space reserved below node for text label
const NODE_SLOT = NODE_R * 2 + H_GAP; // total width per node slot

/* Role color palette */
const ROLE_COLORS = {
  PM:       { dot: '#3b82f6', text: '#60a5fa', glow: '#1d4ed8', label: 'Project Manager' },
  TL:       { dot: '#22c55e', text: '#4ade80', glow: '#15803d', label: 'Team Leader'     },
  Employee: { dot: '#a78bfa', text: '#c4b5fd', glow: '#6d28d9', label: 'Employee'        },
};

/* ─────────────────── Tree layout (returns x/y for each node) ─────────────────── */
function calcLayout(pmNodes) {
  const nodes = [];
  const edges = [];
  let cursorX  = NODE_R + 10;

  pmNodes.forEach(pm => {
    const tls        = pm.children.filter(c => c.type === 'TeamLead');
    const directEmps = pm.children.filter(c => c.type !== 'TeamLead');

    /* Width of each TL's subtree */
    const tlWidths = tls.map(tl => {
      const ec = (tl.children || []).length;
      return Math.max(1, ec) * NODE_SLOT - H_GAP;
    });

    const directEmpWidth = directEmps.length > 0
      ? directEmps.length * NODE_SLOT - H_GAP
      : 0;

    const totalChildWidth = [
      ...tlWidths,
      ...(directEmpWidth > 0 ? [directEmpWidth] : [])
    ].reduce((s, w, i, a) => s + w + (i < a.length - 1 ? H_GAP : 0), 0);

    const pmWidth = Math.max(NODE_SLOT, totalChildWidth);
    const pmX     = cursorX + (pmWidth - NODE_R * 2) / 2;
    const pmY     = NODE_R + 10;

    nodes.push({ id: pm.id, x: pmX, y: pmY, role: 'PM', name: pm.name || pm.fullName });

    let childCursorX = cursorX;

    /* TL subtrees */
    tls.forEach((tl, i) => {
      const tlSubW = tlWidths[i];
      const tlX    = childCursorX + (tlSubW - NODE_R * 2) / 2;
      const tlY    = pmY + V_GAP;

      nodes.push({ id: tl.id, x: tlX, y: tlY, role: 'TL', name: tl.name || tl.fullName });

      edges.push({ x1: pmX, y1: pmY + NODE_R, x2: tlX, y2: tlY - NODE_R });

      const tlEmps    = tl.children || [];
      const empStartX = childCursorX;

      tlEmps.forEach((emp, ei) => {
        const empX = empStartX + ei * NODE_SLOT + NODE_R;
        const empY = tlY + V_GAP;
        nodes.push({ id: emp.id, x: empX, y: empY, role: 'Employee', name: emp.name || emp.fullName });
        edges.push({ x1: tlX, y1: tlY + NODE_R, x2: empX, y2: empY - NODE_R });
      });

      childCursorX += tlSubW + H_GAP;
    });

    /* Direct employees under PM */
    if (directEmps.length > 0) {
      directEmps.forEach((emp, di) => {
        const empX = childCursorX + di * NODE_SLOT + NODE_R;
        const empY = pmY + V_GAP;
        nodes.push({ id: emp.id, x: empX, y: empY, role: 'Employee', name: emp.name || emp.fullName });
        edges.push({ x1: pmX, y1: pmY + NODE_R, x2: empX, y2: empY - NODE_R });
      });
    }

    cursorX += pmWidth + H_GAP * 3;
  });

  return { nodes, edges };
}

/* ─────────────────── Utility: wrap long names into ≤2 lines ─────────────────── */
function splitName(name, maxChars = 12) {
  if (!name) return [''];
  const words = name.split(' ');
  const lines = [];
  let current = '';
  for (const w of words) {
    if ((current + (current ? ' ' : '') + w).length <= maxChars) {
      current += (current ? ' ' : '') + w;
    } else {
      if (current) lines.push(current);
      current = w.length > maxChars ? w.slice(0, maxChars - 1) + '…' : w;
    }
    if (lines.length === 1 && current) {
      lines.push(current);
      current = '';
      break;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

/* ─────────────────── Main Component ─────────────────── */
const OrgChartPage = () => {
  const { isDarkMode } = useThemeStore();
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await adminService.getUsers();
      setUsers(res.data || []);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  /* Build hierarchy */
  const buildHierarchy = useCallback(() => {
    const pms       = users.filter(u => u.role === 'ProjectManager' || u.role === 'TenantAdmin');
    const tls       = users.filter(u => u.role === 'TeamLead');
    const employees = users.filter(u => u.role === 'Employee');

    const hierarchy = pms.map(pm => {
      const pmTls      = tls.filter(tl => String(tl.projectManagerId) === String(pm.id));
      const directEmps = employees.filter(e => String(e.projectManagerId) === String(pm.id) && !e.teamLeadId);
      const tlNodes    = pmTls.map(tl => ({
        ...tl, type: 'TeamLead',
        children: employees.filter(e => String(e.teamLeadId) === String(tl.id))
      }));
      return { ...pm, type: 'PM', children: [...tlNodes, ...directEmps.map(e => ({ ...e, type: 'Employee', children: [] }))] };
    });

    const unassignedTls  = tls.filter(tl => !tl.projectManagerId);
    const unassignedEmps = employees.filter(e => !e.teamLeadId && !e.projectManagerId);
    const extras = [
      ...unassignedTls.map(tl => ({ ...tl, type: 'TeamLead', children: employees.filter(e => String(e.teamLeadId) === String(tl.id)) })),
      ...unassignedEmps.map(e  => ({ ...e,  type: 'Employee', children: [] }))
    ];
    if (extras.length > 0) {
      hierarchy.push({ id: 'unassigned', name: 'Unassigned', fullName: 'Unassigned', email: '', role: 'PM', type: 'PM', children: extras });
    }

    return hierarchy;
  }, [users]);

  const matchesSearch = useCallback((name) => {
    if (!searchQuery) return false;
    return (name || '').toLowerCase().includes(searchQuery.toLowerCase());
  }, [searchQuery]);

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: isDarkMode ? '#0a0e1a' : '#f0f4f8' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 500 }}>Building Organization Chart…</div>
      </div>
    );
  }

  const hierarchy = buildHierarchy();
  const { nodes, edges } = calcLayout(hierarchy);

  /* Canvas bounds */
  const padX = 30;
  const padY = 30;
  const canvasW = nodes.reduce((m, n) => Math.max(m, n.x + NODE_R), 0) + padX;
  const canvasH = nodes.reduce((m, n) => Math.max(m, n.y + NODE_R + LABEL_H), 0) + padY;
  const viewBox = `0 0 ${canvasW} ${canvasH}`;

  const bg = isDarkMode ? '#080c18' : '#eef2f7';

  const TOOLBAR_H = 52; // px
  const LEGEND_H  = 32; // px

  return (
    <div
      style={{
        position: 'fixed',
        top: 64,
        left: 240,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        background: bg,
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      {/* ── Top toolbar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 20px',
        background: isDarkMode ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: isDarkMode ? '1px solid #1e293b' : '1px solid #e2e8f0',
        flexShrink: 0,
        gap: 16,
        flexWrap: 'wrap',
        height: TOOLBAR_H,
        zIndex: 10,
      }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: isDarkMode ? '#f1f5f9' : '#0f172a', letterSpacing: '-0.5px' }}>
          🏢 Organization Chart
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {Object.entries(ROLE_COLORS).map(([key, c]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{
                width: 13, height: 13, borderRadius: '50%',
                background: c.dot,
                boxShadow: `0 0 8px ${c.dot}88`,
              }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#475569' }}>{c.label}</span>
            </div>
          ))}
        </div>

        {/* Search */}
        <Input
          prefix={<SearchOutlined style={{ color: '#6366f1' }} />}
          placeholder="Search members…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          allowClear
          style={{ width: 200, borderRadius: 8, background: isDarkMode ? '#1e293b' : '#f8fafc' }}
        />
      </div>

      {/* ── SVG Chart — fills the remaining space, auto-fit ── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {nodes.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Empty description="No organization data found." />
          </div>
        ) : (
          <svg
            width="100%"
            height="100%"
            viewBox={viewBox}
            preserveAspectRatio="xMidYMid meet"
            style={{ display: 'block' }}
          >
            <defs>
              {/* Subtle dot-grid background */}
              <pattern id="dotgrid" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.8" fill={isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'} />
              </pattern>

              {/* Glow filter for highlighted nodes */}
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Background */}
            <rect width={canvasW} height={canvasH} fill="url(#dotgrid)" />

            {/* ── Edges ── */}
            {edges.map((e, i) => {
              const midY = (e.y1 + e.y2) / 2;
              return (
                <path
                  key={i}
                  d={`M ${e.x1} ${e.y1} C ${e.x1} ${midY}, ${e.x2} ${midY}, ${e.x2} ${e.y2}`}
                  fill="none"
                  stroke={isDarkMode ? '#2563eb44' : '#93c5fd88'}
                  strokeWidth="1.2"
                  opacity={searchQuery ? 0.15 : 0.9}
                />
              );
            })}

            {/* ── Nodes ── */}
            {nodes.map(node => {
              const c           = ROLE_COLORS[node.role];
              const highlighted = matchesSearch(node.name);
              const dimmed      = searchQuery && !highlighted;
              const nameLines   = splitName(node.name, node.role === 'PM' ? 14 : 11);

              return (
                <g key={node.id} opacity={dimmed ? 0.12 : 1}>
                  {/* Glow ring on search highlight */}
                  {highlighted && (
                    <circle
                      cx={node.x} cy={node.y}
                      r={NODE_R + 5}
                      fill="none"
                      stroke={c.dot}
                      strokeWidth="1.5"
                      filter="url(#glow)"
                      opacity={0.85}
                    />
                  )}

                  {/* Role dot */}
                  <circle
                    cx={node.x} cy={node.y}
                    r={node.role === 'PM' ? NODE_R + 2 : node.role === 'TL' ? NODE_R + 1 : NODE_R}
                    fill={c.dot}
                    stroke={isDarkMode ? '#0f172a' : '#ffffff'}
                    strokeWidth={node.role === 'PM' ? 2.5 : 1.8}
                    style={{ filter: `drop-shadow(0 2px 6px ${c.glow}88)` }}
                  />

                  {/* Name label lines below the dot */}
                  {nameLines.map((line, li) => (
                    <text
                      key={li}
                      x={node.x}
                      y={node.y + (node.role === 'PM' ? NODE_R + 3 : node.role === 'TL' ? NODE_R + 2 : NODE_R + 1) + 10 + li * 11}
                      textAnchor="middle"
                      fontSize={node.role === 'PM' ? 8.5 : node.role === 'TL' ? 7.5 : 6.8}
                      fontWeight={node.role === 'PM' ? 700 : node.role === 'TL' ? 600 : 500}
                      fill={highlighted ? c.dot : (isDarkMode ? c.text : (node.role === 'PM' ? '#1e3a5f' : node.role === 'TL' ? '#14532d' : '#4c1d95'))}
                      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                    >
                      {line}
                    </text>
                  ))}
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
