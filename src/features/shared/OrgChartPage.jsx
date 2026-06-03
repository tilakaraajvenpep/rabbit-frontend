import React, { useState, useEffect, useCallback } from 'react';
import { Input, Spin, Empty } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { adminService } from '../../services/adminService';
import { useThemeStore } from '../../store/themeStore';

/* ── Dimensions ── */
const CW   = 160; // child card width
const CH   = 58;  // child card height
const IW   = 44;  // icon section width inside card
const PW   = 140; // PM card width
const PH   = 72;  // PM card height
const PIW  = 48;  // PM icon section width

const VGAP        = 8;   // gap between child cards
const BRANCH      = 22;  // horizontal branch length trunk→card
const CHILD_TOP   = 20;  // gap between PM card bottom and first child
const EMP_INDENT  = 18;  // extra right-indent for employees under a TL
const COL_SEP     = 50;  // gap between PM columns
const TOP_PAD     = 28;
const LEFT_PAD    = 36;

/* ── Card colours ── */
const C = {
  PM:  { icon: '#1565c0', bg: '#dbeafe', border: '#1d4ed8', txt: '#1e3a8a', dot: '#3b82f6', label: 'Project Manager' },
  TL:  { icon: '#c2410c', bg: '#fff3e0', border: '#ea580c', txt: '#7c2d12', dot: '#f97316', label: 'Team Leader'     },
  Emp: { icon: '#15803d', bg: '#f0fdf4', border: '#16a34a', txt: '#14532d', dot: '#22c55e', label: 'Employee'        },
};

/* ── SVG person silhouette (head + shoulders) ── */
function Person({ x, y, w, h, fill }) {
  const cx  = x + w / 2;
  const hcy = y + h * 0.34;
  const hr  = h * 0.18;
  const by  = hcy + hr + 1;
  const bh  = h * 0.30;
  const bw  = w * 0.62;
  return (
    <g>
      <circle cx={cx} cy={hcy} r={hr} fill={fill} opacity={0.92} />
      <path
        d={`M ${cx - bw / 2} ${by + bh} Q ${cx - bw / 2} ${by} ${cx} ${by - 1} Q ${cx + bw / 2} ${by} ${cx + bw / 2} ${by + bh}`}
        fill={fill} opacity={0.88}
      />
    </g>
  );
}

/* ── One org-chart card ── */
function Card({ x, y, role, name, email, highlight, dim }) {
  const ispm = role === 'PM';
  const col  = ispm ? C.PM : role === 'TL' ? C.TL : C.Emp;
  const w    = ispm ? PW   : CW;
  const h    = ispm ? PH   : CH;
  const iw   = ispm ? PIW  : IW;

  return (
    <g opacity={dim ? 0.13 : 1}>
      {/* highlight ring */}
      {highlight && (
        <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={9}
          fill="none" stroke={col.dot} strokeWidth={2}
          style={{ filter: `drop-shadow(0 0 6px ${col.dot})` }}
        />
      )}
      {/* card background */}
      <rect x={x} y={y} width={w} height={h} rx={6}
        fill={col.bg} stroke={col.border} strokeWidth={1.2} />
      {/* icon section */}
      <rect x={x} y={y} width={iw} height={h} rx={6} fill={col.icon} />
      <rect x={x + iw - 6} y={y} width={6} height={h} fill={col.icon} />
      {/* person icon */}
      <Person x={x + 2} y={y + 4} w={iw - 4} h={h - 8} fill="rgba(255,255,255,0.92)" />
      {/* role label */}
      <text x={x + iw + 8} y={y + (ispm ? 18 : 16)}
        fontSize={ispm ? 8 : 7.5} fontWeight={700} fill={col.txt} opacity={0.75}
        style={{ fontFamily: 'Inter,system-ui,sans-serif', textTransform: 'uppercase', letterSpacing: '0.6px' }}
      >{col.label}</text>
      {/* name */}
      <text x={x + iw + 8} y={y + (ispm ? 34 : 30)}
        fontSize={ispm ? 11 : 10} fontWeight={700} fill={col.txt}
        style={{ fontFamily: 'Inter,system-ui,sans-serif' }}
      >{(name || '').length > 16 ? name.slice(0, 15) + '…' : name}</text>
      {/* email / second line */}
      {email && (
        <text x={x + iw + 8} y={y + (ispm ? 50 : 44)}
          fontSize={ispm ? 8.5 : 8} fill={col.txt} opacity={0.65}
          style={{ fontFamily: 'Inter,system-ui,sans-serif' }}
        >{email.length > 20 ? email.slice(0, 19) + '…' : email}</text>
      )}
    </g>
  );
}

/* ── Build flat list of positioned nodes + edges per PM section ── */
function buildSection(pm, sectionX, searchQuery) {
  const nodes = [];
  const edges = [];

  /* PM card */
  const pmCx = sectionX + PW / 2;
  const pmY  = TOP_PAD;
  nodes.push({ id: pm.id, role: 'PM', name: pm.name || pm.fullName, email: pm.email, x: sectionX, y: pmY });

  /* trunk x: center of PM card */
  const trunkX = pmCx;

  /* collect children in display order: TL then its Employees, then direct Emps */
  const rows = [];
  (pm.children || []).forEach(child => {
    if (child.type === 'TeamLead') {
      rows.push({ ...child, role: 'TL', indent: 0 });
      (child.children || []).forEach(emp => rows.push({ ...emp, role: 'Emp', indent: EMP_INDENT }));
    } else {
      rows.push({ ...child, role: 'Emp', indent: 0 });
    }
  });

  /* card left edge (right of trunk + branch) */
  const cardLeft = trunkX - CW / 2;

  let curY = pmY + PH + CHILD_TOP;
  const childTrunkPoints = []; // y centres for trunk

  rows.forEach(row => {
    const cx = cardLeft + row.indent;
    const cy = curY;
    nodes.push({ id: row.id, role: row.role, name: row.name || row.fullName, email: row.email, x: cx, y: cy });

    /* horizontal branch: from trunk to card left edge */
    const centerY = cy + CH / 2;
    childTrunkPoints.push(centerY);
    edges.push({ x1: trunkX, y1: centerY, x2: cx, y2: centerY, type: 'branch' });

    curY += CH + VGAP;
  });

  /* vertical trunk: from PM card bottom to last child center */
  if (childTrunkPoints.length > 0) {
    edges.push({
      x1: trunkX, y1: pmY + PH,
      x2: trunkX, y2: childTrunkPoints[childTrunkPoints.length - 1],
      type: 'trunk'
    });
  }

  /* section width = max right edge */
  const maxRight = nodes.reduce((m, n) => {
    const w = n.role === 'PM' ? PW : CW + n.indent;
    return Math.max(m, n.x + w);
  }, 0);
  const sectionW = maxRight - sectionX;
  const bottomY  = curY - VGAP;

  return { nodes, edges, sectionW, bottomY };
}

/* ── Main Component ── */
const OrgChartPage = () => {
  const { isDarkMode }                = useThemeStore();
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
        id: '__unassigned__', name: 'Unassigned', fullName: 'Unassigned', email: '', role: 'ProjectManager', type: 'PM',
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
  const q = searchQuery.toLowerCase();

  /* layout all sections */
  let cursorX = LEFT_PAD;
  const allNodes = [];
  const allEdges = [];

  hierarchy.forEach(pm => {
    const { nodes, edges, sectionW, bottomY } = buildSection(pm, cursorX, q);
    allNodes.push(...nodes);
    allEdges.push(...edges);
    cursorX += sectionW + COL_SEP;
  });

  const canvasW = cursorX - COL_SEP + LEFT_PAD;
  const canvasH = allNodes.reduce((m, n) => Math.max(m, n.y + (n.role === 'PM' ? PH : CH)), 0) + TOP_PAD + 20;

  const bg = isDarkMode ? '#0d1117' : '#f0f4f8';

  return (
    <div style={{
      position: 'fixed', top: 64, left: 240, right: 0, bottom: 0,
      overflow: 'hidden', background: bg,
      display: 'flex', flexDirection: 'column', userSelect: 'none'
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
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          {Object.entries(C).map(([key, col]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, background: col.icon, boxShadow: `0 0 6px ${col.dot}66` }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#475569' }}>{col.label}</span>
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

      {/* ── Chart ── */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {allNodes.length === 0
          ? <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Empty /></div>
          : (
          <svg width="100%" height="100%"
            viewBox={`0 0 ${canvasW} ${canvasH}`}
            preserveAspectRatio="xMidYMin meet"
            style={{ display: 'block' }}
          >
            <defs>
              <pattern id="dotg" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.7" fill={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'} />
              </pattern>
            </defs>
            <rect width={canvasW} height={canvasH} fill="url(#dotg)" />

            {/* Edges */}
            {allEdges.map((e, i) => (
              <line key={i}
                x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                stroke={isDarkMode ? '#334155' : '#93c5fd'}
                strokeWidth={e.type === 'trunk' ? 1.6 : 1.3}
                strokeDasharray={e.type === 'branch' ? '4 3' : 'none'}
                opacity={q ? 0.15 : 0.85}
              />
            ))}

            {/* Arrow heads on branches */}
            {allEdges.filter(e => e.type === 'branch').map((e, i) => {
              const ax = e.x2, ay = e.y2;
              return (
                <polygon key={`a${i}`}
                  points={`${ax},${ay} ${ax - 6},${ay - 4} ${ax - 6},${ay + 4}`}
                  fill={isDarkMode ? '#475569' : '#60a5fa'}
                  opacity={q ? 0.15 : 0.8}
                />
              );
            })}

            {/* Cards */}
            {allNodes.map(node => {
              const highlighted = q && (node.name || '').toLowerCase().includes(q);
              const dimmed      = !!q && !highlighted;
              return (
                <Card key={node.id}
                  x={node.x} y={node.y}
                  role={node.role}
                  name={node.name}
                  email={node.email}
                  highlight={highlighted}
                  dim={dimmed}
                />
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
};

export default OrgChartPage;
