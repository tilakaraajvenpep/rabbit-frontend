import React, { useState, useEffect, useCallback } from 'react';
import { Input, Spin, Empty } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { adminService } from '../../services/adminService';
import { useThemeStore } from '../../store/themeStore';

/* ── Role palette ── */
const C = {
  PM:  { dot: '#3b82f6', glow: '#1d4ed8', pill: '#dbeafe', pillTxt: '#1e40af', label: 'Project Manager' },
  TL:  { dot: '#f97316', glow: '#ea580c', pill: '#ffedd5', pillTxt: '#9a3412', label: 'Team Leader'     },
  Emp: { dot: '#22c55e', glow: '#15803d', pill: '#dcfce7', pillTxt: '#14532d', label: 'Employee'        },
};

/* ── Layout ── */
const DOT   = { PM: 12, TL: 9, Emp: 7 };
const FONT  = { PM: 14, TL: 12, Emp: 11 };
const PILL_H     = 22;   // label pill height
const PILL_PAD   = 10;   // horizontal padding inside pill
const VGAP       = 46;   // vertical gap between child nodes
const HGAP       = 140;  // gap between PM columns
const BRANCH     = 40;   // horizontal branch length
const CHILD_TOP  = 50;   // gap from PM dot to first child
const EMP_INDENT = 20;   // extra right-indent for employees under TL
const TOP_PAD    = 40;
const LEFT_PAD   = 50;
const MAX_NAME   = 22;   // chars before truncation

const FONT_FAMILY = 'Inter,system-ui,sans-serif';

function truncate(s) { return s && s.length > MAX_NAME ? s.slice(0, MAX_NAME - 1) + '…' : (s || ''); }

/* ── Build positions for one PM section ── */
function buildSection(pm, secX) {
  const nodes = [];
  const edges = [];

  const pmR = DOT.PM;
  const pmX = secX;
  const pmY = TOP_PAD + pmR;
  nodes.push({ id: pm.id, role: 'PM', name: truncate(pm.name || pm.fullName), x: pmX, y: pmY, r: pmR });

  /* flatten: TL → its Emps → direct Emps */
  const rows = [];
  (pm.children || []).forEach(ch => {
    if (ch.type === 'TeamLead') {
      rows.push({ ...ch, role: 'TL', indent: 0 });
      (ch.children || []).forEach(e => rows.push({ ...e, role: 'Emp', indent: EMP_INDENT }));
    } else {
      rows.push({ ...ch, role: 'Emp', indent: 0 });
    }
  });

  const trunkX   = pmX;
  const childBaseX = pmX + BRANCH;
  let   curY     = pmY + pmR + CHILD_TOP;
  const branchYs = [];

  rows.forEach(row => {
    const r  = DOT[row.role];
    const cx = childBaseX + row.indent;
    const cy = curY + r;
    nodes.push({ id: row.id, role: row.role, name: truncate(row.name || row.fullName), x: cx, y: cy, r });
    branchYs.push({ cx, cy });
    curY += r * 2 + VGAP;
  });

  /* vertical trunk + horizontal branches */
  if (branchYs.length) {
    edges.push({ x1: trunkX, y1: pmY + pmR, x2: trunkX, y2: branchYs[branchYs.length - 1].cy, type: 'trunk' });
    branchYs.forEach(({ cx, cy }) => {
      edges.push({ x1: trunkX, y1: cy, x2: cx - 4, y2: cy, type: 'branch' });
    });
  }

  /* estimate max text width for section width */
  const maxW = Math.max(
    pm.name ? pm.name.length * 8.5 + BRANCH + 30 : 0,
    ...rows.map(r => r.name.length * 7.5 + BRANCH + r.indent + 30)
  );
  const sectionW = Math.max(maxW, BRANCH + 160);
  const bottomY  = curY;
  return { nodes, edges, sectionW, bottomY };
}

/* ── Main Component ── */
const OrgChartPage = () => {
  const { isDarkMode }         = useThemeStore();
  const [users,   setUsers]    = useState([]);
  const [loading, setLoading]  = useState(true);
  const [search,  setSearch]   = useState('');

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
      <div style={{ marginTop: 16, color: '#64748b', fontWeight: 500, fontFamily: FONT_FAMILY }}>Building Organization Chart…</div>
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

  const VB_W  = cursorX - HGAP + LEFT_PAD;
  const VB_H  = allNodes.reduce((m, n) => Math.max(m, n.y + n.r + PILL_H + 10), 120);
  const bg    = isDarkMode ? '#0d1117' : '#f1f5f9';
  const lineC = isDarkMode ? '#475569' : '#94a3b8';

  return (
    <div style={{
      position: 'fixed', top: 64, left: 240, right: 0, bottom: 0,
      overflow: 'hidden', background: bg,
      display: 'flex', flexDirection: 'column', userSelect: 'none',
    }}>
      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 24px', flexShrink: 0, gap: 16, flexWrap: 'wrap',
        background: isDarkMode ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(10px)',
        borderBottom: isDarkMode ? '1px solid #1e293b' : '1px solid #e2e8f0',
        zIndex: 10,
      }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: isDarkMode ? '#f1f5f9' : '#0f172a', fontFamily: FONT_FAMILY, letterSpacing: '-0.3px' }}>
          🏢 Organization Chart
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
          {Object.entries(C).map(([key, col]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 13, height: 13, borderRadius: '50%', background: col.dot, boxShadow: `0 0 8px ${col.dot}` }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#475569', fontFamily: FONT_FAMILY }}>{col.label}</span>
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
          style={{ width: 210, borderRadius: 8, background: isDarkMode ? '#1e293b' : '#f8fafc', fontFamily: FONT_FAMILY }}
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
              <pattern id="dotbg" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.8" fill={isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.055)'} />
              </pattern>
            </defs>
            <rect width={VB_W} height={VB_H} fill="url(#dotbg)" />

            {/* ── Connector lines ── */}
            {allEdges.map((e, i) => (
              <line key={i}
                x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                stroke={lineC}
                strokeWidth={e.type === 'trunk' ? 1.6 : 1.3}
                strokeDasharray={e.type === 'branch' ? '5 4' : 'none'}
                opacity={q ? 0.1 : 0.7}
              />
            ))}

            {/* ── Nodes ── */}
            {allNodes.map(node => {
              const col  = C[node.role];
              const hit  = q && node.name.toLowerCase().includes(q);
              const dim  = !!q && !hit;
              const fs   = FONT[node.role];
              const nameW = Math.min(node.name.length * (fs * 0.62) + PILL_PAD * 2, 200);
              const pillX = node.x + node.r + 10;
              const pillY = node.y - PILL_H / 2;

              return (
                <g key={node.id} opacity={dim ? 0.08 : 1}>
                  {/* highlight glow */}
                  {hit && (
                    <circle cx={node.x} cy={node.y} r={node.r + 6}
                      fill="none" stroke={col.dot} strokeWidth={2}
                      style={{ filter: `drop-shadow(0 0 7px ${col.dot})` }}
                    />
                  )}

                  {/* dot */}
                  <circle cx={node.x} cy={node.y} r={node.r}
                    fill={col.dot}
                    stroke={isDarkMode ? bg : '#fff'}
                    strokeWidth={node.role === 'PM' ? 2.5 : 2}
                    style={{ filter: `drop-shadow(0 2px 6px ${col.glow}99)` }}
                  />

                  {/* pill label background */}
                  <rect
                    x={pillX} y={pillY}
                    width={nameW} height={PILL_H}
                    rx={PILL_H / 2}
                    fill={hit ? col.dot : (isDarkMode ? 'rgba(30,41,59,0.85)' : col.pill)}
                    stroke={isDarkMode ? col.dot + '44' : col.dot + '55'}
                    strokeWidth={0.8}
                  />

                  {/* name text */}
                  <text
                    x={pillX + nameW / 2} y={node.y + fs * 0.36}
                    textAnchor="middle"
                    fontSize={fs}
                    fontWeight={node.role === 'PM' ? 700 : node.role === 'TL' ? 600 : 500}
                    fill={hit ? '#fff' : (isDarkMode ? '#e2e8f0' : col.pillTxt)}
                    style={{ fontFamily: FONT_FAMILY }}
                  >
                    {node.name}
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
