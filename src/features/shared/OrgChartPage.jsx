import React, { useState, useEffect } from 'react';
import { Card, Space, Typography, Tag, Input, Spin, Empty, Button, Avatar } from 'antd';
import { 
  SearchOutlined, 
  UserOutlined,
  ClearOutlined
} from '@ant-design/icons';
import { adminService } from '../../services/adminService';
import { useThemeStore } from '../../store/themeStore';
import PageHeader from '../../components/common/PageHeader';

const { Text } = Typography;

const OrgChartPage = () => {
  const { isDarkMode } = useThemeStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredCardId, setHoveredCardId] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await adminService.getUsers();
      setUsers(res.data || []);
    } catch (err) {
      console.error('Failed to load users for org chart:', err);
    } finally {
      setLoading(false);
    }
  };

  const buildHierarchy = () => {
    const pms = users.filter(u => u.role === 'ProjectManager' || u.role === 'TenantAdmin');
    const tls = users.filter(u => u.role === 'TeamLead');
    const employees = users.filter(u => u.role === 'Employee');

    const hierarchy = pms.map(pm => {
      const pmTls = tls.filter(tl => String(tl.projectManagerId) === String(pm.id));
      const directEmployees = employees.filter(emp => 
        String(emp.projectManagerId) === String(pm.id) && !emp.teamLeadId
      );

      const tlNodes = pmTls.map(tl => {
        const tlEmployees = employees.filter(emp => String(emp.teamLeadId) === String(tl.id));
        return {
          ...tl,
          children: tlEmployees,
          type: 'TeamLead'
        };
      });

      return {
        ...pm,
        children: [
          ...tlNodes,
          ...directEmployees.map(emp => ({ ...emp, children: [], type: 'Employee' }))
        ],
        type: 'PM'
      };
    });

    const unassignedTls = tls.filter(tl => !tl.projectManagerId);
    const unassignedEmployees = employees.filter(emp => !emp.teamLeadId && !emp.projectManagerId);

    const fallbackPM = {
      id: 'unassigned-pm',
      name: 'Independent & General Support',
      fullName: 'Independent & General Support',
      email: 'Platform unassigned members',
      role: 'General Group',
      type: 'PM',
      children: [
        ...unassignedTls.map(tl => {
          const tlEmployees = employees.filter(emp => String(emp.teamLeadId) === String(tl.id));
          return {
            ...tl,
            children: tlEmployees,
            type: 'TeamLead'
          };
        }),
        ...unassignedEmployees.map(emp => ({ ...emp, children: [], type: 'Employee' }))
      ]
    };

    if (fallbackPM.children.length > 0) {
      hierarchy.push(fallbackPM);
    }

    return hierarchy;
  };

  const matchesSearch = (user) => {
    if (!searchQuery) return false;
    const q = searchQuery.toLowerCase();
    return (
      (user.name || '').toLowerCase().includes(q) ||
      (user.fullName || '').toLowerCase().includes(q) ||
      (user.email || '').toLowerCase().includes(q) ||
      (user.role || '').toLowerCase().includes(q)
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}><Text type="secondary">Building Organization Chart…</Text></div>
      </div>
    );
  }

  const hierarchy = buildHierarchy();

  const renderPmCard = (node) => {
    const isHovered = hoveredCardId === node.id;
    const highlighted = matchesSearch(node);
    const hasSearch = searchQuery.length > 0;
    const isCPO = node.id === 'unassigned-pm' || node.role === 'TenantAdmin';

    return (
      <div
        onMouseEnter={() => setHoveredCardId(node.id)}
        onMouseLeave={() => setHoveredCardId(null)}
        style={{
          width: 200,
          height: 64,
          background: '#1d2d3a', // Dark slate blue from image template
          borderRadius: 6,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '8px 16px',
          color: '#ffffff',
          border: highlighted ? '2px solid #3b82f6' : '1px solid #14202a',
          boxShadow: isHovered ? '0 8px 16px rgba(0,0,0,0.3)' : '0 4px 10px rgba(0,0,0,0.15)',
          transform: isHovered ? 'translateY(-2px)' : 'none',
          transition: 'all 0.2s ease',
          opacity: hasSearch && !highlighted ? 0.35 : 1,
          cursor: 'pointer',
          textAlign: 'center',
          zIndex: 10
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', opacity: 0.8, textTransform: 'uppercase', marginBottom: 2 }}>
          {isCPO ? 'CPO' : 'Project Manager'}
        </div>
        <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
          {node.name || node.fullName}
        </div>
      </div>
    );
  };

  const renderSubCard = (node) => {
    const isHovered = hoveredCardId === node.id;
    const highlighted = matchesSearch(node);
    const hasSearch = searchQuery.length > 0;
    const isTL = node.type === 'TeamLead' || node.role === 'TeamLead';
    const roleName = isTL ? 'Team Leader' : 'Employee';

    return (
      <div
        onMouseEnter={() => setHoveredCardId(node.id)}
        onMouseLeave={() => setHoveredCardId(null)}
        style={{
          width: 180,
          height: 56,
          background: '#8fa2b4', // Soft blue-grey branch card from image template
          borderRadius: 6,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '6px 12px',
          color: '#1d2d3a', // Dark blue slate text color
          border: highlighted ? '2px solid #3b82f6' : '1.5px solid #778b9d',
          boxShadow: isHovered ? '0 8px 16px rgba(0,0,0,0.15)' : '0 2px 4px rgba(0,0,0,0.05)',
          transform: isHovered ? 'translateY(-2px)' : 'none',
          transition: 'all 0.2s ease',
          opacity: hasSearch && !highlighted ? 0.35 : 1,
          textAlign: 'center',
          zIndex: 10
        }}
      >
        <div style={{ fontSize: '10px', fontWeight: 700, opacity: 0.8, marginBottom: 2 }}>
          {roleName}
        </div>
        <div style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
          {node.name || node.fullName}
        </div>
      </div>
    );
  };

  const renderPmTree = (pmNode) => {
    const children = pmNode.children || [];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
        {/* Top PM Card */}
        {renderPmCard(pmNode)}

        {/* Children Cascade stack */}
        {children.length > 0 && (
          <div style={{ 
            position: 'relative', 
            marginTop: 40, // Space below PM card
            display: 'flex', 
            flexDirection: 'column', 
            gap: 20,
            paddingLeft: 30 // Indentation for lines
          }}>
            {/* Vertical trunk line */}
            <div style={{
              position: 'absolute',
              left: 10,
              top: -40,
              bottom: '28px', // Midpoint of last child
              width: 2,
              background: '#5c7080',
              zIndex: 1
            }} />

            {children.map((childNode, childIdx) => {
              const isTL = childNode.type === 'TeamLead';
              const subChildren = childNode.children || [];

              return (
                <div key={childNode.id} style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', position: 'relative' }}>
                  
                  {/* Horizontal branch line to child */}
                  <div style={{
                    position: 'absolute',
                    left: -20,
                    top: '28px',
                    width: 20,
                    height: 2,
                    background: '#5c7080',
                    zIndex: 1
                  }} />

                  {/* Render child card */}
                  {renderSubCard(childNode)}

                  {/* Sub-children under Team Lead */}
                  {isTL && subChildren.length > 0 && (
                    <div style={{ 
                      position: 'relative', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: 16,
                      paddingLeft: 30,
                      marginLeft: 20
                    }}>
                      {/* Vertical line under Team Lead */}
                      <div style={{
                        position: 'absolute',
                        left: 10,
                        top: '28px',
                        bottom: '28px',
                        width: 2,
                        background: '#5c7080',
                        zIndex: 1
                      }} />

                      {subChildren.map((empNode) => (
                        <div key={empNode.id} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          {/* Horizontal line from TL to Employee */}
                          <div style={{
                            position: 'absolute',
                            left: -20,
                            top: '28px',
                            width: 20,
                            height: 2,
                            background: '#5c7080',
                            zIndex: 1
                          }} />

                          {renderSubCard(empNode)}
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader 
        title="Organization Chart"
        subtitle="Reporting relationships structured top-down from Project Managers"
      />

      {/* Control panel & search */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: 16, 
        padding: '12px 24px',
        background: isDarkMode ? '#18181b' : '#ffffff',
        borderBottom: isDarkMode ? '1px solid #2d2d30' : '1px solid #e4e4e7',
      }}>
        {/* Colors Legend */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: '#1d2d3a' }} />
            <Text strong style={{ fontSize: '13px', color: isDarkMode ? '#cbd5e1' : '#475569' }}>Project Manager (PM / CPO)</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: '#8fa2b4' }} />
            <Text strong style={{ fontSize: '13px', color: isDarkMode ? '#cbd5e1' : '#475569' }}>Team Leader & Employee</Text>
          </div>
        </div>

        {/* Search */}
        <Space>
          <Input 
            prefix={<SearchOutlined style={{ color: '#8b5cf6' }} />} 
            placeholder="Search name, email, role..." 
            style={{ width: 220, borderRadius: 6 }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <Button 
              icon={<ClearOutlined />} 
              onClick={() => setSearchQuery('')}
              type="dashed"
              danger
            >
              Clear
            </Button>
          )}
        </Space>
      </div>

      {/* Main chart viewport with custom background matching the template image */}
      <div style={{ 
        flex: 1, 
        padding: '40px 24px', 
        overflowY: 'hidden', 
        overflowX: 'auto', 
        background: isDarkMode ? '#090d16' : '#d0d8e2', // Grey-blue tint background from template
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        scrollbarWidth: 'thin'
      }}>
        {hierarchy.length === 0 ? (
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <Empty description="No organization details found." />
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 64, paddingBottom: 24, margin: '0 auto' }}>
            {hierarchy.map(pmNode => (
              <div key={pmNode.id}>
                {renderPmTree(pmNode)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrgChartPage;
