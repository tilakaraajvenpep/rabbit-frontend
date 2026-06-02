import React, { useState, useEffect } from 'react';
import { Card, Space, Typography, Tag, Input, Row, Col, Spin, Empty, Button, Tooltip, Avatar, Segmented } from 'antd';
import { 
  SearchOutlined, 
  NodeIndexOutlined, 
  TeamOutlined, 
  UserOutlined, 
  ArrowDownOutlined, 
  ArrowRightOutlined,
  PlusOutlined,
  MinusOutlined,
  ExpandOutlined,
  CompressOutlined
} from '@ant-design/icons';
import { adminService } from '../../services/adminService';
import { useThemeStore } from '../../store/themeStore';
import PageHeader from '../../components/common/PageHeader';

const { Text, Title } = Typography;

const OrgChartPage = () => {
  const { isDarkMode } = useThemeStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('tree'); // 'tree' or 'list'
  
  // Collapse/Expand state for nodes
  const [collapsedNodes, setCollapsedNodes] = useState({});

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

  // Helper to get initials
  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  // Build the hierarchical tree data structure
  const buildHierarchy = () => {
    // 1. Identify all PMs (Project Manager, TenantAdmin)
    const pms = users.filter(u => u.role === 'ProjectManager' || u.role === 'TenantAdmin');
    
    // 2. Identify Team Leads
    const tls = users.filter(u => u.role === 'TeamLead');
    
    // 3. Identify Employees
    const employees = users.filter(u => u.role === 'Employee');

    // PMs with their tree
    const hierarchy = pms.map(pm => {
      // Find TLs reporting to this PM
      const pmTls = tls.filter(tl => String(tl.projectManagerId) === String(pm.id));
      
      // Find Employees reporting directly to this PM (without a TL)
      const directEmployees = employees.filter(emp => 
        String(emp.projectManagerId) === String(pm.id) && !emp.teamLeadId
      );

      const tlNodes = pmTls.map(tl => {
        // Find Employees reporting to this TL
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

    // Handle "Unassigned / General" categories to ensure NO users are omitted from the chart
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

  const toggleNode = (nodeId) => {
    setCollapsedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const handleExpandAll = () => {
    setCollapsedNodes({});
  };

  const handleCollapseAll = () => {
    const collapsed = {};
    users.forEach(u => {
      collapsed[u.id] = true;
    });
    setCollapsedNodes(collapsed);
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

  // Stats
  const pmCount = users.filter(u => u.role === 'ProjectManager' || u.role === 'TenantAdmin').length;
  const tlCount = users.filter(u => u.role === 'TeamLead').length;
  const empCount = users.filter(u => u.role === 'Employee').length;

  // Filtered nodes logic (if searching)
  const isHighlighted = (node) => {
    if (!searchQuery) return false;
    const query = searchQuery.toLowerCase();
    return (
      (node.name || '').toLowerCase().includes(query) ||
      (node.fullName || '').toLowerCase().includes(query) ||
      (node.email || '').toLowerCase().includes(query) ||
      (node.role || '').toLowerCase().includes(query)
    );
  };

  // Node Card renderer
  const renderNodeCard = (node, level) => {
    const isPM = node.type === 'PM' || node.role === 'ProjectManager' || node.role === 'TenantAdmin';
    const isTL = node.type === 'TeamLead' || node.role === 'TeamLead';
    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = collapsedNodes[node.id];
    const highlighted = isHighlighted(node);

    let gradient = 'linear-gradient(135deg, #a78bfa, #8b5cf6)'; // default Purple
    let roleTag = 'Employee';
    let tagColor = 'blue';

    if (isPM) {
      gradient = 'linear-gradient(135deg, #6366f1, #4f46e5)'; // Indigo
      roleTag = node.id === 'unassigned-pm' ? 'Platform Unassigned' : 'Project Manager';
      tagColor = 'indigo';
    } else if (isTL) {
      gradient = 'linear-gradient(135deg, #ec4899, #d946ef)'; // Pink/Magenta
      roleTag = 'Team Lead';
      tagColor = 'pink';
    }

    return (
      <Card
        size="small"
        style={{
          width: 280,
          borderRadius: 12,
          boxShadow: highlighted 
            ? '0 0 0 3px #8b5cf6, 0 8px 24px rgba(139, 92, 246, 0.2)' 
            : (isDarkMode ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.05)'),
          border: highlighted 
            ? '1px solid #8b5cf6' 
            : (isDarkMode ? '1px solid #3f3f46' : '1px solid #e8e8e8'),
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          background: isDarkMode ? '#1f1f23' : '#ffffff',
          position: 'relative'
        }}
        bodyStyle={{ padding: 12 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: gradient,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 14,
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
            flexShrink: 0
          }}>
            {getInitials(node.name || node.fullName)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Text strong style={{ display: 'block', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {node.name || node.fullName}
            </Text>
            <Text type="secondary" style={{ display: 'block', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>
              {node.email}
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Tag color={tagColor} style={{ fontSize: '10px', fontWeight: 600, margin: 0, padding: '0 6px', borderRadius: 4 }}>
                {roleTag}
              </Tag>
              {hasChildren && (
                <Button
                  type="text"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNode(node.id);
                  }}
                  icon={isCollapsed ? <PlusOutlined /> : <MinusOutlined />}
                  style={{
                    height: 20,
                    width: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    borderRadius: '50%',
                    background: isDarkMode ? '#2d2d30' : '#f3f4f6',
                    color: '#8b5cf6'
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  // Visual Tree Builder Renderer
  const renderTree = (nodes) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center' }}>
        {nodes.map(pmNode => {
          const pmCollapsed = collapsedNodes[pmNode.id];
          return (
            <div key={pmNode.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              {/* PM Level Card */}
              <div style={{ position: 'relative', zIndex: 2 }}>
                {renderNodeCard(pmNode, 0)}
              </div>

              {/* TL Level & Employee Level */}
              {pmNode.children && pmNode.children.length > 0 && !pmCollapsed && (
                <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 32 }}>
                  {/* Connecting Line Down from PM */}
                  <div style={{
                    position: 'absolute',
                    top: -32,
                    left: '50%',
                    width: 2,
                    height: 32,
                    background: '#8b5cf6',
                    zIndex: 1
                  }} />

                  {/* Horizontal Connecting Line across TLs */}
                  {pmNode.children.length > 1 && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: `${100 / (pmNode.children.length * 2)}%`,
                      right: `${100 / (pmNode.children.length * 2)}%`,
                      height: 2,
                      background: '#8b5cf6',
                      zIndex: 1
                    }} />
                  )}

                  <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'nowrap', width: '100%', overflowX: 'auto', padding: '0 12px' }}>
                    {pmNode.children.map((tlNode, idx) => {
                      const tlCollapsed = collapsedNodes[tlNode.id];
                      return (
                        <div key={tlNode.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                          {/* Vertical Connector Line down to TL */}
                          <div style={{
                            width: 2,
                            height: 32,
                            background: '#8b5cf6',
                            zIndex: 1
                          }} />

                          {/* TL Level Card */}
                          <div style={{ position: 'relative', zIndex: 2 }}>
                            {renderNodeCard(tlNode, 1)}
                          </div>

                          {/* Employees under this TL */}
                          {tlNode.children && tlNode.children.length > 0 && !tlCollapsed && (
                            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 32 }}>
                              {/* Connecting Line Down from TL */}
                              <div style={{
                                position: 'absolute',
                                top: -32,
                                left: '50%',
                                width: 2,
                                height: 32,
                                background: '#8b5cf6',
                                zIndex: 1
                              }} />

                              {/* Horizontal Connecting Line across Employees */}
                              {tlNode.children.length > 1 && (
                                <div style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: `${100 / (tlNode.children.length * 2)}%`,
                                  right: `${100 / (tlNode.children.length * 2)}%`,
                                  height: 2,
                                  background: '#8b5cf6',
                                  zIndex: 1
                                }} />
                              )}

                              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, width: '100%' }}>
                                {tlNode.children.map(empNode => (
                                  <div key={empNode.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                                    {/* Connector Line down to Employee */}
                                    <div style={{
                                      width: 2,
                                      height: 32,
                                      background: '#8b5cf6',
                                      zIndex: 1
                                    }} />

                                    {/* Employee Level Card */}
                                    <div style={{ zIndex: 2 }}>
                                      {renderNodeCard(empNode, 2)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Spacious List/Grid Fallback View
  const renderListView = () => {
    return (
      <Row gutter={[24, 24]}>
        {hierarchy.map(pmNode => (
          <Col xs={24} key={pmNode.id}>
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar style={{ background: '#4f46e5' }}>PM</Avatar>
                  <div>
                    <Text strong style={{ fontSize: 16 }}>{pmNode.name || pmNode.fullName}</Text>
                    <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{pmNode.email}</Text>
                  </div>
                </div>
              }
              style={{
                borderRadius: 16,
                boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.04)',
                border: '1px solid #f3e8ff'
              }}
            >
              {pmNode.children && pmNode.children.length > 0 ? (
                <Row gutter={[16, 16]}>
                  {pmNode.children.map(child => {
                    const isTLNode = child.type === 'TeamLead';
                    return (
                      <Col xs={24} md={12} lg={8} key={child.id}>
                        <Card
                          size="small"
                          type="inner"
                          title={
                            <Tag color={isTLNode ? 'pink' : 'blue'}>
                              {isTLNode ? 'Team Lead' : 'Direct Employee'}
                            </Tag>
                          }
                          style={{ borderRadius: 12 }}
                        >
                          <Text strong style={{ display: 'block' }}>{child.name || child.fullName}</Text>
                          <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>{child.email}</Text>

                          {isTLNode && child.children && child.children.length > 0 && (
                            <div style={{ marginTop: 12, background: isDarkMode ? '#27272a' : '#f8fafc', padding: 8, borderRadius: 8 }}>
                              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>Reporting Employees:</Text>
                              <Space direction="vertical" style={{ width: '100%' }}>
                                {child.children.map(emp => (
                                  <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Avatar size="small" style={{ background: '#8b5cf6', fontSize: 10 }}>EE</Avatar>
                                    <Text style={{ fontSize: 13 }}>{emp.name || emp.fullName}</Text>
                                  </div>
                                ))}
                              </Space>
                            </div>
                          )}
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              ) : (
                <Empty description="No reporters under this Project Manager" />
              )}
            </Card>
          </Col>
        ))}
      </Row>
    );
  };

  return (
    <div style={{ paddingBottom: 60 }}>
      <PageHeader 
        title="Organization Chart"
        subtitle="Visual representation of platform reporting relationships starting from Project Managers"
      />

      {/* METRIC COUNTER ROW */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={8} md={8}>
          <Card 
            style={{ 
              borderRadius: 12, 
              textAlign: 'center', 
              background: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)', 
              border: 'none',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.1)'
            }}
            bodyStyle={{ padding: 16 }}
          >
            <Title level={3} style={{ margin: 0, color: '#4338ca' }}>{pmCount}</Title>
            <Text style={{ color: '#4338ca', fontWeight: 600 }}>Project Managers</Text>
          </Card>
        </Col>
        <Col xs={8} md={8}>
          <Card 
            style={{ 
              borderRadius: 12, 
              textAlign: 'center', 
              background: 'linear-gradient(135deg, #fce7f3, #fbcfe8)', 
              border: 'none',
              boxShadow: '0 4px 12px rgba(219, 39, 119, 0.1)'
            }}
            bodyStyle={{ padding: 16 }}
          >
            <Title level={3} style={{ margin: 0, color: '#be185d' }}>{tlCount}</Title>
            <Text style={{ color: '#be185d', fontWeight: 600 }}>Team Leaders</Text>
          </Card>
        </Col>
        <Col xs={8} md={8}>
          <Card 
            style={{ 
              borderRadius: 12, 
              textAlign: 'center', 
              background: 'linear-gradient(135deg, #ecfeff, #cffafe)', 
              border: 'none',
              boxShadow: '0 4px 12px rgba(8, 145, 178, 0.1)'
            }}
            bodyStyle={{ padding: 16 }}
          >
            <Title level={3} style={{ margin: 0, color: '#0e7490' }}>{empCount}</Title>
            <Text style={{ color: '#0e7490', fontWeight: 600 }}>Employees</Text>
          </Card>
        </Col>
      </Row>

      {/* FILTER & CONTROL BAR */}
      <Card 
        style={{ 
          borderRadius: 12, 
          marginBottom: 24, 
          boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(0,0,0,0.02)',
          border: '1px solid #f3e8ff'
        }}
        bodyStyle={{ padding: 12 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <Space>
            <Input 
              prefix={<SearchOutlined style={{ color: '#8b5cf6' }} />} 
              placeholder="Search employee, manager..." 
              style={{ width: 280, borderRadius: 8 }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {viewMode === 'tree' && (
              <>
                <Button icon={<ExpandOutlined />} onClick={handleExpandAll}>Expand All</Button>
                <Button icon={<CompressOutlined />} onClick={handleCollapseAll}>Collapse All</Button>
              </>
            )}
          </Space>
          <Segmented
            options={[
              { label: 'Tree Map', value: 'tree', icon: <NodeIndexOutlined /> },
              { label: 'Spacious Grid', value: 'list', icon: <TeamOutlined /> }
            ]}
            value={viewMode}
            onChange={setViewMode}
          />
        </div>
      </Card>

      {/* CHART CONTENT AREA */}
      {users.length === 0 ? (
        <Card style={{ borderRadius: 16, padding: '40px 0', textAlign: 'center' }}>
          <Empty description="No organization details found." />
        </Card>
      ) : (
        <div style={{ width: '100%', overflowX: 'auto', padding: '24px 0' }}>
          {viewMode === 'tree' ? renderTree(hierarchy) : renderListView()}
        </div>
      )}
    </div>
  );
};

export default OrgChartPage;
