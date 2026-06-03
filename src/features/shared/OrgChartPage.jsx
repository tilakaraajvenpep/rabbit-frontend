import React, { useState, useEffect } from 'react';
import { Card, Space, Typography, Tag, Input, Row, Col, Spin, Empty, Button, Avatar } from 'antd';
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
  
  // Selected hierarchy filters
  const [selectedPmId, setSelectedPmId] = useState(null);
  const [selectedTlId, setSelectedTlId] = useState(null);

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

  // Filter users by role
  const pms = users.filter(u => u.role === 'ProjectManager' || u.role === 'TenantAdmin');
  const tls = users.filter(u => u.role === 'TeamLead');
  const employees = users.filter(u => u.role === 'Employee');

  // Clear filters
  const handleClearFilters = () => {
    setSelectedPmId(null);
    setSelectedTlId(null);
    setSearchQuery('');
  };

  // Filtered TLs based on selected PM
  const filteredTls = tls.filter(tl => {
    if (selectedPmId) {
      return String(tl.projectManagerId) === String(selectedPmId);
    }
    return true;
  });

  // Filtered Employees based on selected PM and TL
  const filteredEmployees = employees.filter(emp => {
    // Filter by selected TL
    if (selectedTlId) {
      return String(emp.teamLeadId) === String(selectedTlId);
    }
    // Filter by selected PM if no TL is selected
    if (selectedPmId) {
      return String(emp.projectManagerId) === String(selectedPmId);
    }
    return true;
  });

  // Highlight matches
  const matchesSearch = (user) => {
    if (!searchQuery) return false;
    const q = searchQuery.toLowerCase();
    return (
      (user.name || '').toLowerCase().includes(q) ||
      (user.fullName || '').toLowerCase().includes(q) ||
      (user.email || '').toLowerCase().includes(q)
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

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader 
        title="Organization Chart"
        subtitle="Reporting hierarchy of the organization"
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
            placeholder="Search name, email..." 
            style={{ width: 220, borderRadius: 6 }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {(selectedPmId || selectedTlId || searchQuery) && (
            <Button 
              icon={<ClearOutlined />} 
              onClick={handleClearFilters}
              type="dashed"
              danger
            >
              Clear
            </Button>
          )}
        </Space>
      </div>

      {/* 3-Column Org View */}
      <div style={{ flex: 1, padding: 24, overflow: 'hidden' }}>
        <Row gutter={24} style={{ height: '100%' }}>
          {/* Column 1: Project Managers */}
          <Col xs={24} md={8} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ 
              padding: '12px 16px', 
              background: isDarkMode ? '#27272a' : '#f8fafc', 
              borderRadius: '8px 8px 0 0', 
              borderLeft: `4px solid ${pmColor}`,
              fontWeight: 700, 
              fontSize: '14px',
              color: isDarkMode ? '#f4f4f5' : '#1e293b',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              borderBottom: `1px solid ${isDarkMode ? '#3f3f46' : '#e4e4e7'}`
            }}>
              <span>Project Managers</span>
              <Tag color="indigo">{pms.length}</Tag>
            </div>
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: 12, 
              background: isDarkMode ? '#1e1e24' : '#fafafa', 
              borderRadius: '0 0 8px 8px', 
              border: isDarkMode ? '1px solid #2d2d30' : '1px solid #e4e4e7',
              borderTop: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}>
              {pms.length === 0 ? (
                <Empty description="No Project Managers found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                pms.map(pm => {
                  const isSelected = String(selectedPmId) === String(pm.id);
                  const highlighted = matchesSearch(pm);
                  return (
                    <div 
                      key={pm.id}
                      onClick={() => {
                        setSelectedPmId(isSelected ? null : pm.id);
                        setSelectedTlId(null); // Clear selected TL filter
                      }}
                      style={{ 
                        padding: '12px 14px', 
                        background: isSelected 
                          ? (isDarkMode ? 'rgba(79, 70, 229, 0.2)' : 'rgba(79, 70, 229, 0.08)')
                          : (isDarkMode ? '#27272a' : '#ffffff'),
                        border: isSelected 
                          ? `2px solid ${pmColor}` 
                          : (highlighted ? `2px solid ${pmColor}` : `1px solid ${isDarkMode ? '#3f3f46' : '#e4e4e7'}`),
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        boxShadow: highlighted ? '0 0 8px rgba(79,70,229,0.3)' : 'none'
                      }}
                    >
                      <Avatar 
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${pm.email}`} 
                        icon={<UserOutlined />} 
                        style={{ border: `2px solid ${pmColor}`, flexShrink: 0 }}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Text strong style={{ display: 'block', fontSize: '13px', color: isDarkMode ? '#f4f4f5' : '#1e293b' }}>
                          {pm.name || pm.fullName}
                        </Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pm.email}
                        </Text>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Col>

          {/* Column 2: Team Leaders */}
          <Col xs={24} md={8} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ 
              padding: '12px 16px', 
              background: isDarkMode ? '#27272a' : '#f8fafc', 
              borderRadius: '8px 8px 0 0', 
              borderLeft: `4px solid ${tlColor}`,
              fontWeight: 700, 
              fontSize: '14px',
              color: isDarkMode ? '#f4f4f5' : '#1e293b',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              borderBottom: `1px solid ${isDarkMode ? '#3f3f46' : '#e4e4e7'}`
            }}>
              <span>Team Leaders {selectedPmId && <span style={{ fontSize: '11px', fontWeight: 500, color: pmColor }}>(Filtered)</span>}</span>
              <Tag color="pink">{filteredTls.length}</Tag>
            </div>
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: 12, 
              background: isDarkMode ? '#1e1e24' : '#fafafa', 
              borderRadius: '0 0 8px 8px', 
              border: isDarkMode ? '1px solid #2d2d30' : '1px solid #e4e4e7',
              borderTop: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}>
              {filteredTls.length === 0 ? (
                <Empty description="No Team Leaders found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                filteredTls.map(tl => {
                  const isSelected = String(selectedTlId) === String(tl.id);
                  const highlighted = matchesSearch(tl);
                  // Find PM name for this TL
                  const parentPm = pms.find(p => String(p.id) === String(tl.projectManagerId));
                  return (
                    <div 
                      key={tl.id}
                      onClick={() => {
                        setSelectedTlId(isSelected ? null : tl.id);
                      }}
                      style={{ 
                        padding: '12px 14px', 
                        background: isSelected 
                          ? (isDarkMode ? 'rgba(219, 39, 119, 0.2)' : 'rgba(219, 39, 119, 0.08)')
                          : (isDarkMode ? '#27272a' : '#ffffff'),
                        border: isSelected 
                          ? `2px solid ${tlColor}` 
                          : (highlighted ? `2px solid ${tlColor}` : `1px solid ${isDarkMode ? '#3f3f46' : '#e4e4e7'}`),
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        boxShadow: highlighted ? '0 0 8px rgba(219,39,119,0.3)' : 'none'
                      }}
                    >
                      <Avatar 
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${tl.email}`} 
                        icon={<UserOutlined />} 
                        style={{ border: `2px solid ${tlColor}`, flexShrink: 0 }}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Text strong style={{ display: 'block', fontSize: '13px', color: isDarkMode ? '#f4f4f5' : '#1e293b' }}>
                          {tl.name || tl.fullName}
                        </Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tl.email}
                        </Text>
                        {parentPm && (
                          <Text type="secondary" style={{ display: 'block', fontSize: '10px', color: pmColor, marginTop: 4 }}>
                            Reports to: {parentPm.name || parentPm.fullName}
                          </Text>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Col>

          {/* Column 3: Employees */}
          <Col xs={24} md={8} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ 
              padding: '12px 16px', 
              background: isDarkMode ? '#27272a' : '#f8fafc', 
              borderRadius: '8px 8px 0 0', 
              borderLeft: `4px solid ${empColor}`,
              fontWeight: 700, 
              fontSize: '14px',
              color: isDarkMode ? '#f4f4f5' : '#1e293b',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              borderBottom: `1px solid ${isDarkMode ? '#3f3f46' : '#e4e4e7'}`
            }}>
              <span>Employees {(selectedPmId || selectedTlId) && <span style={{ fontSize: '11px', fontWeight: 500, color: empColor }}>(Filtered)</span>}</span>
              <Tag color="success">{filteredEmployees.length}</Tag>
            </div>
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: 12, 
              background: isDarkMode ? '#1e1e24' : '#fafafa', 
              borderRadius: '0 0 8px 8px', 
              border: isDarkMode ? '1px solid #2d2d30' : '1px solid #e4e4e7',
              borderTop: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}>
              {filteredEmployees.length === 0 ? (
                <Empty description="No Employees found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                filteredEmployees.map(emp => {
                  const highlighted = matchesSearch(emp);
                  // Find reporting lines
                  const parentTl = tls.find(t => String(t.id) === String(emp.teamLeadId));
                  const parentPm = pms.find(p => String(p.id) === String(emp.projectManagerId));
                  return (
                    <div 
                      key={emp.id}
                      style={{ 
                        padding: '12px 14px', 
                        background: isDarkMode ? '#27272a' : '#ffffff',
                        border: highlighted ? `2px solid ${empColor}` : `1px solid ${isDarkMode ? '#3f3f46' : '#e4e4e7'}`,
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        boxShadow: highlighted ? '0 0 8px rgba(16,185,129,0.3)' : 'none'
                      }}
                    >
                      <Avatar 
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${emp.email}`} 
                        icon={<UserOutlined />} 
                        style={{ border: `2px solid ${empColor}`, flexShrink: 0 }}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Text strong style={{ display: 'block', fontSize: '13px', color: isDarkMode ? '#f4f4f5' : '#1e293b' }}>
                          {emp.name || emp.fullName}
                        </Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {emp.email}
                        </Text>
                        {(parentTl || parentPm) && (
                          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {parentTl && (
                              <Text type="secondary" style={{ display: 'block', fontSize: '10px', color: tlColor }}>
                                TL: {parentTl.name || parentTl.fullName}
                              </Text>
                            )}
                            {parentPm && (
                              <Text type="secondary" style={{ display: 'block', fontSize: '10px', color: pmColor }}>
                                PM: {parentPm.name || parentPm.fullName}
                              </Text>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default OrgChartPage;
