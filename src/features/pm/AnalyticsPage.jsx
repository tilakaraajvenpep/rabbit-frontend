import React, { useState, useEffect } from 'react';
import { Card, DatePicker, Typography, Skeleton, Table, Space, Button, Select, Tag, theme, Avatar } from 'antd';
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

  // Calculate start of the isoWeek (Monday)
  const startOfWeek = scrumDate.startOf('isoWeek');
  const days = [];
  for (let i = 0; i < 7; i++) {
    days.push(startOfWeek.add(i, 'day'));
  }

  // Define table columns
  const columns = [
    {
      title: 'Resource',
      key: 'employee',
      width: 260,
      fixed: 'left',
      render: (_, record) => {
        const tl = allUsers.find(u => String(u.id) === String(record.teamLeadId));
        return (
          <Space>
            <Avatar src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${record.email}`} icon={<UserOutlined />} />
            <div>
              <Text strong style={{ display: 'block', fontSize: '14px' }}>{record.name || record.fullName}</Text>
              <Space size={4} style={{ marginTop: 2 }}>
                <Tag color={record.role === 'TeamLead' ? 'blue' : 'green'} style={{ marginRight: 0, fontSize: '11px', lineHeight: '16px', padding: '0 6px' }}>
                  {record.role === 'TeamLead' ? 'Team Lead' : 'Employee'}
                </Tag>
                {record.role === 'Employee' && tl && (
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    TL: {tl.name || tl.fullName}
                  </Text>
                )}
              </Space>
            </div>
          </Space>
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
            padding: '6px 2px', 
            borderRadius: '6px',
            border: isToday ? '1px solid rgba(79, 70, 229, 0.3)' : 'none'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: isToday ? '#4f46e5' : '#8c8c8c' }}>
              {day.format('ddd')}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: isToday ? '#4f46e5' : 'inherit', marginTop: 2 }}>
              {day.format('DD MMM')}
            </div>
          </div>
        ),
        key: dateStr,
        width: 200,
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
              <div style={{ textAlign: 'center', color: '#bfbfbf', padding: '16px 0', fontSize: '13px' }}>
                -
              </div>
            );
          }

          return (
            <Space direction="vertical" style={{ width: '100%' }} size={6}>
              {dayTickets.map(t => {
                let hoursLabel = '';
                if (Array.isArray(t.assignedEmployees)) {
                  const match = t.assignedEmployees.find(emp => String(emp.userId) === String(record.id));
                  if (match && match.hours) {
                    hoursLabel = `${match.hours}h`;
                  }
                }
                if (!hoursLabel && t.estimatedHours) {
                  hoursLabel = `${t.estimatedHours}h`;
                }

                return (
                  <div 
                    key={t.id} 
                    style={{ 
                      padding: '8px 12px', 
                      background: isDarkMode ? '#1e293b' : '#ffffff', 
                      border: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '12px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#2563eb', marginBottom: 2 }}>
                      {t.ticketCode}
                    </div>
                    <div style={{ color: isDarkMode ? '#cbd5e1' : '#475569', fontWeight: 500 }}>
                      {t.title}
                    </div>
                    {hoursLabel && (
                      <Tag size="small" color="blue" style={{ marginTop: 6, marginRight: 0, fontSize: '10px', borderRadius: '4px' }}>
                        {hoursLabel}
                      </Tag>
                    )}
                  </div>
                );
              })}
            </Space>
          );
        }
      };
    })
  ];

  return (
    <div style={{ paddingBottom: 40 }}>
      <PageHeader 
        title="Scrum Master Weekly Schedule" 
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
                picker="week"
                value={scrumDate} 
                onChange={(date) => date && setScrumDate(date)} 
                allowClear={false}
                style={{ width: 180 }}
              />
              <Button 
                icon={<RightOutlined />} 
                onClick={() => setScrumDate(prev => prev.add(1, 'week'))}
              />
            </Space>
          </Space>
        }
      />

      <Card
        style={{
          borderRadius: 12,
          boxShadow: isDarkMode ? 'none' : '0 4px 20px rgba(0,0,0,0.03)',
          border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0',
        }}
        bodyStyle={{ padding: 0 }}
      >
        <Table 
          columns={columns}
          dataSource={filteredUsers}
          rowKey="id"
          pagination={false}
          scroll={{ x: 'max-content' }}
          bordered
          locale={{ emptyText: 'No employees or team leads associated to your account.' }}
        />
      </Card>
    </div>
  );
};

export default AnalyticsPage;
