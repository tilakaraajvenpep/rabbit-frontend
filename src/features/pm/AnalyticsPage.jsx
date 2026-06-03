import React, { useState, useEffect } from 'react';
import { Card, DatePicker, Typography, Skeleton, Table, Space, Button, Select, Tag, theme, Avatar, Modal } from 'antd';
import { useAuthStore } from '../../store/authStore';
import { projectService } from '../../services/projectService';
import { ticketService } from '../../services/ticketService';
import { adminService } from '../../services/adminService';
import { useThemeStore } from '../../store/themeStore';
import PageHeader from '../../components/common/PageHeader';
import dayjs from 'dayjs';
import { UserOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';

const { Text } = Typography;

const AnalyticsPage = () => {
  const { currentUser: authUser, role: authRole } = useAuthStore();
  const { token } = theme.useToken();
  const { isDarkMode } = useThemeStore();
  
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scrumDate, setScrumDate] = useState(dayjs());
  const [allTickets, setAllTickets] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  // Ticket Description Modal state
  const [descModalVisible, setDescModalVisible] = useState(false);
  const [selectedTicketForDesc, setSelectedTicketForDesc] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projectsRes, ticketsRes, usersRes] = await Promise.all([
        projectService.getProjects(),
        ticketService.getTickets(),
        adminService.getUsers()
      ]);
      
      setProjects(projectsRes.data || []);
      setAllTickets(ticketsRes.data || []);
      setAllUsers(usersRes.data || []);
    } catch (error) {
      console.error('[ScrumMaster] Error in fetchData:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={{ padding: 24 }}>
      <Skeleton active paragraph={{ rows: 15 }} />
    </div>
  );

  // Filter associated employees and team leads
  const pmId = authUser?.userId || authUser?.id;
  const filteredUsers = allUsers.filter(u => {
    if (authRole === 'Employee') {
      return String(u.id || u.userId) === String(pmId);
    }
    if (u.role !== 'Employee' && u.role !== 'TeamLead') return false;
    
    if (authRole === 'ProjectManager') {
      if (u.role === 'TeamLead') {
        return String(u.projectManagerId) === String(pmId);
      }
      if (u.role === 'Employee') {
        if (String(u.projectManagerId) === String(pmId)) return true;
        if (u.teamLeadId) {
          const tl = allUsers.find(tlUser => String(tlUser.id) === String(u.teamLeadId));
          if (tl && String(tl.projectManagerId) === String(pmId)) return true;
        }
        return false;
      }
    } else if (authRole === 'TeamLead') {
      if (u.role === 'TeamLead') {
        return String(u.id || u.userId) === String(pmId);
      }
      if (u.role === 'Employee') {
        return String(u.teamLeadId) === String(pmId);
      }
    }
    return true;
  });

  // Calculate start of the week (Monday)
  const currentDay = scrumDate.day();
  const daysToSubtract = currentDay === 0 ? 6 : currentDay - 1;
  const startOfWeek = scrumDate.subtract(daysToSubtract, 'day');
  const days = [];
  for (let i = 0; i < 7; i++) {
    days.push(startOfWeek.add(i, 'day'));
  }

  // Define table columns
  const columns = [
    {
      title: 'Resource',
      key: 'employee',
      width: '16%',
      render: (_, record) => {
        const tl = allUsers.find(u => String(u.id) === String(record.teamLeadId));
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar 
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${record.email}`} 
              icon={<UserOutlined />} 
              size={32}
              style={{ flexShrink: 0 }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <Text strong style={{ display: 'block', fontSize: '14px', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isDarkMode ? '#f4f4f5' : '#18181b' }}>
                {record.name || record.fullName}
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                <Tag color={record.role === 'TeamLead' ? 'blue' : 'green'} style={{ alignSelf: 'flex-start', margin: 0, fontSize: '11px', lineHeight: '12px', padding: '0 4px', borderRadius: 3 }}>
                  {record.role === 'TeamLead' ? 'Team Lead' : 'Employee'}
                </Tag>
                {record.role === 'Employee' && tl && (
                  <Text type="secondary" style={{ fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                    TL: {tl.name || tl.fullName}
                  </Text>
                )}
              </div>
            </div>
          </div>
        );
      }
    },
    ...days.map(day => {
      const dateStr = day.format('YYYY-MM-DD');
      const isToday = day.isSame(dayjs(), 'day');
      return {
        title: (
          <div style={{ 
            textAlign: 'center', 
            background: isToday ? 'rgba(79, 70, 229, 0.1)' : 'transparent', 
            padding: '4px 2px', 
            borderRadius: '6px',
            border: isToday ? '1px solid rgba(79, 70, 229, 0.3)' : 'none'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: isToday ? '#4f46e5' : '#8c8c8c' }}>
              {day.format('ddd')}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: isToday ? '#4f46e5' : 'inherit', marginTop: 1 }}>
              {day.format('DD MMM')}
            </div>
          </div>
        ),
        key: dateStr,
        width: '12%',
        render: (_, record) => {
          // Filter tickets for this user and date
          const dayTickets = allTickets.filter(t => {
            const isDateMatch = t.dueDate && dayjs(t.dueDate).format('YYYY-MM-DD') === dateStr;
            if (!isDateMatch) return false;

            // Project filter
            if (selectedProjectId && String(t.projectId) !== String(selectedProjectId)) return false;
            
            if (String(t.assignedToUserId) === String(record.id)) return true;
            if (Array.isArray(t.assignedEmployees)) {
              return t.assignedEmployees.some(emp => String(emp.userId) === String(record.id));
            }
            return false;
          });

          if (dayTickets.length === 0) {
            return (
              <div style={{ textAlign: 'center', color: isDarkMode ? '#3f3f46' : '#d1d5db', padding: '12px 0', fontSize: '13px' }}>
                -
              </div>
            );
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {dayTickets.map(t => {
                let hoursLabel = '';
                let totalH = 0;
                if (Array.isArray(t.assignedEmployees)) {
                  const match = t.assignedEmployees.find(emp => String(emp.userId) === String(record.id));
                  if (match && match.hours) {
                    totalH = Number(match.hours);
                  }
                }
                if (!totalH && t.estimatedHours) {
                  totalH = Number(t.estimatedHours);
                }

                if (totalH > 0) {
                  const h = Math.floor(totalH);
                  const m = Math.round((totalH - h) * 60);
                  if (h > 0 && m > 0) {
                    hoursLabel = `${h}h ${m}m`;
                  } else if (m > 0) {
                    hoursLabel = `${m}m`;
                  } else {
                    hoursLabel = `${h}h`;
                  }
                }

                return (
                  <div 
                    key={t.id} 
                    onClick={() => {
                      setSelectedTicketForDesc(t);
                      setDescModalVisible(true);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#4f46e5';
                      e.currentTarget.style.boxShadow = '0 4px 10px rgba(99, 102, 241, 0.08)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = isDarkMode ? '#3f3f46' : '#e4e4e7';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.transform = 'none';
                    }}
                    style={{ 
                      padding: '6px 8px', 
                      background: isDarkMode ? '#27272a' : '#ffffff', 
                      border: isDarkMode ? '1px solid #3f3f46' : '1px solid #e4e4e7',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ 
                      fontWeight: 700, 
                      color: '#4f46e5', 
                      fontSize: '12px',
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      gap: 4,
                      flexWrap: 'wrap',
                      marginBottom: 4
                    }}>
                      <span style={{ whiteSpace: 'nowrap' }}>{t.ticketCode || `#${t.id}`}</span>
                      {hoursLabel && (
                        <span style={{ 
                          fontSize: '11px', 
                          fontWeight: 800, 
                          background: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)', 
                          color: '#10b981', 
                          padding: '1px 4px', 
                          borderRadius: 3,
                          whiteSpace: 'nowrap'
                        }}>
                          {hoursLabel}
                        </span>
                      )}
                    </div>
                    <div style={{ 
                      color: isDarkMode ? '#cbd5e1' : '#475569', 
                      fontWeight: 600, 
                      fontSize: '12px', 
                      lineHeight: '1.3',
                      whiteSpace: 'normal',
                      wordBreak: 'normal',
                      overflowWrap: 'break-word'
                    }}>
                      {t.title}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        }
      };
    })
  ];

  return (
    <div style={{ 
      height: 'calc(100vh - 64px)', 
      display: 'flex', 
      flexDirection: 'column', 
      background: isDarkMode ? '#09090b' : '#f8fafc',
      overflow: 'hidden',
      padding: '0 24px 24px 24px'
    }}>
      <div style={{ flexShrink: 0 }}>
        <PageHeader 
          title="Scrum Master Weekly Schedule" 
          subTitle={`Week: ${startOfWeek.format('DD MMM YYYY')} (Monday) - ${startOfWeek.add(6, 'day').format('DD MMM YYYY')} (Sunday)`}
          extra={
            <Space wrap>
              <Select
                allowClear
                placeholder="All Projects"
                style={{ width: 220 }}
                value={selectedProjectId}
                onChange={setSelectedProjectId}
              >
                {projects.map(p => (
                  <Select.Option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </Select.Option>
                ))}
              </Select>

              <Space>
                <Button 
                  icon={<LeftOutlined />} 
                  onClick={() => setScrumDate(prev => prev.subtract(1, 'week'))}
                />
                <DatePicker 
                  value={scrumDate} 
                  onChange={(date) => date && setScrumDate(date)} 
                  allowClear={false}
                  style={{ width: 180 }}
                  format="DD MMM YYYY"
                />
                <Button 
                  icon={<RightOutlined />} 
                  onClick={() => setScrumDate(prev => prev.add(1, 'week'))}
                />
              </Space>
            </Space>
          }
        />
      </div>

      <Card
        style={{
          borderRadius: 12,
          boxShadow: isDarkMode ? 'none' : '0 4px 20px rgba(0,0,0,0.03)',
          border: isDarkMode ? '1px solid #27272a' : '1px solid #e4e4e7',
          background: isDarkMode ? '#18181b' : '#ffffff',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        bodyStyle={{ 
          padding: 0, 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <Table 
          columns={columns}
          dataSource={filteredUsers}
          rowKey="id"
          pagination={false}
          scroll={{ y: 'calc(100vh - 280px)' }}
          bordered
          locale={{ emptyText: 'No employees or team leads associated to your account.' }}
          style={{ flex: 1 }}
        />
      </Card>

      {/* Ticket Details Modal */}
      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 16, color: isDarkMode ? '#f4f4f5' : '#18181b' }}>Ticket Details</span>}
        open={descModalVisible}
        onCancel={() => setDescModalVisible(false)}
        footer={[
          <Button key="close" type="primary" style={{ background: '#4f46e5', borderColor: '#4f46e5' }} onClick={() => setDescModalVisible(false)}>
            Close
          </Button>
        ]}
        destroyOnClose
      >
        {selectedTicketForDesc && (
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>TICKET CODE</Text>
              <span style={{ 
                fontSize: '12px', 
                fontWeight: 700, 
                background: 'rgba(79, 70, 229, 0.1)', 
                color: '#4f46e5', 
                padding: '4px 8px', 
                borderRadius: 4,
                border: '1px solid rgba(79, 70, 229, 0.2)'
              }}>
                {selectedTicketForDesc.ticketCode || `#${selectedTicketForDesc.id}`}
              </span>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>TICKET TITLE / NAME</Text>
              <div style={{ fontSize: 14, fontWeight: 700, color: isDarkMode ? '#f4f4f5' : '#18181b' }}>
                {selectedTicketForDesc.title}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>DESCRIPTION</Text>
              <div style={{ 
                fontSize: 13, 
                whiteSpace: 'pre-wrap', 
                background: isDarkMode ? '#09090b' : '#f8fafc',
                padding: '12px',
                borderRadius: '8px',
                border: isDarkMode ? '1px solid #27272a' : '1px solid #e4e4e7',
                color: isDarkMode ? '#cbd5e1' : '#475569',
                lineHeight: '1.5'
              }}>
                {selectedTicketForDesc.description || 'No description provided for this ticket.'}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AnalyticsPage;
