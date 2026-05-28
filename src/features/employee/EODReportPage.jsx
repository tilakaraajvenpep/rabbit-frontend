import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, InputNumber, Select, Button, Space, Typography,
  Row, Col, Progress, Alert, notification, Tag, Result, Modal, Radio, theme, Table, Badge, Tabs, DatePicker
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SendOutlined, CheckCircleOutlined,
  CheckCircleFilled, ExclamationCircleFilled, ClockCircleOutlined,
  LeftOutlined, RightOutlined, ProjectOutlined, AlertOutlined,
  WarningOutlined, SendOutlined as RaiseIcon, ApartmentOutlined, CalendarOutlined
} from '@ant-design/icons';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { reportService } from '../../services/reportService';
import { ticketService } from '../../services/ticketService';
import { analyticsService } from '../../services/analyticsService';
import { leaveService } from '../../services/leaveService';
import { adminService } from '../../services/adminService';
import { timerRequestService } from '../../services/timerRequestService';
import { projectService } from '../../services/projectService';
import { reportAccessService } from '../../services/reportAccessService';

import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import PageHeader from '../../components/common/PageHeader';

const { TextArea } = Input;
const { Title, Text } = Typography;

const EODReportPage = () => {
  const navigate = useNavigate();
  const { currentUser, role, setUser } = useAuthStore();
  const { token } = theme.useToken();
  const { isDarkMode } = useThemeStore();

  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [baseDate, setBaseDate] = useState(dayjs().startOf('week').add(1, 'day'));
  const [weekDates, setWeekDates] = useState([]);
  const [weeklyStatus, setWeeklyStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [myTickets, setMyTickets] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [isOutsideCurrentWeek, setIsOutsideCurrentWeek] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [existingReport, setExistingReport] = useState(null);
  const [currentLeave, setCurrentLeave] = useState(null);
  const [weeklyReports, setWeeklyReports] = useState([]);
  const [allocatedHoursPerDay, setAllocatedHoursPerDay] = useState(Number(currentUser?.allocatedHours) || 8.5);

  // Timer Requests State
  const [myTimerRequests, setMyTimerRequests] = useState([]);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestForm] = Form.useForm();
  const [requesting, setRequesting] = useState(false);
  const [activeRequestDetails, setActiveRequestDetails] = useState(null);
  const [teamLeads, setTeamLeads] = useState([]);
  const [selectedTeamLeadId, setSelectedTeamLeadId] = useState(null);
  // Blocking modal when hours exceeded
  const [isHoursBlockedModalOpen, setIsHoursBlockedModalOpen] = useState(false);
  const [blockedSubmitTotal, setBlockedSubmitTotal] = useState(0);

  // Modal State for New Ticket
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [activeTicketRowIndex, setActiveTicketRowIndex] = useState(null);
  const [newTicketLoading, setNewTicketLoading] = useState(false);
  const [ticketForm] = Form.useForm();

  // Modal State for Leave Application
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveApplying, setLeaveApplying] = useState(false);
  const [leaveForm] = Form.useForm();

  // Modal State for Report Access Request
  const [isAccessRequestModalOpen, setIsAccessRequestModalOpen] = useState(false);
  const [accessRequestSubmitting, setAccessRequestSubmitting] = useState(false);
  const [accessRequestForm] = Form.useForm();
  const [myAccessRequests, setMyAccessRequests] = useState([]);
  const [hasAccessForDate, setHasAccessForDate] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState('task-0');

  const { control, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm({
    defaultValues: {
      items: [{ projectId: '', ticketId: '', hours: 0, workDone: '' }],
      blockers: '',
      isAlertIssue: false,
      alertMessage: ''
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');
  const totalHours = watchedItems?.reduce((acc, curr) => acc + (curr.hours || 0), 0) || 0;
  
  // Dynamic quota based on half-day/full-day/permission leave
  const baseRequiredHours = allocatedHoursPerDay;
  let REQUIRED_HOURS = baseRequiredHours;
  if (currentLeave) {
    if (currentLeave.type === 'FullDay') {
      REQUIRED_HOURS = 0;
    } else if (currentLeave.type === 'HalfDay') {
      REQUIRED_HOURS = baseRequiredHours / 2;
    } else if (currentLeave.type === 'Permission') {
      REQUIRED_HOURS = Math.max(0, baseRequiredHours - 2);
    }
  }

  const selectedTicketIds = watchedItems?.map(item => item.ticketId).filter(id => !!id) || [];

  const hoursReportedOtherDays = weeklyReports
    .filter(r => r.date !== selectedDate)
    .reduce((sum, r) => {
      const dayHours = r.items?.reduce((s, item) => s + (Number(item.hoursSpent || item.hours) || 0), 0) || 0;
      return sum + dayHours;
    }, 0);

  const weeklyAllocated = baseRequiredHours;
  const loggedThisWeek = hoursReportedOtherDays + totalHours;
  const remainingWeekly = Math.max(0, weeklyAllocated - loggedThisWeek);

  const fetchTeamLeads = async () => {
    try {
      const res = await adminService.getUsers();
      const allUsers = res.data || [];
      
      let tls = [];
      if (currentUser?.role === 'TeamLead') {
        tls = allUsers.filter(u => {
          const role = (u.role || '').toLowerCase().replace(/\s+/g, '');
          return role === 'projectmanager' || role === 'tenantadmin';
        });
      } else {
        tls = allUsers.filter(u => {
          const role = (u.role || '').toLowerCase().replace(/\s+/g, '');
          return role === 'teamlead';
        });

        if (tls.length === 0) {
          tls = allUsers.filter(u => {
            const role = (u.role || '').toLowerCase().replace(/\s+/g, '');
            return role === 'projectmanager' || role === 'tenantadmin';
          });
        }
      }

      setTeamLeads(tls);
    } catch (e) {
      console.error('Failed to fetch team leads', e);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await projectService.getProjects();
      setAllProjects(res.data || []);
    } catch (e) {
      console.error('Failed to fetch projects');
    }
  };

  const fetchTickets = async () => {
    try {
      const res = await ticketService.getTickets();
      let ticketsData = res.data || [];
      ticketsData = ticketsData.filter(t => t.status !== 'Done');
      if (role === 'TeamLead' || role === 'ProjectManager' || role === 'TenantAdmin') {
        const myUserId = currentUser?.userId || currentUser?.id;
        ticketsData = ticketsData.filter(t => 
          (t.assignedToUserId && String(t.assignedToUserId) === String(myUserId)) || 
          (t.assignedTo && String(t.assignedTo) === String(myUserId))
        );
      }
      setMyTickets(ticketsData);
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load tickets.' });
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchProjects();
      await fetchTickets();
      await fetchTimerRequests();
      await fetchTeamLeads();
    };
    init();
    
    adminService.getMyProfile().then(res => {
      const fresh = Number(res?.data?.allocatedHours);
      if (!isNaN(fresh) && fresh >= 0) {
        setAllocatedHoursPerDay(fresh > 0 ? fresh : 8.5);
        // Keep auth store in sync so it's consistent across page navigation
        setUser({ ...currentUser, allocatedHours: String(fresh) });
      }
      const tlId = res?.data?.teamLeadId;
      if (tlId) setSelectedTeamLeadId(tlId);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    updateWeekDates(baseDate);
  }, [baseDate]);

  useEffect(() => {
    fetchReportForDate(selectedDate);
  }, [selectedDate, currentUser.id, adminUnlocked]);

  const fetchTimerRequests = async () => {
    try {
      const res = await timerRequestService.getEmployeeRequests();
      setMyTimerRequests(res.data.data || []);
    } catch (err) {
      console.error('Failed to load timer requests', err);
    }
  };

  const updateWeekDates = (monday) => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      dates.push(monday.add(i, 'day'));
    }
    setWeekDates(dates);
    fetchWeeklyStatus(dates);
  };

  const handlePrevWeek = () => {
    const prev = baseDate.subtract(7, 'day');
    setBaseDate(prev);
    setSelectedDate(prev.format('YYYY-MM-DD'));
    setAdminUnlocked(false);
  };

  const handleNextWeek = () => {
    const next = baseDate.add(7, 'day');
    setBaseDate(next);
    setSelectedDate(next.format('YYYY-MM-DD'));
    setAdminUnlocked(false);
  };

  const fetchWeeklyStatus = async (dates) => {
    try {
      const start = dates[0].format('YYYY-MM-DD');
      const end = dates[6].format('YYYY-MM-DD');
      const res = await reportService.getReportsByRange(currentUser.id, start, end);
      setWeeklyReports(res.data || []);

      let userLeaves = [];
      try {
        const leavesRes = await leaveService.getMyLeaves();
        userLeaves = leavesRes.data || [];
      } catch (err) {
        console.error('Failed to fetch leaves for status map');
      }

      const today = dayjs();
      const currentWeekStart = today.startOf('week').add(1, 'day'); // Monday
      const currentWeekEnd = today.startOf('week').add(7, 'day');   // Sunday
      const isCurrentWeek = dates[0].isSame(currentWeekStart, 'day') ||
                            (dates[0].isBefore(currentWeekEnd) && dates[6].isAfter(currentWeekStart));

      const statusMap = {};
      dates.forEach(d => {
        const dateStr = d.format('YYYY-MM-DD');
        const report = (res.data || []).find(r => r.date === dateStr);
        const approvedLeave = userLeaves.find(
          l => dayjs(l.leaveDate).format('YYYY-MM-DD') === dateStr && l.status === 'Approved'
        );
        const isSunday = d.day() === 0;
        const isSaturday = d.day() === 6;
        const isPast = d.isBefore(today, 'day');

        if (isSunday) {
          statusMap[dateStr] = 'holiday';
        } else if (approvedLeave) {
          if (approvedLeave.type === 'FullDay') {
            statusMap[dateStr] = 'leave';
          } else if (approvedLeave.type === 'HalfDay') {
            statusMap[dateStr] = 'half_leave';
          } else if (approvedLeave.type === 'Permission') {
            statusMap[dateStr] = 'permission';
          } else {
            statusMap[dateStr] = 'leave';
          }
        } else if (report) {
          statusMap[dateStr] = 'submitted';
        } else if (isSaturday) {
          statusMap[dateStr] = 'optional';
        } else if (isCurrentWeek && isPast) {
          statusMap[dateStr] = 'incomplete';
        } else if (!isCurrentWeek) {
          statusMap[dateStr] = 'restricted';
        } else {
          statusMap[dateStr] = 'pending';
        }
      });
      setWeeklyStatus(statusMap);
    } catch (e) {
      console.error('Failed to fetch weekly status', e);
    }
  };

  const fetchReportForDate = async (date) => {
    setLoading(true);
    try {
      let leaveOnDate = null;
      try {
        const leavesRes = await leaveService.getMyLeaves();
        leaveOnDate = (leavesRes.data || []).find(
          l => dayjs(l.leaveDate).format('YYYY-MM-DD') === date && l.status === 'Approved'
        );
      } catch (err) {
        console.error('Failed to fetch leave for report date');
      }
      setCurrentLeave(leaveOnDate || null);

      const res = await reportService.getReportByDate(currentUser.id, date);

      const isHoliday = dayjs(date).day() === 0; // Sunday
      const isSaturday = dayjs(date).day() === 6;
      const today = dayjs();
      const currentWeekMonday = today.startOf('week').add(1, 'day');
      const currentWeekSunday = today.startOf('week').add(7, 'day');
      const dateObj = dayjs(date);
      const outsideCurrentWeek = dateObj.isBefore(currentWeekMonday, 'day') || dateObj.isAfter(currentWeekSunday, 'day');
      setIsOutsideCurrentWeek(outsideCurrentWeek);

      // Check if employee has approved report access for this date
      let approvedAccess = false;
      if (outsideCurrentWeek) {
        try {
          const accessRes = await reportAccessService.checkAccess(date);
          approvedAccess = accessRes?.data?.hasAccess || false;
        } catch (_) {}
      }
      setHasAccessForDate(approvedAccess);

      // Fetch employee's access requests for status display
      try {
        const arRes = await reportAccessService.getMyRequests();
        setMyAccessRequests(arRes?.data || []);
      } catch (_) {}

      const hasReport = !!res.data;

      // Force fetch tickets if they aren't loaded yet to map properly
      let ticketsList = myTickets;
      if (ticketsList.length === 0) {
        const ticketsRes = await ticketService.getTickets();
        ticketsList = ticketsRes.data || [];
      }

      if (hasReport) {
        const mappedItems = (res.data.items || []).map(item => {
          const ticket = ticketsList.find(t => String(t.id) === String(item.ticketId));
          return {
            projectId: ticket ? ticket.projectId : '',
            ticketId: item.ticketId,
            hours: item.hoursSpent,
            workDone: item.workDone
          };
        });
        const mappedReport = {
          ...res.data,
          items: mappedItems
        };
        reset(mappedReport);
        setExistingReport(mappedReport);
        setViewOnly(true);
      } else {
        reset({ items: [{ projectId: '', ticketId: '', hours: 0, workDone: '' }], blockers: '', isAlertIssue: false, alertMessage: '' });
        setExistingReport(null);
        
        const isFullDayLeave = leaveOnDate && leaveOnDate.type === 'FullDay';
        // Outside current week with no report = locked unless approved access
        if (isHoliday || (outsideCurrentWeek && !approvedAccess) || isFullDayLeave) {
          setViewOnly(true);
        } else {
          setViewOnly(false);
        }
      }
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load report.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (values) => {
    setNewTicketLoading(true);
    try {
      const payload = {
        title: values.title,
        description: values.description || '',
        priority: 'Medium',
        estimatedHours: values.estimatedHours || 8,
        assignedToUserId: currentUser.userId || currentUser.id,
        dueDate: dayjs().add(7, 'day').toISOString()
      };
      const res = await ticketService.createTicket(values.projectId, payload);
      const newTicketId = res.data.id;
      
      const newTicket = {
        ...res.data,
        estimatedHours: Number(res.data.estimatedHours) || values.estimatedHours,
        consumedHours: 0,
        timerAccumulatedSeconds: 0
      };

      setMyTickets(prev => [newTicket, ...prev]);

      notification.success({ message: 'Ticket Created', description: 'New ticket added to your list.' });
      setIsTicketModalOpen(false);
      ticketForm.resetFields();
      
      if (activeTicketRowIndex !== null) {
        setValue(`items.${activeTicketRowIndex}.projectId`, values.projectId);
        setValue(`items.${activeTicketRowIndex}.ticketId`, newTicketId);
        setValue(`items.${activeTicketRowIndex}.hours`, 0);
      }
      setActiveTicketRowIndex(null);
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to create ticket.' });
    } finally {
      setNewTicketLoading(false);
    }
  };

  const handleOpenApplyLeaveModal = (date) => {
    leaveForm.resetFields();
    leaveForm.setFieldsValue({
      fromDate: dayjs(date),
      toDate: null,
      type: 'FullDay',
      reason: ''
    });
    setIsLeaveModalOpen(true);
  };

  const handleApplyLeaveSubmit = async (values) => {
    setLeaveApplying(true);
    try {
      const fromStr = values.fromDate ? values.fromDate.format('YYYY-MM-DD') : selectedDate;
      const toStr = values.toDate ? values.toDate.format('YYYY-MM-DD') : fromStr;
      await leaveService.applyLeave({
        fromDate: fromStr,
        toDate: toStr,
        type: values.type,
        reason: values.reason || `Applied from EOD Weekly Work Report Page (${values.type})`
      });
      const typeLabel = values.type === 'FullDay' ? 'Full Day Leave' : values.type === 'HalfDay' ? 'Half Day Leave' : 'Permission';
      notification.success({
        message: 'Leave Request Submitted',
        description: `Your ${typeLabel} request has been submitted and is pending HR approval.`
      });
      setIsLeaveModalOpen(false);
      fetchReportForDate(selectedDate);
      fetchWeeklyStatus(weekDates);
    } catch (e) {
      notification.error({
        message: 'Failed to apply leave',
        description: e.response?.data?.message || 'Error occurred.'
      });
    } finally {
      setLeaveApplying(false);
    }
  };

  const onSubmit = async (data) => {
    const submittedTotal = data.items.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0);
    if (submittedTotal > REQUIRED_HOURS) {
      // Block submission and show the dedicated additional-hours request modal
      setBlockedSubmitTotal(submittedTotal);
      setIsHoursBlockedModalOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      const reportData = {
        reportDate: selectedDate,
        items: data.items.map(item => ({
          ticketId: item.ticketId,
          hoursSpent: item.hours,
          workDone: item.workDone
        }))
      };
      await reportService.submitDailyReport(reportData);
      
      if (data.isAlertIssue && data.alertMessage) {
        const firstItem = data.items?.[0];
        const selectedTicket = myTickets.find(t => t.id === firstItem?.ticketId);
        const resolvedProjectId = selectedTicket 
          ? Number(selectedTicket.projectId) 
          : (allProjects?.[0]?.id || 1);

        await analyticsService.createAlert({
          type: 'Employee Report Alert',
          severity: 'Critical',
          message: data.alertMessage,
          employeeName: currentUser.fullName,
          projectId: resolvedProjectId,
          projectName: 'EOD Report'
        });
      }

      notification.success({ message: 'Success', description: `Report submitted.` });
      setViewOnly(true);
      fetchWeeklyStatus(weekDates);
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to submit report.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenRequestModal = (type, ticket) => {
    setActiveRequestDetails({ type, ticket });
    requestForm.resetFields();
    requestForm.setFieldsValue({
      ticketId: ticket.id,
      requestType: type,
      requestedHours: type === 'ExceededLimit' ? 4 : 0,
      teamLeadId: selectedTeamLeadId
    });
    setIsRequestModalOpen(true);
  };

  const handleRequestSubmit = async (values) => {
    setRequesting(true);
    try {
      await timerRequestService.createRequest({
        ticketId: values.ticketId,
        requestType: values.requestType,
        requestedHours: values.requestedHours,
        reason: values.reason,
        teamLeadId: (role === 'TeamLead' || role === 'ProjectManager' || role === 'TenantAdmin') ? undefined : values.teamLeadId
      });
      notification.success({ 
        message: 'Request Submitted', 
        description: (role === 'ProjectManager' || role === 'TenantAdmin')
          ? 'Your request has been auto-approved.'
          : role === 'TeamLead' 
            ? 'Your request has been forwarded to the Project Manager.' 
            : 'Your request has been forwarded to your Team Lead. You will be notified once approved by the PM.' 
      });
      setIsRequestModalOpen(false);
      fetchTimerRequests();
      // Refetch tickets to update timer values
      fetchTickets();
    } catch (err) {
      notification.error({ message: 'Failed to submit request' });
    } finally {
      setRequesting(false);
    }
  };

  const getStatusDisplay = (date) => {
    const status = weeklyStatus[date.format('YYYY-MM-DD')];
    if (status === 'holiday') return <Badge color="#8c8c8c" text="Holiday" />;
    if (status === 'optional') return <Badge color="#722ed1" text="Optional" />;
    if (status === 'leave') return <Badge color="#fa8c16" text="Full Day" />;
    if (status === 'half_leave') return <Badge color="#1890ff" text="Half Day" />;
    if (status === 'permission') return <Badge color="#13c2c2" text="Permission" />;
    if (status === 'submitted') return <Badge status="success" text="Logged" />;
    if (status === 'incomplete') return <Badge color="#ff4d4f" text="Incomplete" />;
    if (status === 'restricted') return <Badge status="default" text="Restricted" />;
    return <Badge status="default" text="Pending" />;
  };

  const requestColumns = [
    {
      title: 'Ticket',
      dataIndex: 'ticketCode',
      key: 'ticketCode',
      render: (code, record) => <Text code>{code} - {record.ticketTitle}</Text>
    },
    {
      title: 'Request Type',
      dataIndex: ['request', 'requestType'],
      key: 'requestType',
      render: (t) => <Tag color={t === 'TimerMissed' ? 'volcano' : 'purple'}>{t === 'TimerMissed' ? 'Timer Missed' : 'Hours Exceeded'}</Tag>
    },
    {
      title: 'Requested Hours',
      dataIndex: ['request', 'requestedHours'],
      key: 'requestedHours',
      render: (h) => h ? `${h} hrs` : '-'
    },
    {
      title: 'Status',
      dataIndex: ['request', 'status'],
      key: 'status',
      render: (status) => {
        const conf = {
          PendingTL: { color: 'orange', label: 'Pending TL Approval' },
          PendingPM: { color: 'blue', label: 'Pending PM Approval' },
          Approved: { color: 'green', label: 'Approved & Unlocked' },
          Rejected: { color: 'red', label: 'Rejected' },
        }[status] || { color: 'default', label: status };
        return <Badge status={conf.color === 'green' ? 'success' : conf.color === 'red' ? 'error' : 'processing'} text={conf.label} />;
      }
    },
    {
      title: 'Comments',
      dataIndex: ['request', 'comments'],
      key: 'comments',
      render: (c) => c ? <Text type="secondary">{c}</Text> : <Text italic type="secondary">No comment</Text>
    }
  ];  const isLocked = viewOnly && !adminUnlocked;

  // Render the Tabbed EOD dashboard
  return (
    <div style={{ height: 'calc(100vh - 100px)', display: 'flex', gap: 16, overflow: 'hidden' }}>
      
      {/* LEFT SIDEBAR: Weekly Stats & Daily Timeline */}
      <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
        
        {/* Compact Weekly Summary Card */}
        <Card
          size="small"
          style={{
            borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.06) 100%)',
            border: '1px solid rgba(99,102,241,0.15)',
          }}
          bodyStyle={{ padding: 12 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <ClockCircleOutlined style={{ fontSize: 16, color: '#6366f1' }} />
            <Text strong style={{ fontSize: 13 }}>Weekly Overview</Text>
          </div>

          {/* ── Allocated Hours Banner ───────────────────────────────── */}
          <div style={{
            background: totalHours >= REQUIRED_HOURS
              ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.08))'
              : 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.12))',
            border: `1.5px solid ${totalHours >= REQUIRED_HOURS ? 'rgba(16,185,129,0.4)' : 'rgba(99,102,241,0.35)'}`,
            borderRadius: 10,
            padding: '10px 12px',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 10, color: '#8c8c8c', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                Daily Quota (PM Assigned)
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, color: totalHours >= REQUIRED_HOURS ? '#10b981' : '#6366f1' }}>
                  {REQUIRED_HOURS}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: totalHours >= REQUIRED_HOURS ? '#10b981' : '#6366f1' }}>hrs/day</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: '#8c8c8c', marginBottom: 2 }}>Logged</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: totalHours >= REQUIRED_HOURS ? '#10b981' : '#f59e0b' }}>
                {totalHours.toFixed(1)}h
              </div>
              <div style={{
                fontSize: 10, fontWeight: 700, marginTop: 2,
                color: totalHours >= REQUIRED_HOURS ? '#10b981' : '#f59e0b',
                background: totalHours >= REQUIRED_HOURS ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                borderRadius: 20, padding: '1px 7px', display: 'inline-block'
              }}>
                {totalHours >= REQUIRED_HOURS ? '✓ Goal Met' : `${Math.max(0, REQUIRED_HOURS - totalHours).toFixed(1)}h left`}
              </div>
            </div>
          </div>
          {/* ──────────────────────────────────────────────────────────── */}

          {/* Daily Progress Bar */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text type="secondary" style={{ fontSize: 10 }}>Today's Progress</Text>
              <Text style={{ fontSize: 10, fontWeight: 700, color: totalHours >= REQUIRED_HOURS ? '#10b981' : '#6366f1' }}>
                {REQUIRED_HOURS > 0 ? Math.round(Math.min((totalHours / REQUIRED_HOURS) * 100, 100)) : 100}%
              </Text>
            </div>
            <Progress
              percent={REQUIRED_HOURS > 0 ? Math.round(Math.min((totalHours / REQUIRED_HOURS) * 100, 100)) : 100}
              size="small"
              showInfo={false}
              strokeColor={totalHours >= REQUIRED_HOURS
                ? { '0%': '#10b981', '100%': '#34d399' }
                : { '0%': '#6366f1', '100%': '#8b5cf6' }}
            />
          </div>

          {/* This-week stat */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 10 }}>This Week</Text>
            <Text strong style={{ fontSize: 12, color: '#6366f1' }}>{loggedThisWeek.toFixed(1)}h</Text>
          </div>

          <Progress
            percent={Math.round(Math.min((loggedThisWeek / weeklyAllocated) * 100, 100))}
            size="small"
            strokeColor={{ '0%': '#6366f1', '100%': '#10b981' }}
            format={(p) => <span style={{ fontSize: 10, color: '#8c8c8c' }}>{p}% of Quota</span>}
          />
        </Card>


        {/* Vertical Calendar Timeline Card */}
        <Card 
          size="small" 
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span style={{ fontSize: 12 }}>Daily Timeline</span>
              <Space size={4}>
                <Button size="small" shape="circle" icon={<LeftOutlined />} onClick={handlePrevWeek} />
                <Button size="small" shape="circle" icon={<RightOutlined />} onClick={handleNextWeek} />
              </Space>
            </div>
          }
          style={{ flex: 1, borderRadius: 12, display: 'flex', flexDirection: 'column', minHeight: 0 }}
          bodyStyle={{ padding: '8px', flex: 1, overflowY: 'auto' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {weekDates.map(date => {
              const isSelected = selectedDate === date.format('YYYY-MM-DD');
              const dateStr = date.format('YYYY-MM-DD');
              const status = weeklyStatus[dateStr];
              const isIncomplete = status === 'incomplete';
              const isRestricted = status === 'restricted';
              const isHolidayDate = status === 'holiday';
              const isOptional = status === 'optional';
              
              let bg = 'transparent';
              let border = `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#f0f0f0'}`;
              let opacity = 1;
              let indicatorColor = '#d9d9d9';
              
              if (isSelected) {
                bg = isDarkMode ? 'rgba(99, 102, 241, 0.15)' : '#eef2ff';
                border = `1px solid #6366f1`;
                indicatorColor = '#6366f1';
              } else if (isHolidayDate) {
                bg = isDarkMode ? 'rgba(140,140,140,0.05)' : '#fafafa';
                opacity = 0.7;
              } else if (isOptional) {
                bg = isDarkMode ? 'rgba(114, 46, 209, 0.05)' : '#f9f0ff';
                border = '1px solid #e8d2ff';
                indicatorColor = '#722ed1';
              } else if (isIncomplete) {
                bg = isDarkMode ? 'rgba(255, 77, 79, 0.08)' : '#fff1f0';
                border = '1px solid #ffa39e';
                indicatorColor = '#ff4d4f';
              } else if (status === 'submitted') {
                indicatorColor = '#52c41a';
              }

              return (
                <div
                  key={date.toString()}
                  onClick={() => setSelectedDate(dateStr)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: bg,
                    border,
                    opacity,
                    cursor: isRestricted ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 4, height: 24, borderRadius: 2, background: indicatorColor }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: isSelected ? 700 : 500 }}>{date.format('dddd')}</div>
                      <div style={{ fontSize: 10, color: '#8c8c8c' }}>{date.format('DD MMM YYYY')}</div>
                    </div>
                  </div>
                  <div style={{ scale: '0.85', origin: 'right' }}>
                    {status === 'holiday' && <Tag style={{ margin: 0 }}>Holiday</Tag>}
                    {status === 'optional' && <Tag color="purple" style={{ margin: 0 }}>Optional</Tag>}
                    {status === 'leave' && <Tag color="orange" style={{ margin: 0 }}>Leave</Tag>}
                    {status === 'submitted' && <Tag color="success" style={{ margin: 0 }}>Submitted</Tag>}
                    {status === 'incomplete' && <Tag color="error" style={{ margin: 0 }}>Missing</Tag>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* RIGHT WORKSPACE: Interactive Tabbed Form Console */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: isDarkMode ? 'rgba(255, 255, 255, 0.01)' : '#fff', border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#eef2f6'}`, borderRadius: 12, overflow: 'hidden' }}>
        
        {/* Workspace Title bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : '#eef2f6'}`, background: isDarkMode ? 'rgba(255,255,255,0.01)' : '#f8fafc' }}>
          <div>
            <Title level={5} style={{ margin: 0, fontSize: 14 }}>Workspace &bull; {dayjs(selectedDate).format('DD MMMM YYYY')}</Title>
            <Text type="secondary" style={{ fontSize: 11 }}>Logged today: <Text strong>{totalHours.toFixed(1)}h / {REQUIRED_HOURS}h</Text></Text>
          </div>
          
          <Space>
            {!isLocked && (
              <Button
                size="small"
                icon={<CalendarOutlined />}
                onClick={() => handleOpenApplyLeaveModal(selectedDate)}
                style={{ color: '#10b981', borderColor: '#10b981', fontSize: 11 }}
              >
                Apply Leave
              </Button>
            )}
            <Tag color={totalHours >= REQUIRED_HOURS ? 'success' : 'warning'} style={{ margin: 0 }}>
              {totalHours >= REQUIRED_HOURS ? 'Daily Goal Met' : 'Goal Incomplete'}
            </Tag>
          </Space>
        </div>

        {currentLeave && (
          <Alert
            message={currentLeave.type === 'FullDay' ? 'Full Day Leave Approved' : 'Half Day Leave Approved'}
            description={`Your required EOD quota has been reduced.`}
            type="warning"
            showIcon
            size="small"
            style={{ margin: 8, borderRadius: 8 }}
          />
        )}

        {dayjs(selectedDate).day() === 0 ? (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Result icon={<CheckCircleOutlined style={{ color: '#faad14', fontSize: 40 }} />} title="Happy Sunday!" subTitle="Rest & Recharge. No EOD reporting required today." />
          </div>
        ) : isOutsideCurrentWeek && !existingReport && !hasAccessForDate ? (() => {
          const existingReq = myAccessRequests.find(r => r.targetDate === selectedDate);
          return (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
              <Result
                status={existingReq?.status === 'Rejected' ? 'error' : 'warning'}
                title={existingReq?.status === 'Pending' ? 'Access Pending' : existingReq?.status === 'Rejected' ? 'Access Rejected' : 'Reporting Restricted'}
                subTitle={
                  <Space direction="vertical" style={{ width: '100%', textAlign: 'center' }}>
                    <span style={{ fontSize: 12 }}>
                      Reporting for this date is outside the current work week.
                    </span>
                    {existingReq?.status === 'Pending' && (
                      <Alert message="Access request is pending review by HR/PM." type="info" showIcon style={{ textAlign: 'left', borderRadius: 8, padding: 8, fontSize: 11 }} />
                    )}
                    {existingReq?.status === 'Rejected' && (
                      <Alert message={`Rejected. ${existingReq.reviewerComments ? `Reason: ${existingReq.reviewerComments}` : ''}`} type="error" showIcon style={{ textAlign: 'left', borderRadius: 8, padding: 8, fontSize: 11 }} />
                    )}
                    {!existingReq && (
                      <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                        Submit an access request to HR / PM to unlock reporting.
                      </span>
                    )}
                  </Space>
                }
                extra={
                  <Space>
                    <Button size="small" type="default" onClick={() => setSelectedDate(dayjs().format('YYYY-MM-DD'))}>
                      Go to Today
                    </Button>
                    {!existingReq || existingReq.status === 'Rejected' ? (
                      <Button
                        size="small"
                        type="primary"
                        icon={<CalendarOutlined />}
                        onClick={() => {
                          accessRequestForm.resetFields();
                          accessRequestForm.setFieldsValue({ targetDate: selectedDate });
                          setIsAccessRequestModalOpen(true);
                        }}
                      >
                        Request Access
                      </Button>
                    ) : null}
                  </Space>
                }
              />
            </div>
          );
        })() : currentLeave && currentLeave.type === 'FullDay' ? (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Result icon={<CheckCircleOutlined style={{ color: '#818cf8', fontSize: 40 }} />} title="Approved Full Day Leave" subTitle="No EOD report is required today." />
          </div>
        ) : (
          <Form layout="vertical" onFinish={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Tabs
                type="editable-card"
                activeKey={activeTabKey || 'submit-tab'}
                hideAdd={isLocked}
                onEdit={(targetKey, action) => {
                  if (action === 'add') {
                    append({ projectId: '', ticketId: '', hours: 0, workDone: '' });
                    setActiveTabKey(`task-${fields.length}`);
                  } else if (action === 'remove') {
                    const idx = parseInt(targetKey.replace('task-', ''), 10);
                    if (fields.length > 1) {
                      remove(idx);
                      setActiveTabKey('task-0');
                    }
                  }
                }}
                onChange={(key) => setActiveTabKey(key)}
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                tabBarStyle={{ margin: 0, padding: '0 8px' }}
                items={[
                  ...fields.map((field, index) => {
                    const currentItemProjectId = watchedItems?.[index]?.projectId;
                    const currentItemTicketId = watchedItems?.[index]?.ticketId;
                    const ticketData = myTickets.find(t => t.id === currentItemTicketId);

                    let availableHours = 0;
                    let timerHours = 0;
                    let showTimerMissedWarning = false;
                    let showLimitExceededWarning = false;
                    let hasApprovedTimerRequest = false;

                    if (ticketData) {
                      timerHours = parseFloat(((ticketData.timerAccumulatedSeconds || 0) / 3600).toFixed(2));
                      availableHours = (Number(ticketData.estimatedHours) || 0) - (Number(ticketData.consumedHours) || 0);
                      
                      hasApprovedTimerRequest = myTimerRequests.some(r => 
                        r.request.ticketId === ticketData.id && r.request.status === 'Approved'
                      );


                    }

                    return {
                      key: `task-${index}`,
                      label: `Task ${index + 1}`,
                      closable: !isLocked && fields.length > 1,
                      children: (
                        <div style={{ padding: 16, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                          


                          <Row gutter={12}>
                            <Col span={12}>
                              <Form.Item label="Project" required help={errors.items?.[index]?.projectId?.message} validateStatus={errors.items?.[index]?.projectId ? 'error' : ''}>
                                <Controller
                                  name={`items.${index}.projectId`}
                                  control={control}
                                  rules={{ required: !isLocked ? 'Required' : false }}
                                  render={({ field }) => (
                                    <Select
                                      {...field}
                                      disabled={isLocked}
                                      placeholder="Select Project"
                                      onChange={(val) => {
                                        field.onChange(val);
                                        setValue(`items.${index}.ticketId`, '');
                                        setValue(`items.${index}.hours`, 0);
                                      }}
                                    >
                                      {allProjects.map(p => (
                                        <Select.Option key={p.id} value={p.id}>{p.name || p.projectName}</Select.Option>
                                      ))}
                                    </Select>
                                  )}
                                />
                              </Form.Item>
                            </Col>

                            <Col span={12}>
                              <Form.Item label="Ticket" required help={errors.items?.[index]?.ticketId?.message} validateStatus={errors.items?.[index]?.ticketId ? 'error' : ''}>
                                <Controller
                                  name={`items.${index}.ticketId`}
                                  control={control}
                                  rules={{ required: !isLocked ? 'Required' : false }}
                                  render={({ field }) => {
                                    const projectTickets = myTickets.filter(t => String(t.projectId) === String(currentItemProjectId));
                                    return (
                                      <Select
                                        {...field}
                                        disabled={isLocked || !currentItemProjectId}
                                        placeholder="Select Ticket"
                                        showSearch
                                        optionFilterProp="children"
                                        onChange={(val) => {
                                          field.onChange(val);
                                          const ticket = myTickets.find(t => t.id === val);
                                          if (ticket) {
                                            setValue(`items.${index}.hours`, parseFloat(((ticket.timerAccumulatedSeconds || 0) / 3600).toFixed(2)));
                                          } else {
                                            setValue(`items.${index}.hours`, 0);
                                          }
                                        }}
                                      >
                                        {projectTickets.map(t => (
                                          <Select.Option key={t.id} value={t.id} disabled={selectedTicketIds.includes(t.id) && currentItemTicketId !== t.id}>
                                            {t.code} — {t.title}
                                          </Select.Option>
                                        ))}
                                      </Select>
                                    );
                                  }}
                                />
                              </Form.Item>
                            </Col>
                          </Row>

                          <Row gutter={12} align="middle">
                            <Col span={8}>
                              <Form.Item label="Hours" required={!showTimerMissedWarning} help={errors.items?.[index]?.hours?.message} validateStatus={errors.items?.[index]?.hours ? 'error' : ''}>
                                <Controller
                                  name={`items.${index}.hours`}
                                  control={control}
                                  rules={{
                                    required: (!isLocked && !showTimerMissedWarning) ? 'Required' : false,
                                    min: (!isLocked && !showTimerMissedWarning) ? { value: 0.1, message: 'Min 0.1' } : undefined
                                  }}
                                  render={({ field }) => (
                                    <InputNumber
                                      {...field}
                                      disabled={isLocked || !currentItemTicketId}
                                      style={{ width: '100%' }}
                                      min={0}
                                      step={0.5}
                                    />
                                  )}
                                />
                              </Form.Item>
                            </Col>

                            <Col span={16}>
                              {!isLocked && (
                                <Space style={{ marginTop: 8 }}>
                                  <Button
                                    size="small"
                                    icon={<PlusOutlined />}
                                    onClick={() => {
                                      setActiveTicketRowIndex(index);
                                      setIsTicketModalOpen(true);
                                    }}
                                  >
                                    Create New Ticket
                                  </Button>
                                </Space>
                              )}
                            </Col>
                          </Row>

                          <Form.Item label="Work Done" required help={errors.items?.[index]?.workDone?.message} validateStatus={errors.items?.[index]?.workDone ? 'error' : ''}>
                            <Controller
                              name={`items.${index}.workDone`}
                              control={control}
                              rules={{ required: !isLocked ? 'Required' : false, minLength: { value: 5, message: 'Too short' } }}
                              render={({ field }) => <TextArea {...field} disabled={isLocked} rows={3} placeholder="Describe completed work..." />}
                            />
                          </Form.Item>
                        </div>
                      )
                    };
                  }),
                  {
                    key: 'submit-tab',
                    label: <span style={{ fontWeight: 700, color: '#6366f1' }}>Submit & Review</span>,
                    closable: false,
                    children: (
                      <div style={{ padding: 16, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <Title level={5} style={{ margin: 0, fontSize: 13 }}>Final EOD Checks</Title>
                        
                        <Card size="small" style={{ background: isDarkMode ? 'rgba(255,255,255,0.01)' : '#f8fafc' }}>
                          <Row align="middle" justify="space-between">
                            <Text>Logged Work Today:</Text>
                            <Text strong style={{ fontSize: 14, color: totalHours >= REQUIRED_HOURS ? '#52c41a' : '#faad14' }}>
                              {totalHours.toFixed(1)} hrs
                            </Text>
                          </Row>
                        </Card>

                        <Form.Item label="Blockers" style={{ marginBottom: 0 }}>
                          <Controller name="blockers" control={control} render={({ field }) => <TextArea {...field} disabled={isLocked} rows={2} placeholder="Any blockers faced?" />} />
                        </Form.Item>

                        <Card title={<Space><AlertOutlined style={{ color: 'red' }} /><span>Raise Alert Issue?</span></Space>} size="small" bodyStyle={{ padding: 10 }}>
                          <Controller 
                            name="isAlertIssue" 
                            control={control} 
                            render={({ field }) => (
                              <Radio.Group {...field} disabled={isLocked} style={{ marginBottom: field.value ? 8 : 0 }}>
                                <Radio value={false}>No</Radio>
                                <Radio value={true}>Yes</Radio>
                              </Radio.Group>
                            )} 
                          />
                          {watch('isAlertIssue') && (
                            <Controller 
                              name="alertMessage" 
                              control={control} 
                              rules={{ required: watch('isAlertIssue') ? 'Required' : false }}
                              render={({ field }) => (
                                <Form.Item validateStatus={errors.alertMessage ? 'error' : ''} help={errors.alertMessage?.message} style={{ marginBottom: 0 }}>
                                  <TextArea {...field} disabled={isLocked} rows={2} placeholder="Describe the critical alert..." />
                                </Form.Item>
                              )} 
                            />
                          )}
                        </Card>
                      </div>
                    )
                  },
                  {
                    key: 'history-tab',
                    label: <span style={{ fontWeight: 700, color: '#ec4899' }}>Additional Hours History</span>,
                    closable: false,
                    children: (
                      <div style={{ padding: 16, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Title level={5} style={{ margin: 0, fontSize: 14 }}>Your Additional Hours History Logs</Title>
                          <Button size="small" onClick={fetchTimerRequests} type="link">Refresh Logs</Button>
                        </div>
                        <Table
                          columns={requestColumns}
                          dataSource={myTimerRequests}
                          rowKey={(r) => r.request?.requestId || Math.random()}
                          size="small"
                          pagination={{ pageSize: 5 }}
                        />
                      </div>
                    )
                  }
                ]}
              />
            </div>

            {/* Bottom Actions footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px', background: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc', borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : '#eef2f6'}` }}>
              <Space>
                <Button size="small" onClick={() => navigate(-1)}>Back</Button>
                {isLocked && existingReport && (
                  <Button size="small" type="default" onClick={() => setViewOnly(false)}>
                    Edit Tasks
                  </Button>
                )}
                {!isLocked && existingReport && (
                  <Button 
                    size="small"
                    onClick={() => {
                      setViewOnly(true);
                      reset(existingReport);
                    }}
                  >
                    Cancel
                  </Button>
                )}
                {!isLocked && (
                  <Button size="small" type="primary" icon={<SendOutlined />} htmlType="submit" loading={submitting} disabled={totalHours === 0}>
                    {existingReport ? 'Update Report' : 'Submit Report'}
                  </Button>
                )}
              </Space>
            </div>
          </Form>
        )}
      </div>


      {/* Modal for Creating New Ticket */}
      <Modal
        title={<span><ProjectOutlined /> Create New Ticket</span>}
        open={isTicketModalOpen}
        onCancel={() => setIsTicketModalOpen(false)}
        onOk={() => ticketForm.submit()}
        confirmLoading={newTicketLoading}
        destroyOnClose
      >
        <Form form={ticketForm} layout="vertical" onFinish={handleCreateTicket}>
          <Form.Item name="projectId" label="Project Name" rules={[{ required: true, message: 'Please select project' }]}>
            <Select placeholder="Select Project">
              {allProjects.map(p => (
                <Select.Option key={p.id} value={p.id}>
                  {p.name || p.projectName}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="title" label="Ticket Title" rules={[{ required: true, message: 'Please enter ticket title' }]}>
            <Input placeholder="Enter brief task description" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea placeholder="Optional details..." />
          </Form.Item>
          <Form.Item name="estimatedHours" label="Estimated Hours" initialValue={8}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal for Apply Leave */}
      <Modal
        title={
          <Space>
            <CalendarOutlined style={{ color: '#10b981' }} />
            <span>Apply Leave Request</span>
          </Space>
        }
        open={isLeaveModalOpen}
        onCancel={() => setIsLeaveModalOpen(false)}
        onOk={() => leaveForm.submit()}
        okText="Submit Leave Request"
        confirmLoading={leaveApplying}
        destroyOnClose
      >
        <Form form={leaveForm} layout="vertical" onFinish={handleApplyLeaveSubmit}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="fromDate"
                label="Start Date"
                rules={[{ required: true, message: 'Please select start date' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="toDate"
                label="End Date (Optional)"
              >
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" placeholder="Optional" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="type"
            label="Leave Type"
            rules={[{ required: true, message: 'Please select leave type' }]}
          >
            <Radio.Group style={{ width: '100%' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Radio value="FullDay">
                  <Space>
                    <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#fa8c16', marginRight: 4 }} />
                    <Text strong>Full Day Leave</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>(Entire day off — no EOD required)</Text>
                  </Space>
                </Radio>
                <Radio value="HalfDay">
                  <Space>
                    <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#1890ff', marginRight: 4 }} />
                    <Text strong>Half Day Leave</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>(Work quota reduced by 50%)</Text>
                  </Space>
                </Radio>
                <Radio value="Permission">
                  <Space>
                    <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#13c2c2', marginRight: 4 }} />
                    <Text strong>Permission</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>(Short absence — 2h deducted from quota)</Text>
                  </Space>
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          <Form.Item name="reason" label="Reason (optional)">
            <TextArea rows={2} placeholder="Briefly explain the reason for leave..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal for Submitting Timer/Hours Request */}
      <Modal
        title={
          <Space>
            <WarningOutlined style={{ color: activeRequestDetails?.type === 'TimerMissed' ? '#fa541c' : '#722ed1' }} />
            <span>Raise {activeRequestDetails?.type === 'TimerMissed' ? 'Timer Missed' : 'Hours Exceeded'} Request</span>
          </Space>
        }
        open={isRequestModalOpen}
        onCancel={() => setIsRequestModalOpen(false)}
        onOk={() => requestForm.submit()}
        confirmLoading={requesting}
        destroyOnClose
      >
        <Form form={requestForm} layout="vertical" onFinish={handleRequestSubmit}>
          <Form.Item name="ticketId" label="Ticket" hidden><Input /></Form.Item>
          <Form.Item name="requestType" label="Request Type" hidden><Input /></Form.Item>
          
          <div style={{ marginBottom: 16, background: '#f8fafc', padding: 12, borderRadius: 8 }}>
            {activeRequestDetails?.ticket?.projectId && (() => {
              const proj = allProjects.find(p => String(p.id) === String(activeRequestDetails.ticket.projectId));
              return proj ? (
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Project</Text>
                  <Text strong style={{ fontSize: 14, color: '#6366f1' }}>{proj.name || proj.projectName}</Text>
                </div>
              ) : null;
            })()}
            <Text type="secondary" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Ticket</Text>
            <Text strong>{activeRequestDetails?.ticket?.ticketCode} — {activeRequestDetails?.ticket?.title}</Text>
          </div>

          {role !== 'TeamLead' && role !== 'ProjectManager' && role !== 'TenantAdmin' && (
            <Form.Item
              name="teamLeadId"
              label="Select Team Lead"
              rules={[{ required: true, message: 'Please select a Team Lead' }]}
            >
              <Select placeholder="Select a Team Lead" onChange={(val) => setSelectedTeamLeadId(val)}>
                {teamLeads.map(tl => (
                  <Select.Option key={tl.id} value={tl.id}>
                    {tl.fullName || tl.name} ({tl.email})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {activeRequestDetails?.type === 'ExceededLimit' && (
            <Form.Item 
              name="requestedHours" 
              label="Additional Hours Required" 
              rules={[{ required: true, message: 'Please enter additional hours requested' }]}
              initialValue={4}
            >
              <InputNumber min={1} style={{ width: '100%' }} placeholder="E.g. 4" />
            </Form.Item>
          )}

          <Form.Item 
            name="reason" 
            label="Explain Reason (detailed note for TL/PM)" 
            rules={[{ required: true, message: 'Please explain the reason' }, { min: 8, message: 'Explain in a bit more detail' }]}
          >
            <TextArea rows={4} placeholder="E.g., I was unable to activate the timer because of a production hotspot checkout, OR the client design requested an extra sub-module integration..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal for Report Date Access Request */}
      <Modal
        title={
          <Space>
            <CalendarOutlined style={{ color: '#6366f1' }} />
            <span>Request Access to Report for Past/Future Date</span>
          </Space>
        }
        open={isAccessRequestModalOpen}
        onCancel={() => setIsAccessRequestModalOpen(false)}
        onOk={() => accessRequestForm.submit()}
        okText="Submit Access Request"
        confirmLoading={accessRequestSubmitting}
        destroyOnClose
      >
        <Form
          form={accessRequestForm}
          layout="vertical"
          onFinish={async (values) => {
            setAccessRequestSubmitting(true);
            try {
              await reportAccessService.createRequest({
                targetDate: values.targetDate,
                reason: values.reason
              });
              notification.success({
                message: 'Access Request Submitted',
                description: 'Your request to report for this date has been sent to HR and Project Manager. You will be notified once it is reviewed.'
              });
              setIsAccessRequestModalOpen(false);
              // Refresh access requests
              const arRes = await reportAccessService.getMyRequests();
              setMyAccessRequests(arRes?.data || []);
            } catch (e) {
              notification.error({
                message: 'Failed to submit request',
                description: e.response?.data?.message || 'An error occurred.'
              });
            } finally {
              setAccessRequestSubmitting(false);
            }
          }}
        >
          <Form.Item name="targetDate" hidden><Input /></Form.Item>

          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Requesting access for</Text>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#6366f1', marginTop: 4 }}>
              {dayjs(selectedDate).format('dddd, DD MMMM YYYY')}
            </div>
          </div>

          <Form.Item
            name="reason"
            label="Reason for Late/Early Reporting"
            rules={[
              { required: true, message: 'Please explain the reason' },
              { min: 10, message: 'Please provide a more detailed explanation (min 10 chars)' }
            ]}
          >
            <TextArea
              rows={4}
              placeholder="E.g., I was on-site at the client location and did not have system access. I need to report the work done on that date..."
            />
          </Form.Item>

          <Alert
            message="This request will be sent to HR and your Project Manager. You can only report for this date once the request is approved."
            type="info"
            showIcon
            style={{ borderRadius: 8 }}
          />
        </Form>
      </Modal>

      {/* ── Hours Exceeded Blocking Modal ─────────────────────────────────── */}
      <Modal
        open={isHoursBlockedModalOpen}
        footer={null}
        onCancel={() => setIsHoursBlockedModalOpen(false)}
        centered
        width={480}
        destroyOnClose
      >
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          {/* Icon */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.1))',
            border: '2px solid rgba(245,158,11,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <ExclamationCircleFilled style={{ fontSize: 32, color: '#f59e0b' }} />
          </div>

          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Hours Limit Exceeded</div>
          <div style={{ color: '#8c8c8c', fontSize: 13, marginBottom: 20 }}>
            You have entered <strong style={{ color: '#ef4444' }}>{blockedSubmitTotal.toFixed(1)}h</strong> but your
            daily quota is <strong style={{ color: '#6366f1' }}>{REQUIRED_HOURS}h</strong>.
          </div>

          {/* Info box */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.06))',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 12, padding: '14px 16px', marginBottom: 20, textAlign: 'left',
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#6366f1' }}>
              📋 To report beyond your allocated hours:
            </div>
            <div style={{ fontSize: 12, color: '#555', lineHeight: 1.7 }}>
              <div>1️⃣ &nbsp;Raise an <strong>Additional Hours Request</strong> to your Team Leader</div>
              <div>2️⃣ &nbsp;TL reviews &amp; forwards to <strong>Project Manager</strong></div>
              <div>3️⃣ &nbsp;PM forwards to <strong>Accounts</strong> for budget clearance</div>
              <div>4️⃣ &nbsp;Once Accounts approves, <strong>HR / PM</strong> will update your quota</div>
              <div>5️⃣ &nbsp;You can then <strong>re-submit</strong> this EOD report</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Button
              size="large"
              onClick={() => setIsHoursBlockedModalOpen(false)}
              style={{ borderRadius: 8, minWidth: 110 }}
            >
              Go Back &amp; Edit
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<RaiseIcon />}
              onClick={() => {
                setIsHoursBlockedModalOpen(false);
                // Pre-fill and open the existing timer-request form
                const firstTicket = watchedItems?.find(i => i.ticketId);
                const ticket = firstTicket ? myTickets.find(t => String(t.id) === String(firstTicket.ticketId)) : null;
                const project = firstTicket?.projectId
                  ? allProjects.find(p => String(p.id) === String(firstTicket.projectId))
                  : (ticket?.projectId ? allProjects.find(p => String(p.id) === String(ticket.projectId)) : null);
                setActiveRequestDetails({ type: 'ExceededLimit', ticket: ticket ? { ...ticket, projectId: ticket.projectId || firstTicket?.projectId } : null, project });
                requestForm.resetFields();
                requestForm.setFieldsValue({
                  ticketId: ticket?.id || '',
                  requestType: 'ExceededLimit',
                  requestedHours: parseFloat((blockedSubmitTotal - REQUIRED_HOURS).toFixed(1)) || 0.5,
                  teamLeadId: selectedTeamLeadId,
                });
                setIsRequestModalOpen(true);
              }}
              style={{ borderRadius: 8, background: '#6366f1', borderColor: '#6366f1', minWidth: 160 }}
            >
              Request Additional Hours
            </Button>
          </div>
        </div>
      </Modal>
      {/* ──────────────────────────────────────────────────────────────────── */}

    </div>
  );
};

export default EODReportPage;