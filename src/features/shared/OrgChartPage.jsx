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
  const [selectedPmId, setSelectedPmId] = useState(null);
  const [hoveredCardId, setHoveredCardId] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await adminService.getUsers();
      const loadedUsers = res.data || [];
      setUsers(loadedUsers);

      const pmsList = loadedUsers.filter(u => u.role === 'ProjectManager' || u.role === 'TenantAdmin');
      if (pmsList.length > 0) {
        setSelectedPmId(pmsList[0].id);
      }
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

  const pmColor = '#6366f1'; // Premium Indigo
  const tlColor = '#ec4899'; // Premium Pink
  const empColor = '#10b981'; // Premium Emerald

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}><Text type="secondary">Building Organization Chart…</Text></div>
      </div>
    );
  }

  const hierarchy = buildHierarchy();
  const activePmNode = hierarchy.find(p => String(p.id) === String(selectedPmId));

  const renderCard = (node, borderCol) => {
    const isHovered = hoveredCardId === node.id;
    const highlighted = matchesSearch(node);
    const hasSearch = searchQuery.length > 0;
    const isPM = node.type === 'PM' || node.role === 'ProjectManager' || node.role === 'TenantAdmin';
    const isTL = node.type === 'TeamLead' || node.role === 'TeamLead';
    const displayRole = isPM ? 'Project Manager' : isTL ? 'Team Lead' : 'Employee';

    return (
      <Card
        size="small"
        onMouseEnter={() => setHoveredCardId(node.id)}
        onMouseLeave={() => setHoveredCardId(null)}
        style={{
          width: 250,
          borderRadius: 12,
          border: highlighted 
            ? `2px solid ${borderCol}` 
            : `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
          borderLeft: `5px solid ${borderCol}`,
          background: isDarkMode ? 'rgba(30, 30, 36, 0.75)' : 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(10px)',
          boxShadow: isHovered 
            ? `0 12px 24px ${borderCol}25` 
            : (isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.03)'),
          transform: isHovered ? 'translateY(-2px)' : 'none',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: hasSearch && !highlighted ? 0.35 : 1,
          flexShrink: 0,
          zIndex: 5
        }}
        bodyStyle={{ padding: 12 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar 
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${node.email}`} 
            icon={<UserOutlined />} 
            size={36}
            style={{ border: `2px solid ${borderCol}`, flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <Text strong style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isDarkMode ? '#f4f4f5' : '#1e293b' }}>
              {node.name || node.fullName}
            </Text>
            <Text type="secondary" style={{ display: 'block', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
              {node.email}
            </Text>
            <Tag color={isPM ? 'indigo' : isTL ? 'pink' : 'success'} style={{ fontSize: '9px', fontWeight: 700, borderRadius: 4, margin: 0, textTransform: 'uppercase' }}>
              {displayRole}
            </Tag>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader 
        title="Organization Chart"
        subtitle="Visual reporting paths and team alignments"
      />

      {/* Colors Legend & Controls */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: 16, 
        padding: '16px 24px',
        background: isDarkMode ? '#18181b' : '#ffffff',
        borderBottom: isDarkMode ? '1px solid #2d2d30' : '1px solid #e4e4e7',
      }}>
        {/* PM Tabs/Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text strong style={{ color: isDarkMode ? '#cbd5e1' : '#475569', fontSize: '13px' }}>Project Manager:</Text>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', maxWidth: 400, paddingBottom: 4 }}>
            {hierarchy.map(pm => {
              const isSelected = String(pm.id) === String(selectedPmId);
              return (
                <div
                  key={pm.id}
                  onClick={() => setSelectedPmId(pm.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 20,
                    background: isSelected ? pmColor : (isDarkMode ? '#27272a' : '#f1f5f9'),
                    color: isSelected ? '#ffffff' : (isDarkMode ? '#cbd5e1' : '#475569'),
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '12px',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? `0 4px 10px ${pmColor}30` : 'none',
                    border: isSelected ? 'none' : `1px solid ${isDarkMode ? '#3f3f46' : '#e2e8f0'}`,
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Avatar size="small" src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${pm.email}`} style={{ width: 18, height: 18 }} />
                  <span>{pm.name || pm.fullName}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Color legend */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: pmColor }} />
            <Text strong style={{ fontSize: '12.5px', color: isDarkMode ? '#cbd5e1' : '#475569' }}>PM</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: tlColor }} />
            <Text strong style={{ fontSize: '12.5px', color: isDarkMode ? '#cbd5e1' : '#475569' }}>TL</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: empColor }} />
            <Text strong style={{ fontSize: '12.5px', color: isDarkMode ? '#cbd5e1' : '#475569' }}>Employee</Text>
          </div>
        </div>

        {/* Search & Reset */}
        <Space>
          <Input 
            prefix={<SearchOutlined style={{ color: '#8b5cf6' }} />} 
            placeholder="Search name, email..." 
            style={{ width: 180, borderRadius: 6 }}
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

      {/* Horizontal Cascade Hierarchical View */}
      <div style={{ 
        flex: 1, 
        padding: 40, 
        overflow: 'hidden', 
        background: isDarkMode ? '#09090b' : '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {!activePmNode ? (
          <Empty description="Select a Project Manager to display reporting lines" />
        ) : (
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'stretch', 
              gap: 48, 
              position: 'relative',
              background: isDarkMode ? '#18181b' : '#ffffff',
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
              borderRadius: 20,
              padding: '40px 48px',
              boxShadow: isDarkMode ? '0 10px 40px rgba(0,0,0,0.5)' : '0 10px 40px rgba(0,0,0,0.02)',
              maxWidth: '100%',
              maxHeight: '100%',
              overflow: 'auto',
              scrollbarWidth: 'thin'
            }}
          >
            {/* PM Card Container */}
            <div style={{ display: 'flex', alignItems: 'center', zIndex: 10, position: 'relative' }}>
              {renderCard(activePmNode, pmColor)}
              
              {/* Horizontal line exiting PM card to vertical junction */}
              {activePmNode.children && activePmNode.children.length > 0 && (
                <div style={{
                  position: 'absolute',
                  right: -48,
                  top: '50%',
                  width: 48,
                  height: 2,
                  background: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'
                }} />
              )}
            </div>

            {/* Team Leaders and Employees Cascade */}
            {activePmNode.children && activePmNode.children.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24, position: 'relative' }}>
                
                {/* PM-to-TL vertical connector line */}
                {activePmNode.children.length > 1 && (
                  <div style={{
                    position: 'absolute',
                    left: -24,
                    top: '12%',
                    bottom: '12%',
                    width: 2,
                    background: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                    zIndex: 1
                  }} />
                )}

                {activePmNode.children.map((tlNode, tlIdx) => {
                  const isTL = tlNode.type === 'TeamLead';
                  const childrenList = tlNode.children || [];
                  const totalTls = activePmNode.children.length;
                  
                  return (
                    <div key={tlNode.id} style={{ display: 'flex', alignItems: 'stretch', gap: 48, position: 'relative' }}>
                      
                      {/* Vertical line segment connecting this sibling */}
                      {totalTls > 1 && (
                        <div style={{
                          position: 'absolute',
                          left: -24,
                          top: tlIdx === 0 ? '50%' : 0,
                          bottom: tlIdx === totalTls - 1 ? '50%' : 0,
                          width: 2,
                          background: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                          zIndex: 1
                        }} />
                      )}

                      {/* Horizontal Connector line to this TL/Employee card */}
                      <div style={{
                        position: 'absolute',
                        left: -24,
                        top: '50%',
                        width: 24,
                        height: 2,
                        background: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                        zIndex: 1
                      }} />

                      {/* TL (or direct Employee) Card */}
                      <div style={{ display: 'flex', alignItems: 'center', zIndex: 10, position: 'relative' }}>
                        {renderCard(tlNode, isTL ? tlColor : empColor)}

                        {/* Horizontal line exiting TL card to its children */}
                        {isTL && childrenList.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            right: -48,
                            top: '50%',
                            width: 48,
                            height: 2,
                            background: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'
                          }} />
                        )}
                      </div>

                      {/* Employees under TL Cascade */}
                      {isTL && childrenList.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12, position: 'relative' }}>
                          
                          {/* TL-to-Employee vertical connector line */}
                          {childrenList.length > 1 && (
                            <div style={{
                              position: 'absolute',
                              left: -24,
                              top: '15%',
                              bottom: '15%',
                              width: 2,
                              background: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                              zIndex: 1
                            }} />
                          )}

                          {childrenList.map((empNode, empIdx) => {
                            const totalEmps = childrenList.length;
                            return (
                              <div key={empNode.id} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                
                                {/* Vertical line segment connecting this employee sibling */}
                                {totalEmps > 1 && (
                                  <div style={{
                                    position: 'absolute',
                                    left: -24,
                                    top: empIdx === 0 ? '50%' : 0,
                                    bottom: empIdx === totalEmps - 1 ? '50%' : 0,
                                    width: 2,
                                    background: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                                    zIndex: 1
                                  }} />
                                )}

                                {/* Horizontal Connector Line from TL branch to Employee */}
                                <div style={{
                                  position: 'absolute',
                                  left: -24,
                                  top: '50%',
                                  width: 24,
                                  height: 2,
                                  background: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                                  zIndex: 1
                                }} />

                                <div style={{ zIndex: 10 }}>
                                  {renderCard(empNode, empColor)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrgChartPage;
