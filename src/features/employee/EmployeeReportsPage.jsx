import React, { useState, useEffect } from 'react';
import { 
  Card, Row, Col, DatePicker, Select, Button, Table, 
  Typography, Space, notification, Tag, Modal, Empty
} from 'antd';
import { DownloadOutlined, SearchOutlined, InfoCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService } from '../../services/reportService';
import { ticketService } from '../../services/ticketService';
import { projectService } from '../../services/projectService';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { adminService } from '../../services/adminService';
import { leaveService } from '../../services/leaveService';
import PageHeader from '../../components/common/PageHeader';
import { downloadCSV } from '../../utils/exportUtils';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

const EmployeeReportsPage = () => {
  const { currentUser, role } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  
  const t1 = isDarkMode ? '#f3f4f6' : '#1f2937';
  const t2 = isDarkMode ? '#9ca3af' : '#4b5563';
  const card = isDarkMode ? '#1f2937' : '#ffffff';
  const border = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const isManager = ['TeamLead', 'ProjectManager', 'TenantAdmin', 'HR', 'Accounts'].includes(role);
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [rawReportData, setRawReportData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  
  // Filters
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedTeamLead, setSelectedTeamLead] = useState(null);
  const [selectedPM, setSelectedPM] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [teamLeads, setTeamLeads] = useState([]);
  const [projectManagers, setProjectManagers] = useState([]);
  const [allUsersCache, setAllUsersCache] = useState([]);

  // Details Modal State
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Filter effect to update filteredData when filters change or rawReportData updates
  useEffect(() => {
    let data = rawReportData;

    if (selectedEmployee) {
      data = data.filter(r => String(r.userId) === String(selectedEmployee));
    }

    if (selectedTeamLead && ['HR', 'Accounts', 'TenantAdmin'].includes(role)) {
      data = data.filter(r => {
        const u = allUsersCache.find(u => String(u.id || u.userId) === String(r.userId));
        if (!u) return false;
        if (u.role === 'Employee' && String(u.teamLeadId) === String(selectedTeamLead)) return true;
        if (String(u.id || u.userId) === String(selectedTeamLead)) return true;
        return false;
      });
    }

    if (selectedPM && ['HR', 'Accounts', 'TenantAdmin'].includes(role)) {
      data = data.filter(r => {
        const u = allUsersCache.find(u => String(u.id || u.userId) === String(r.userId));
        if (!u) return false;
        if (String(u.projectManagerId) === String(selectedPM)) return true;
        if (String(u.id || u.userId) === String(selectedPM)) return true;
        if (u.role === 'Employee' && u.teamLeadId) {
          const tl = allUsersCache.find(t => String(t.id || t.userId) === String(u.teamLeadId));
          if (tl && String(tl.projectManagerId) === String(selectedPM)) return true;
        }
        return false;
      });
    }

    setFilteredData(data);
  }, [selectedEmployee, selectedTeamLead, selectedPM, rawReportData, allUsersCache]);

  const fetchInitialData = async () => {
    try {
      const [ticketRes, projectRes] = await Promise.all([
        ticketService.getTickets(),
        projectService.getProjects()
      ]);
      setTickets(ticketRes.data || []);
      setProjects(projectRes.data || []);
    } catch (error) {
      notification.error({ message: 'Failed to load initial metadata' });
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      let start, end;
      if (dateRange && dateRange[0] && dateRange[1]) {
        start = dateRange[0].format('YYYY-MM-DD');
        end = dateRange[1].format('YYYY-MM-DD');
      } else {
        start = '2000-01-01';
        end = '2100-12-31';
      }
      
      let res, leavesRes, usersRes;
      if (isManager) {
        [res, leavesRes, usersRes] = await Promise.all([
          reportService.getAllReportsByRange(start, end),
          leaveService.getAllLeaves(),
          adminService.getUsers()
        ]);
      } else {
        [res, leavesRes] = await Promise.all([
          reportService.getReportsByRange(currentUser.id || currentUser.userId, start, end),
          leaveService.getMyLeaves()
        ]);
      }
      
      const allUsers = isManager ? (usersRes?.data || []) : [{
        userId: currentUser.id || currentUser.userId,
        fullName: currentUser.fullName || currentUser.name,
        role: role
      }];
      const leavesData = leavesRes?.data || [];
      const reportsData = res?.data || [];

      // Group everything by userId and date
      const groupedMap = new Map();

      const getOrCreateGroup = (userId, dateStr, baseInfo) => {
        const key = `${userId}-${dateStr}`;
        if (!groupedMap.has(key)) {
          groupedMap.set(key, {
            key,
            userId,
            date: dateStr,
            employeeName: baseInfo.employeeName,
            userRole: baseInfo.userRole,
            supervisorName: baseInfo.supervisorName,
            hours: 0,
            workHours: 0,
            leaveHours: 0,
            leaveLabel: null,
            leaveReason: null,
            workItems: [],
            blockers: 'None'
          });
        }
        return groupedMap.get(key);
      };

      // Process reports
      reportsData.forEach(report => {
        if (!report || !report.items) return;

        const targetUserId = report.userId;
        const userObj = allUsers.find(u => String(u.id || u.userId) === String(targetUserId));
        const employeeName = userObj ? (userObj.fullName || userObj.name) : (Number(targetUserId) === Number(currentUser.id || currentUser.userId) ? (currentUser.name || currentUser.fullName) : `Employee #${targetUserId}`);
        const userRole = userObj ? userObj.role : 'Employee';

        let supervisorName = 'N/A';
        if (userObj) {
          if (userObj.role === 'Employee' && userObj.teamLeadId) {
            const tl = allUsers.find(u => String(u.id || u.userId) === String(userObj.teamLeadId));
            if (tl) supervisorName = tl.fullName || tl.name || 'Unassigned';
          } else if (userObj.role === 'TeamLead' && userObj.projectManagerId) {
            const pm = allUsers.find(u => String(u.id || u.userId) === String(userObj.projectManagerId));
            if (pm) supervisorName = pm.fullName || pm.name || 'Unassigned';
          }
        }

        const dateStr = dayjs(report.date || report.reportDate).format('YYYY-MM-DD');
        const group = getOrCreateGroup(targetUserId, dateStr, { employeeName, userRole, supervisorName });

        if (report.blockers && report.blockers !== 'None') {
          group.blockers = report.blockers;
        }

        report.items.forEach(item => {
          const ticketInfo = tickets.find(t => Number(t.id) === Number(item.ticketId));
          const projectInfo = projects.find(p => Number(p.id) === Number(ticketInfo?.projectId || item.projectId));
          const hrs = Number(item.hours || item.hoursSpent || 0);

          group.hours += hrs;
          group.workHours += hrs;
          group.workItems.push({
            projectId: ticketInfo?.projectId || item.projectId || 'N/A',
            projectName: projectInfo?.name || projectInfo?.projectName || 'N/A',
            ticketId: item.ticketId,
            ticketCode: ticketInfo?.code || 'N/A',
            ticketTitle: ticketInfo?.title || 'Unknown',
            ticketStartDate: ticketInfo?.startDate || null,
            ticketDueDate: ticketInfo?.dueDate || null,
            hours: hrs,
            workDone: item.workDone || ''
          });
        });
      });

      // Filter leaves in range
      const filteredLeaves = leavesData.filter(l => {
        const lDate = dayjs(l.leaveDate || l.date);
        const startDay = dayjs(start).startOf('day');
        const endDay = dayjs(end).endOf('day');
        const inRange = lDate.isAfter(startDay.subtract(1, 'day')) && lDate.isBefore(endDay.add(1, 'day'));
        const isOwn = isManager || String(l.userId || l.user?.id) === String(currentUser.id || currentUser.userId);
        return inRange && l.status === 'Approved' && isOwn;
      });

      // Process leaves
      filteredLeaves.forEach(leave => {
        const targetUserId = leave.userId || leave.user?.id;
        const userObj = allUsers.find(u => String(u.id || u.userId) === String(targetUserId));
        const employeeName = userObj ? (userObj.fullName || userObj.name) : (Number(targetUserId) === Number(currentUser.id || currentUser.userId) ? (currentUser.name || currentUser.fullName) : `Employee #${targetUserId}`);
        const userRole = userObj ? userObj.role : 'Employee';

        let supervisorName = 'N/A';
        if (userObj) {
          if (userObj.role === 'Employee' && userObj.teamLeadId) {
            const tl = allUsers.find(u => String(u.id || u.userId) === String(userObj.teamLeadId));
            if (tl) supervisorName = tl.fullName || tl.name || 'Unassigned';
          } else if (userObj.role === 'TeamLead' && userObj.projectManagerId) {
            const pm = allUsers.find(u => String(u.id || u.userId) === String(userObj.projectManagerId));
            if (pm) supervisorName = pm.fullName || pm.name || 'Unassigned';
          }
        }

        let leaveHours = 0;
        if (leave.type === 'Permission') {
          const duration = leave.permissionDuration || '';
          if (duration.includes('hr')) {
            leaveHours = parseFloat(duration) || 0;
          } else if (duration.includes('min')) {
            leaveHours = (parseFloat(duration) || 0) / 60;
          } else {
            leaveHours = 2;
          }
        }

        const leaveLabel = leave.type === 'Permission' ? 'PERMISSION' : leave.type === 'HalfDay' ? 'HALF DAY LEAVE' : 'FULL DAY LEAVE';
        const dateStr = dayjs(leave.leaveDate || leave.date).format('YYYY-MM-DD');
        const group = getOrCreateGroup(targetUserId, dateStr, { employeeName, userRole, supervisorName });

        group.hours += leaveHours;
        group.leaveHours += leaveHours;
        group.leaveLabel = leaveLabel;
        group.leaveReason = leave.reason || 'No reason provided';
      });

      // Construct flat reports array for state and CSV export
      const reports = Array.from(groupedMap.values()).map(group => {
        const pIds = group.workItems.map(item => item.projectId).filter(Boolean).join('; ');
        const pNames = (group.leaveLabel ? `[Leave: ${group.leaveLabel}] ` : '') + (group.workItems.map(item => item.projectName).filter(Boolean).join('; ') || 'Leave / Time Off');
        const tIds = group.workItems.map(item => item.ticketId).filter(Boolean).join('; ');
        const tCodes = (group.leaveLabel ? 'LEAVE' : '') + (group.workItems.map(item => item.ticketCode).filter(Boolean).join('; ') ? `${group.leaveLabel ? '; ' : ''}${group.workItems.map(item => item.ticketCode).filter(Boolean).join('; ')}` : '');
        const tTitles = (group.leaveLabel ? group.leaveLabel : '') + (group.workItems.map(item => item.ticketTitle).filter(Boolean).join('; ') ? `${group.leaveLabel ? '; ' : ''}${group.workItems.map(item => item.ticketTitle).filter(Boolean).join('; ')}` : '');
        const tStarts = group.workItems.map(item => item.ticketStartDate).filter(Boolean).join('; ') || null;
        const tDues = group.workItems.map(item => item.ticketDueDate).filter(Boolean).join('; ') || null;
        const wDone = (group.leaveLabel ? `[Leave] ${group.leaveReason}` : '') + (group.workItems.map(item => `[Work] ${item.workDone}`).join('\n') ? `${group.leaveLabel ? '\n' : ''}${group.workItems.map(item => `[Work] ${item.workDone}`).join('\n')}` : '');

        return {
          key: group.key,
          userId: group.userId,
          date: group.date,
          employeeName: group.employeeName,
          userRole: group.userRole,
          supervisorName: group.supervisorName,
          projectId: pIds || 'N/A',
          projectName: pNames,
          ticketId: tIds || 'N/A',
          ticketCode: tCodes || 'N/A',
          ticketTitle: tTitles || 'N/A',
          ticketStartDate: tStarts,
          ticketDueDate: tDues,
          hours: group.hours,
          workHours: group.workHours,
          leaveHours: group.leaveHours,
          leaveLabel: group.leaveLabel,
          leaveReason: group.leaveReason,
          workDone: wDone,
          blockers: group.blockers,
          isLeave: !!group.leaveLabel,
          workItems: group.workItems
        };
      });

      const sorted = reports.sort((a, b) => dayjs(b.date).unix() - dayjs(a.date).unix());
      setRawReportData(sorted);

      // Dynamically collect unique employees from generated dataset
      const uniqueEmployeesMap = new Map();
      sorted.forEach(r => {
        uniqueEmployeesMap.set(String(r.userId), r.employeeName);
      });
      const collectedEmployees = Array.from(uniqueEmployeesMap.entries()).map(([id, name]) => ({
        id,
        name
      }));
      setEmployees(collectedEmployees);

      // Cache allUsers for filter effect
      setAllUsersCache(allUsers);

      // Collect unique Team Leads and Project Managers for HR/Accounts/TenantAdmin filters
      if (['HR', 'Accounts', 'TenantAdmin'].includes(role)) {
        const tlMap = new Map();
        const pmMap = new Map();
        allUsers.forEach(u => {
          if (u.role === 'TeamLead') {
            tlMap.set(String(u.id || u.userId), u.fullName || u.name);
          }
          if (u.role === 'ProjectManager') {
            pmMap.set(String(u.id || u.userId), u.fullName || u.name);
          }
        });
        setTeamLeads(Array.from(tlMap.entries()).map(([id, name]) => ({ id, name })));
        setProjectManagers(Array.from(pmMap.entries()).map(([id, name]) => ({ id, name })));
      }

      setHasGenerated(true);
    } catch (error) {
      console.error('Report Search Error:', error);
      notification.error({ 
        message: 'Search Failed', 
        description: error.response?.data?.message || error.message || 'Unknown error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (filteredData.length === 0) {
      return notification.warning({ message: 'No data to export' });
    }
    downloadCSV(filteredData, `Work_Report_${dayjs().format('YYYY-MM-DD')}`);
  };

  // Group filteredData by Project Name
  const getGroupedData = () => {
    const groups = {};
    filteredData.forEach(item => {
      const key = item.projectId;
      if (!groups[key]) {
        groups[key] = {
          key: key,
          projectId: item.projectId,
          projectName: item.projectName,
          totalHours: 0,
          entries: []
        };
      }
      groups[key].totalHours += item.hours;
      groups[key].entries.push(item);
    });
    return Object.values(groups);
  };

  const handleShowTicketDetails = (group) => {
    setSelectedGroup(group);
    setIsDetailsModalOpen(true);
  };


  // Columns for the Work Reports detailed entries table
  const columns = [
    ...(isManager ? [{ 
      title: 'Employee Name', 
      dataIndex: 'employeeName', 
      key: 'employeeName', 
      width: 160,
      render: (name) => <span style={{ fontWeight: 600, color: t1 }}>{name}</span>
    }] : []),
    { 
      title: 'Project / Task', 
      dataIndex: 'projectName', 
      key: 'projectName', 
      render: (_, record) => {
        return (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            {record.leaveLabel && (
              <div>
                <div style={{ fontWeight: 700, color: t1 }}>Leave / Time Off</div>
                <Tag color={record.leaveLabel.includes('PERMISSION') ? 'cyan' : record.leaveLabel.includes('HALF') ? 'purple' : 'magenta'} style={{ fontWeight: 600, marginTop: 2 }}>
                  {record.leaveLabel}
                </Tag>
              </div>
            )}
            {record.workItems && record.workItems.map((item, idx) => (
              <div key={idx} style={{ marginTop: idx > 0 || record.leaveLabel ? 4 : 0 }}>
                <div style={{ fontWeight: 700, color: t1 }}>{item.projectName}</div>
                <div style={{ fontSize: '11px', color: '#6366f1', marginTop: 1 }}>
                  {item.ticketCode} - {item.ticketTitle}
                </div>
              </div>
            ))}
          </Space>
        );
      }
    },
    {
      title: 'Ticket Schedule',
      key: 'ticketSchedule',
      width: 200,
      render: (_, record) => {
        const schedules = [];
        if (record.workItems) {
          record.workItems.forEach(item => {
            if (item.ticketStartDate || item.ticketDueDate) {
              const start = item.ticketStartDate ? dayjs(item.ticketStartDate).format('DD MMM YYYY') : 'N/A';
              const end = item.ticketDueDate ? dayjs(item.ticketDueDate).format('DD MMM YYYY') : 'N/A';
              schedules.push({ code: item.ticketCode, start, end });
            }
          });
        }
        if (schedules.length === 0) return <span style={{ color: t2 }}>-</span>;
        return (
          <div style={{ fontSize: '12px', color: t2 }}>
            {schedules.map((s, idx) => (
              <div key={idx} style={{ marginTop: idx > 0 ? 4 : 0 }}>
                {schedules.length > 1 && <strong>{s.code}: </strong>}
                Start: {s.start} <br /> End: {s.end}
              </div>
            ))}
          </div>
        );
      }
    },
    {
      title: 'Reporting Date',
      dataIndex: 'date',
      key: 'reportingDate',
      width: 140,
      render: (date) => (
        <span style={{ fontWeight: 600, color: '#4f46e5' }}>
          {dayjs(date).format('DD MMM YYYY')}
        </span>
      )
    },
    { 
      title: 'Hours Worked', 
      dataIndex: 'hours', 
      key: 'hours', 
      width: 140,
      render: (h, record) => {
        const wHrs = Math.floor(record.workHours || 0);
        const wMins = Math.round(((record.workHours || 0) - wHrs) * 60);
        
        const lHrs = Math.floor(record.leaveHours || 0);
        const lMins = Math.round(((record.leaveHours || 0) - lHrs) * 60);

        if (record.workHours > 0 && record.leaveHours > 0) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div>
                <span style={{ fontSize: '11px', color: t2 }}>Work: </span>
                <span style={{ fontWeight: 700, color: '#10b981' }}>{wHrs}h {wMins}m</span>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: t2 }}>Leave: </span>
                <span style={{ fontWeight: 700, color: '#ef4444' }}>{lHrs}h {lMins}m</span>
              </div>
            </div>
          );
        }

        if (record.leaveHours > 0) {
          return (
            <span style={{ fontWeight: 700, color: '#ef4444' }}>
              {lHrs}h {lMins}m (Leave)
            </span>
          );
        }

        return (
          <span style={{ fontWeight: 700, color: '#10b981' }}>
            {wHrs}h {wMins}m
          </span>
        );
      }
    },
    {
      title: 'Remaining Hours',
      key: 'remainingHours',
      width: 150,
      render: (_, record) => {
        const reportedHours = record.hours || 0;
        const remaining = Math.max(0, 8.5 - reportedHours);
        
        const hrs = Math.floor(remaining);
        const mins = Math.round((remaining - hrs) * 60);

        return (
          <span style={{ fontWeight: 700, color: remaining > 0 ? '#ff4d4f' : '#10b981' }}>
            {hrs}h {mins}m
          </span>
        );
      }
    },
    {
      title: 'Description (Work Done)',
      dataIndex: 'workDone',
      key: 'workDone',
      render: (_, record) => {
        return (
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            {record.leaveLabel && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 700, color: '#ef4444' }}>Leave</span>
                <span style={{ color: t2, fontSize: '12px', fontStyle: 'italic', whiteSpace: 'pre-wrap', marginTop: 2 }}>
                  {record.leaveReason || 'No reason provided'}
                </span>
              </div>
            )}
            {record.workItems && record.workItems.length > 0 && (
              <div style={{ 
                marginTop: record.leaveLabel ? 6 : 0, 
                paddingTop: record.leaveLabel ? 6 : 0, 
                borderTop: record.leaveLabel ? `1px dashed ${border}` : 'none' 
              }}>
                {record.leaveLabel && <div style={{ fontWeight: 600, color: t1, fontSize: '11px', marginBottom: 2 }}>Work Done Today:</div>}
                {record.workItems.map((item, idx) => (
                  <div key={idx} style={{ color: t2, fontSize: '12px', whiteSpace: 'pre-wrap', marginBottom: idx < record.workItems.length - 1 ? 4 : 0 }}>
                    {record.workItems.length > 1 && <strong>{item.ticketCode}: </strong>}
                    {item.workDone}
                  </div>
                ))}
              </div>
            )}
          </Space>
        );
      }
    }
  ];

  // Columns inside details modal
  const detailsColumns = [
    { 
      title: 'Employee Name', 
      dataIndex: 'employeeName', 
      key: 'employeeName', 
      width: 160,
      render: (name) => <span style={{ fontWeight: 600, color: t1 }}>{name}</span>
    },
    { 
      title: 'Ticket Start Date', 
      dataIndex: 'ticketStartDate', 
      key: 'ticketStartDate', 
      width: 140,
      render: (date, record) => {
        if (record.isLeave || !date) return <span style={{ color: t2 }}>-</span>;
        return <span style={{ color: t2 }}>{dayjs(date).format('DD MMM YYYY')}</span>;
      }
    },
    { 
      title: 'Ticket End Date', 
      dataIndex: 'ticketDueDate', 
      key: 'ticketDueDate', 
      width: 140,
      render: (date, record) => {
        if (record.isLeave || !date) return <span style={{ color: t2 }}>-</span>;
        return <span style={{ color: t2 }}>{dayjs(date).format('DD MMM YYYY')}</span>;
      }
    },
    { 
      title: 'Reporting Date', 
      dataIndex: 'date', 
      key: 'reportingDate', 
      width: 130,
      render: (date) => <span style={{ fontWeight: 600, color: '#4f46e5' }}>{dayjs(date).format('DD MMM YYYY')}</span>
    },
    { 
      title: 'Ticket Code', 
      dataIndex: 'ticketCode', 
      key: 'ticketCode', 
      width: 120,
      render: (code, record) => {
        if (code === 'LEAVE') {
          return <Tag color="cyan" style={{ fontWeight: 600 }}>LEAVE</Tag>;
        }
        return (
          <span style={{ 
            fontSize: '11px', 
            fontWeight: 700, 
            background: `${isDarkMode ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)'}`, 
            color: '#6366f1', 
            padding: '2px 6px', 
            borderRadius: 4,
            border: '1px solid rgba(99, 102, 241, 0.3)'
          }}>
            {code}
          </span>
        );
      }
    },
    { 
      title: 'Ticket Name / Task', 
      dataIndex: 'ticketTitle', 
      key: 'ticketTitle',
      render: (title, record) => {
        if (record.isLeave) {
          const typeColor = title.includes('PERMISSION') ? 'cyan' : title.includes('HALF') ? 'purple' : 'magenta';
          return <Tag color={typeColor} style={{ fontWeight: 700 }}>{title}</Tag>;
        }
        return <span style={{ fontWeight: 600, color: t1 }}>{title}</span>;
      }
    },
    { 
      title: 'Reported Hours', 
      dataIndex: 'hours', 
      key: 'hours', 
      width: 130,
      render: (h, record) => {
        if (record.isLeave) return record.hours > 0 ? `${record.hours}h` : 'N/A';
        const hrs = Math.floor(h);
        const mins = Math.round((h - hrs) * 60);
        return (
          <span style={{ fontWeight: 700, color: '#10b981' }}>
            {hrs}h {mins}m
          </span>
        );
      }
    },
    { 
      title: 'Description (Work Done)', 
      dataIndex: 'workDone', 
      key: 'workDone',
      render: (text, record) => {
        if (record.isLeave) {
          const cleanText = (text || '').replace(/^\[Leave Reason\]\s*/i, '');
          const workDescs = getWorkDescriptionsForUserAndDate(record);
          return (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 700, color: '#ef4444' }}>Leave</span>
              <span style={{ color: t2, fontSize: '12px', whiteSpace: 'pre-wrap', marginTop: 2 }}>
                {cleanText}
              </span>
              {workDescs.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px dashed ${border}` }}>
                  <div style={{ fontWeight: 600, color: t1, fontSize: '11px', marginBottom: 2 }}>Work Done Today:</div>
                  {workDescs.map((desc, i) => (
                    <div key={i} style={{ fontSize: '11px', color: t2, marginLeft: 6 }}>
                      • {desc}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }
        return <span style={{ color: t2, whiteSpace: 'pre-wrap' }}>{text}</span>;
      }
    }
  ];

  const groupedData = getGroupedData();

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 8px' }}>
      <PageHeader title="Work Reports" />

      <Card style={{ marginBottom: 24, borderRadius: 12, border: `1px solid ${border}`, background: card }} bodyStyle={{ padding: '20px' }}>
        <Row gutter={[16, 24]} align="bottom">
          <Col xs={24} sm={16} md={18}>
            <Text strong style={{ fontSize: '13px', display: 'block', marginBottom: 8, color: t1 }}>Select Report Date Range</Text>
            <RangePicker 
              style={{ width: '100%', height: 40, borderRadius: 8 }} 
              value={dateRange}
              onChange={(val) => setDateRange(val)}
            />
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Button 
              type="primary" 
              icon={<SearchOutlined />} 
              onClick={handleSearch}
              loading={loading}
              size="large"
              block
              style={{ borderRadius: 8, height: 40, background: '#4f46e5', borderColor: '#4f46e5', fontWeight: 700 }}
            >
              Generate Report
            </Button>
          </Col>
        </Row>
      </Card>

      {hasGenerated && (
        <Card style={{ borderRadius: 12, border: `1px solid ${border}`, background: card }} bodyStyle={{ padding: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <Text strong style={{ whiteSpace: 'nowrap', minWidth: 120, color: t1 }}>Filter by Employee:</Text>
              <Select
                placeholder="All Employees"
                style={{ minWidth: 200, flex: 1 }}
                allowClear
                value={selectedEmployee}
                onChange={setSelectedEmployee}
                size="large"
                showSearch
                optionFilterProp="children"
              >
                {employees.map(u => (
                  <Select.Option key={u.id} value={u.id}>{u.name || u.fullName}</Select.Option>
                ))}
              </Select>

              {['HR', 'Accounts', 'TenantAdmin'].includes(role) && (
                <>
                  <Text strong style={{ whiteSpace: 'nowrap', minWidth: 100, color: t1 }}>Team Lead:</Text>
                  <Select
                    placeholder="All Team Leads"
                    style={{ minWidth: 180, flex: 1 }}
                    allowClear
                    value={selectedTeamLead}
                    onChange={setSelectedTeamLead}
                    size="large"
                    showSearch
                    optionFilterProp="children"
                  >
                    {teamLeads.map(tl => (
                      <Select.Option key={tl.id} value={tl.id}>{tl.name}</Select.Option>
                    ))}
                  </Select>
 
                  <Text strong style={{ whiteSpace: 'nowrap', minWidth: 60, color: t1 }}>PM:</Text>
                  <Select
                    placeholder="All PMs"
                    style={{ minWidth: 180, flex: 1 }}
                    allowClear
                    value={selectedPM}
                    onChange={setSelectedPM}
                    size="large"
                    showSearch
                    optionFilterProp="children"
                  >
                    {projectManagers.map(pm => (
                      <Select.Option key={pm.id} value={pm.id}>{pm.name}</Select.Option>
                    ))}
                  </Select>
                </>
              )}

              <Button 
                icon={<DownloadOutlined />} 
                onClick={handleExport}
                disabled={filteredData.length === 0}
                size="large"
                style={{ borderRadius: 8, height: 40 }}
              >
                Export CSV
              </Button>
            </div>
          </div>

          <Table 
            dataSource={filteredData} 
            columns={columns} 
            loading={loading}
            rowKey="key"
            pagination={{ pageSize: 10 }}
            style={{ borderRadius: 8, overflow: 'hidden' }}
            summary={(pageData) => {
              let total = 0;
              pageData.forEach(({ hours }) => { total += hours; });
              const colSpan = isManager ? 4 : 3;
              return (
                <Table.Summary.Row style={{ background: isDarkMode ? '#1e2130' : '#f8fafc' }}>
                  <Table.Summary.Cell index={0} colSpan={colSpan}>
                    <Text strong style={{ color: t1 }}>Total Hours in Current View</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="left">
                    <Text strong style={{ color: '#10b981' }}>{total.toFixed(1)} hrs</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} colSpan={2} />
                </Table.Summary.Row>
              );
            }}
          />
        </Card>
      )}

      {/* Ticket Details Modal */}
      <Modal
        title={
          <div style={{ fontSize: 16, fontWeight: 800, color: t1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <InfoCircleOutlined style={{ color: '#4f46e5' }} />
            <span>Project Tasks Details</span>
          </div>
        }
        open={isDetailsModalOpen}
        onCancel={() => setIsDetailsModalOpen(false)}
        footer={null}
        width={900}
        destroyOnClose
      >
        {selectedGroup && (
          <div style={{ marginTop: 12 }}>
            {/* Meta summary card */}
              <div style={{ 
                marginBottom: 20, 
                background: isDarkMode ? '#11131c' : '#f8fafc', 
                padding: '16px 20px', 
                borderRadius: 8, 
                border: `1px solid ${border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12
              }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: t2, textTransform: 'uppercase', marginBottom: 4 }}>PROJECT</div>
                  <div style={{ fontWeight: 800, color: t1, fontSize: '15px' }}>{selectedGroup.projectName}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: t2, textTransform: 'uppercase', marginBottom: 4 }}>TOTAL WORKED TIME</div>
                  <Tag color="success" style={{ fontWeight: 700, fontSize: '14px', padding: '4px 10px', borderRadius: 4 }}>
                    {Math.floor(selectedGroup.totalHours)}h {Math.round((selectedGroup.totalHours - Math.floor(selectedGroup.totalHours)) * 60)}m
                  </Tag>
                </div>
              </div>

            {/* Detailed Ticket Items Table */}
            <Table
              dataSource={selectedGroup.entries}
              columns={detailsColumns}
              rowKey="key"
              pagination={{ pageSize: 5 }}
              bordered
              style={{ borderRadius: 8, overflow: 'hidden' }}
              locale={{ emptyText: <Empty description="No task entries reported for this project." /> }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default EmployeeReportsPage;