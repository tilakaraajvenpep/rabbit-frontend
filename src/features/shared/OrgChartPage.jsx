import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input, Spin, Empty, Button, Tooltip } from 'antd';
import { SearchOutlined, ClearOutlined, ZoomInOutlined, ZoomOutOutlined, FullscreenExitOutlined } from '@ant-design/icons';
import { adminService } from '../../services/adminService';
import { useThemeStore } from '../../store/themeStore';

/* ─────────────────────────── Constants ─────────────────────────── */
const CARD_W   = 154;
const CARD_H   = 60;
const H_GAP    = 28;   // horizontal gap between siblings
const V_GAP    = 72;   // vertical gap between levels
const LEVEL_Y  = [0, V_GAP + CARD_H, 2 * (V_GAP + CARD_H)];

const ROLE_COLORS = {
  PM:       { bg: '#1e3a5f', border: '#2563eb', text: '#e0f2fe', label: 'Project Manager', dot: '#3b82f6' },
  TL:       { bg: '#1a3a2a', border: '#16a34a', text: '#dcfce7', label: 'Team Leader',      dot: '#22c55e' },
  Employee: { bg: '#2d1b3d', border: '#7c3aed', text: '#ede9fe', label: 'Employee',         dot: '#a78bfa' },
};

/* ─────────────────── Tree layout calculation ─────────────────── */
function calcLayout(pmNodes) {
  // Returns { nodes: [{id, x, y, ...data}], edges: [{x1,y1,x2,y2}] }
  const nodes = [];
  const edges = [];
  let cursorX  = 0;

  pmNodes.forEach(pm => {
    const tls = pm.children.filter(c => c.type === 'TeamLead');
    const directEmps = pm.children.filter(c => c.type !== 'TeamLead');

    // Compute TL subtree widths
    const tlWidths = tls.map(tl => {
      const empCount = (tl.children || []).length;
      return Math.max(1, empCount) * (CARD_W + H_GAP) - H_GAP;
    });

    const directEmpWidth = directEmps.length > 0
      ? directEmps.length * (CARD_W + H_GAP) - H_GAP
      : 0;

    // Total width of PM subtree
    const totalChildWidth = [
      ...tlWidths,
      ...(directEmpWidth > 0 ? [directEmpWidth] : [])
    ].reduce((s, w, i, a) => s + w + (i < a.length - 1 ? H_GAP : 0), 0);

    const pmWidth = Math.max(CARD_W, totalChildWidth);
    const pmX     = cursorX + (pmWidth - CARD_W) / 2;
    const pmY     = LEVEL_Y[0];

    nodes.push({ id: pm.id, x: pmX, y: pmY, role: 'PM', name: pm.name || pm.fullName, email: pm.email });

    let childCursorX = cursorX;

    // Render TL subtrees
    tls.forEach((tl, i) => {
      const tlSubW  = tlWidths[i];
      const tlX     = childCursorX + (tlSubW - CARD_W) / 2;
      const tlY     = LEVEL_Y[1];

      nodes.push({ id: tl.id, x: tlX, y: tlY, role: 'TL', name: tl.name || tl.fullName, email: tl.email });

      // Edge: PM → TL
      edges.push({
        x1: pmX  + CARD_W / 2,
        y1: pmY  + CARD_H,
        x2: tlX  + CARD_W / 2,
        y2: tlY,
      });

      // TL employees
      const tlEmps = tl.children || [];
      const empStartX = childCursorX;

      tlEmps.forEach((emp, ei) => {
        const empX = empStartX + ei * (CARD_W + H_GAP);
        const empY = LEVEL_Y[2];
        nodes.push({ id: emp.id, x: empX, y: empY, role: 'Employee', name: emp.name || emp.fullName, email: emp.email });

        // Edge: TL → Employee
        edges.push({
          x1: tlX  + CARD_W / 2,
          y1: tlY  + CARD_H,
          x2: empX + CARD_W / 2,
          y2: empY,
        });
      });

      childCursorX += tlSubW + H_GAP;
    });

    // Direct employees under PM
    if (directEmps.length > 0) {
      directEmps.forEach((emp, di) => {
        const empX = childCursorX + di * (CARD_W + H_GAP);
        const empY = LEVEL_Y[1]; // same level as TL
        nodes.push({ id: emp.id, x: empX, y: empY, role: 'Employee', name: emp.name || emp.fullName, email: emp.email });

        edges.push({
          x1: pmX  + CARD_W / 2,
          y1: pmY  + CARD_H,
          x2: empX + CARD_W / 2,
          y2: empY,
        });
      });
    }

    cursorX += pmWidth + H_GAP * 4;
  });

  return { nodes, edges };
}

/* ─────────────────── Main Component ─────────────────── */
const OrgChartPage = () => {
  const { isDarkMode } = useThemeStore();
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [scale,       setScale]       = useState(1);
  const [pan,         setPan]         = useState({ x: 40, y: 40 });
  const [dragging,    setDragging]    = useState(false);
  const [dragStart,   setDragStart]   = useState(null);
  const svgRef = useRef(null);

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
      const pmTls = tls.filter(tl => String(tl.projectManagerId) === String(pm.id));
      const directEmps = employees.filter(e => String(e.projectManagerId) === String(pm.id) && !e.teamLeadId);
      const tlNodes = pmTls.map(tl => ({
        ...tl, type: 'TeamLead',
        children: employees.filter(e => String(e.teamLeadId) === String(tl.id))
      }));
      return { ...pm, type: 'PM', children: [...tlNodes, ...directEmps.map(e => ({ ...e, type: 'Employee', children: [] }))] };
    });

    const unassignedTls  = tls.filter(tl => !tl.projectManagerId);
    const unassignedEmps = employees.filter(e => !e.teamLeadId && !e.projectManagerId);
    const extras = [
      ...unassignedTls.map(tl => ({ ...tl, type: 'TeamLead', children: employees.filter(e => String(e.teamLeadId) === String(tl.id)) })),
      ...unassignedEmps.map(e => ({ ...e, type: 'Employee', children: [] }))
    ];
    if (extras.length > 0) {
      hierarchy.push({ id: 'unassigned', name: 'Unassigned / General', fullName: 'Unassigned / General', email: '', role: 'PM', type: 'PM', children: extras });
    }

    return hierarchy;
  }, [users]);

  /* Search match */
  const matchesSearch = useCallback((name, email) => {
    if (!searchQuery) return false;
    const q = searchQuery.toLowerCase();
    return (name || '').toLowerCase().includes(q) || (email || '').toLowerCase().includes(q);
  }, [searchQuery]);

  /* Pan drag */
  const onMouseDown = (e) => { setDragging(true); setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); };
  const onMouseMove = (e) => { if (!dragging || !dragStart) return; setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); };
  const onMouseUp   = ()  => { setDragging(false); setDragStart(null); };

  const zoomIn  = () => setScale(s => Math.min(s + 0.15, 2));
  const zoomOut = () => setScale(s => Math.max(s - 0.15, 0.25));
  const resetView = () => { setScale(1); setPan({ x: 40, y: 40 }); };

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

  // Compute SVG canvas size
  const maxX = nodes.reduce((m, n) => Math.max(m, n.x + CARD_W), 0) + 80;
  const maxY = nodes.reduce((m, n) => Math.max(m, n.y + CARD_H), 0) + 80;

  const bg      = isDarkMode ? '#080c18' : '#eef2f7';
  const cardShadow = isDarkMode
    ? '0 4px 24px rgba(0,0,0,0.6)'
    : '0 4px 16px rgba(0,0,0,0.15)';

  return (
    <div
      style={{
        position: 'fixed',
        top: 64,       // header height
        left: 240,     // sidebar width (adjust if collapsed)
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
        padding: '10px 20px',
        background: isDarkMode ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(8px)',
        borderBottom: isDarkMode ? '1px solid #1e293b' : '1px solid #e2e8f0',
        flexShrink: 0,
        gap: 16,
        flexWrap: 'wrap',
        zIndex: 10,
      }}>
        {/* Title */}
        <div style={{ fontWeight: 800, fontSize: 18, color: isDarkMode ? '#f1f5f9' : '#0f172a', letterSpacing: '-0.5px' }}>
          🏢 Organization Chart
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          {Object.entries(ROLE_COLORS).map(([key, c]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: c.dot, boxShadow: `0 0 6px ${c.dot}` }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#475569' }}>{c.label}</span>
            </div>
          ))}
        </div>

        {/* Search + Zoom controls */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#6366f1' }} />}
            placeholder="Search members…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            allowClear
            style={{ width: 200, borderRadius: 8, background: isDarkMode ? '#1e293b' : '#f8fafc' }}
          />
          <Tooltip title="Zoom In">
            <Button icon={<ZoomInOutlined />} onClick={zoomIn} style={{ borderRadius: 8 }} />
          </Tooltip>
          <Tooltip title="Zoom Out">
            <Button icon={<ZoomOutOutlined />} onClick={zoomOut} style={{ borderRadius: 8 }} />
          </Tooltip>
          <Tooltip title="Reset View">
            <Button icon={<FullscreenExitOutlined />} onClick={resetView} style={{ borderRadius: 8 }} />
          </Tooltip>
          <span style={{ fontSize: 12, color: isDarkMode ? '#64748b' : '#94a3b8', fontWeight: 500, minWidth: 40 }}>
            {Math.round(scale * 100)}%
          </span>
        </div>
      </div>

      {/* ── Chart canvas ── */}
      <div
        ref={svgRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ flex: 1, overflow: 'hidden', cursor: dragging ? 'grabbing' : 'grab', position: 'relative' }}
      >
        {nodes.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Empty description="No organization data found." />
          </div>
        ) : (
          <svg
            width="100%"
            height="100%"
            style={{ display: 'block' }}
          >
            <defs>
              {/* Subtle grid pattern for background texture */}
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke={isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'} strokeWidth="1" />
              </pattern>

              {/* Glow filter for highlighted cards */}
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>

              {/* Arrow marker */}
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                <path d="M0,0 L0,8 L8,4 z" fill={isDarkMode ? '#334155' : '#94a3b8'} />
              </marker>
            </defs>

            {/* Background grid */}
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Transformed group for pan + zoom */}
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>

              {/* ── Edges (drawn first, behind cards) ── */}
              {edges.map((e, i) => {
                const midY = (e.y1 + e.y2) / 2;
                return (
                  <path
                    key={i}
                    d={`M ${e.x1} ${e.y1} C ${e.x1} ${midY}, ${e.x2} ${midY}, ${e.x2} ${e.y2}`}
                    fill="none"
                    stroke={isDarkMode ? '#1e3a5f' : '#93c5fd'}
                    strokeWidth="1.8"
                    strokeDasharray="none"
                    opacity={searchQuery ? 0.2 : 0.7}
                  />
                );
              })}

              {/* ── Nodes (cards) ── */}
              {nodes.map(node => {
                const c = ROLE_COLORS[node.role];
                const highlighted = matchesSearch(node.name, node.email);
                const dimmed = searchQuery && !highlighted;

                return (
                  <g key={node.id} transform={`translate(${node.x}, ${node.y})`} opacity={dimmed ? 0.15 : 1}>
                    {/* Glow halo on search highlight */}
                    {highlighted && (
                      <rect
                        x={-4} y={-4}
                        width={CARD_W + 8} height={CARD_H + 8}
                        rx={14}
                        fill="none"
                        stroke={c.dot}
                        strokeWidth="2.5"
                        filter="url(#glow)"
                        opacity={0.9}
                      />
                    )}

                    {/* Card background */}
                    <rect
                      x={0} y={0}
                      width={CARD_W} height={CARD_H}
                      rx={10}
                      fill={c.bg}
                      stroke={highlighted ? c.dot : c.border}
                      strokeWidth={highlighted ? 2 : 1.2}
                      style={{ filter: `drop-shadow(0 4px 10px rgba(0,0,0,0.4))` }}
                    />

                    {/* Left accent bar */}
                    <rect x={0} y={0} width={4} height={CARD_H} rx={2} fill={c.dot} />

                    {/* Role label */}
                    <text
                      x={16} y={20}
                      fontSize="9"
                      fontWeight="700"
                      fill={c.dot}
                      letterSpacing="0.8"
                      style={{ textTransform: 'uppercase' }}
                    >
                      {c.label.toUpperCase()}
                    </text>

                    {/* Name */}
                    <foreignObject x={14} y={24} width={CARD_W - 18} height={32}>
                      <div
                        xmlns="http://www.w3.org/1999/xhtml"
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: c.text,
                          lineHeight: '1.25',
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          wordBreak: 'break-word',
                        }}
                      >
                        {node.name}
                      </div>
                    </foreignObject>

                    {/* Dot indicator */}
                    <circle cx={CARD_W - 10} cy={10} r={4} fill={c.dot} opacity={0.9} />
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </div>

      {/* ── Bottom hint ── */}
      <div style={{
        padding: '6px 20px',
        background: isDarkMode ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(6px)',
        borderTop: isDarkMode ? '1px solid #1e293b' : '1px solid #e2e8f0',
        fontSize: 11,
        color: isDarkMode ? '#475569' : '#94a3b8',
        flexShrink: 0,
      }}>
        💡 Drag to pan · Use zoom buttons or scroll wheel to adjust view
      </div>
    </div>
  );
};

export default OrgChartPage;
