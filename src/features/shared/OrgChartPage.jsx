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

  // Build the hierarchical tree data structure
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

  // Highlight matching nodes
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

  const pmColor = '#4f46e5';
  const tlColor = '#db2777';
  const empColor = '#10b981';

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}><Text type="secondary">Building Organization Chart…</Text></div>
      </div>
    );
  }

  const hierarchy = buildHierarchy();

  const renderCard = (node, borderCol) => {
    const highlighted = matchesSearch(node);
    const isPM = node.type === 'PM' || node.role === 'ProjectManager' || node.role === 'TenantAdmin';
    const isTL = node.type === 'TeamLead' || node.role === 'TeamLead';
    const displayRole = isPM ? 'Project Manager' : isTL ? 'Team Lead' : 'Employee';

    return (
      <Card
        size="small"
        style={{
          width: 250,
          borderRadius: 8,
          border: highlighted ? `2px solid ${borderCol}` : `1px solid ${isDarkMode ? '#2d2d30' : '#e4e4e7'}`,
          borderLeft: `4px solid ${borderCol}`,
          background: isDarkMode ? '#1e1e24' : '#ffffff',
          boxShadow: highlighted 
            ? `0 0 12px ${borderCol}40` 
            : (isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.03)'),
          transition: 'all 0.2s ease',
          flexShrink: 0,
          zIndex: 5
        }}
        bodyStyle={{ padding: 10 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar 
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${node.email}`} 
            icon={<UserOutlined />} 
            size={28}
            style={{ border: `1.5px solid ${borderCol}`, flexShrink: 0 }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <Text strong style={{ display: 'block', fontSize: '13px', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isDarkMode ? '#f4f4f5' : '#1e293b' }}>
              {node.name || node.fullName}
            </Text>
            <Text type="secondary" style={{ display: 'block', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.email}
            </Text>
            <Text style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: borderCol, marginTop: 4 }}>
              {displayRole}
            </Text>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader 
        title="Organization Chart"
        subtitle="Reporting relationships shown with active connection lines"
      />

      {/* Colors Legend & Controls */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: 16, 
        padding: '12px 24px',
        background: isDarkMode ? '#1c1c1f' : '#ffffff',
        borderBottom: isDarkMode ? '1px solid #2d2d30' : '1px solid #e4e4e7',
      }}>
        {/* Color legend */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: pmColor }} />
            <Text strong style={{ fontSize: '13px', color: isDarkMode ? '#cbd5e1' : '#475569' }}>Project Manager (PM)</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: tlColor }} />
            <Text strong style={{ fontSize: '13px', color: isDarkMode ? '#cbd5e1' : '#475569' }}>Team Leader (TL)</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: empColor }} />
            <Text strong style={{ fontSize: '13px', color: isDarkMode ? '#cbd5e1' : '#475569' }}>Employee</Text>
          </div>
        </div>

        {/* Search & Reset */}
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

      {/* Horizontal Cascade Hierarchical View */}
      <div style={{ flex: 1, padding: 24, overflowY: 'auto', overflowX: 'auto', background: isDarkMode ? '#131316' : '#f9fafb' }}>
        {hierarchy.length === 0 ? (
          <Empty description="No users found" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40, minWidth: 900 }}>
            {hierarchy.map(pmNode => (
              <div 
                key={pmNode.id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'stretch', 
                  gap: 48, 
                  position: 'relative',
                  background: isDarkMode ? '#1c1c21' : '#ffffff',
                  border: `1px solid ${isDarkMode ? '#2d2d35' : '#e4e4e7'}`,
                  borderRadius: 16,
                  padding: 24,
                  boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.02)'
                }}
              >
                {/* PM Card Container */}
                <div style={{ display: 'flex', alignItems: 'center', zIndex: 10 }}>
                  {renderCard(pmNode, pmColor)}
                </div>

                {/* Team Leaders and Employees Cascade */}
                {pmNode.children && pmNode.children.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24, position: 'relative' }}>
                    {/* PM to TL Vertical Connection Line */}
                    {pmNode.children.length > 1 && (
                      <div style={{
                        position: 'absolute',
                        left: -24,
                        top: 'calc(10% + 20px)',
                        bottom: 'calc(10% + 20px)',
                        width: 2,
                        background: isDarkMode ? '#3f3f46' : '#cbd5e1',
                        zIndex: 1
                      }} />
                    )}

                    {pmNode.children.map((tlNode) => {
                      const isTL = tlNode.type === 'TeamLead';
                      const childrenList = tlNode.children || [];
                      
                      return (
                        <div key={tlNode.id} style={{ display: 'flex', alignItems: 'stretch', gap: 48, position: 'relative' }}>
                          {/* Horizontal Connector Line from PM main branch to TL */}
                          <div style={{
                            position: 'absolute',
                            left: -24,
                            top: '50%',
                            width: 24,
                            height: 2,
                            background: isDarkMode ? '#3f3f46' : '#cbd5e1',
                            zIndex: 1
                          }} />

                          {/* TL (or direct Employee) Card */}
                          <div style={{ display: 'flex', alignItems: 'center', zIndex: 10 }}>
                            {renderCard(tlNode, isTL ? tlColor : empColor)}
                          </div>

                          {/* Employees under TL Cascade */}
                          {isTL && childrenList.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12, position: 'relative' }}>
                              {/* TL to Employee Vertical Connection Line */}
                              {childrenList.length > 1 && (
                                <div style={{
                                  position: 'absolute',
                                  left: -24,
                                  top: 'calc(15% + 15px)',
                                  bottom: 'calc(15% + 15px)',
                                  width: 2,
                                  background: isDarkMode ? '#3f3f46' : '#cbd5e1',
                                  zIndex: 1
                                }} />
                              )}

                              {childrenList.map((empNode) => (
                                <div key={empNode.id} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                  {/* Horizontal Connector Line from TL branch to Employee */}
                                  <div style={{
                                    position: 'absolute',
                                    left: -24,
                                    top: '50%',
                                    width: 24,
                                    height: 2,
                                    background: isDarkMode ? '#3f3f46' : '#cbd5e1',
                                    zIndex: 1
                                  }} />

                                  <div style={{ zIndex: 10 }}>
                                    {renderCard(empNode, empColor)}
                                  </div>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrgChartPage;
