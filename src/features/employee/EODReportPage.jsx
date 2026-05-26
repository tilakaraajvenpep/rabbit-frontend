import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, InputNumber, Select, Button, Space, Typography,
  Row, Col, Progress, Alert, notification, Tag, Result, Modal, Radio, theme, Table, Badge
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
  const { currentUser, role } = useAuthStore();
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
      if (role === 'TeamLead') {
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
      if (fresh && fresh > 0) setAllocatedHoursPerDay(fresh);
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
      leaveDate: date,
      type: 'FullDay',
      reason: ''
    });
    setIsLeaveModalOpen(true);
  };

  const handleApplyLeaveSubmit = async (values) => {
    setLeaveApplying(true);
    try {
      await leaveService.applyLeave({
        fromDate: values.leaveDate,
        toDate: values.leaveDate,
        type: values.type,
        reason: values.reason || `Applied from EOD Weekly Work Report Page (${values.type})`,
        autoApprove: true   // Auto-approve from EOD page — HR will be notified
      });
      const typeLabel = values.type === 'FullDay' ? 'Full Day Leave' : values.type === 'HalfDay' ? 'Half Day Leave' : 'Permission';
      notification.success({
        message: 'Leave Approved',
        description: `Your ${typeLabel} has been approved and HR has been notified.`
      });
      setIsLeaveModalOpen(false);
      fetchReportForDate(values.leaveDate);
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
    // Double check all validations
    for (const item of data.items) {
      const ticket = myTickets.find(t => t.id === item.ticketId);
      if (!ticket) continue;

      const hasApprovedTimerRequest = myTimerRequests.some(r => 
        r.request.ticketId === ticket.id && r.request.status === 'Approved'
      );

      // Missed Timer Validation
      if ((ticket.timerAccumulatedSeconds || 0) === 0 && !hasApprovedTimerRequest) {
        notification.error({
          message: 'Submission Blocked',
          description: `You did not run the Kanban timer on ticket "${ticket.ticketCode}". You must raise a Timer Missed request and receive PM approval before reporting.`,
          duration: 6
        });
        return;
      }

      // Limit Exceeded Validation based on Available Hours
      const availableHours = (Number(ticket.estimatedHours) || 0) - (Number(ticket.consumedHours) || 0);
      if (item.hours > availableHours && !hasApprovedTimerRequest) {
        notification.error({
          message: 'Submission Blocked',
          description: `You are trying to report ${item.hours}h on ticket "${ticket.ticketCode}" which has available limit of ${availableHours.toFixed(2)}h. Please submit an Exceeded Limit request to report additional hours.`,
          duration: 6
        });
        return;
      }
    }

    const submittedTotal = data.items.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0);
    if (submittedTotal > REQUIRED_HOURS) {
      notification.error({
        message: 'Hours Exceeded',
        description: `You can only report up to ${REQUIRED_HOURS}h/day. You've entered ${submittedTotal.toFixed(1)}h. Please reduce your task hours.`,
        duration: 5
      });
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
        teamLeadId: role === 'TeamLead' ? undefined : values.teamLeadId
      });
      notification.success({ 
        message: 'Request Submitted', 
        description: role === 'TeamLead' 
          ? 'Your request has been forwarded to the Project Manager.' 
          : 'Your request has been forwarded to your Team Lead. You will be notified once approved by the PM.' 
      });
      setIsRequestModalOpen(false);
      fetchTimerRequests();
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
  ];

  const isLocked = viewOnly && !adminUnlocked;

  return (
    <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
      
      {/* Top Header bar with compact stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isDarkMode ? 'rgba(255,255,255,0.01)' : '#fff', padding: '8px 16px', borderRadius: 12, border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : '#eef2f6'}` }}>
        <Space size={8}>
          <ClockCircleOutlined style={{ fontSize: 18, color: '#6366f1' }} />
          <div>
            <Title level={5} style={{ margin: 0, fontSize: 14 }}>Weekly EOD Logging</Title>
            <Text type="secondary" style={{ fontSize: 10 }}>Quota: {REQUIRED_HOURS}h/day &bull; {weeklyAllocated.toFixed(1)}h/week</Text>
          </div>
        </Space>

        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981', lineHeight: 1.1 }}>{totalHours.toFixed(1)}h</div>
            <Text type="secondary" style={{ fontSize: 9 }}>Today</Text>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#6366f1', lineHeight: 1.1 }}>{loggedThisWeek.toFixed(1)}h</div>
            <Text type="secondary" style={{ fontSize: 9 }}>This Week</Text>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: remainingWeekly > 0 ? '#fa9e0b' : '#6b7280', lineHeight: 1.1 }}>{remainingWeekly.toFixed(1)}h</div>
            <Text type="secondary" style={{ fontSize: 9 }}>Remaining</Text>
          </div>
        </div>
      </div>

      {/* Main Split Panel Area */}
      <div style={{ display: 'flex', flex: 1, gap: 12, overflow: 'hidden', minHeight: 0 }}>
        
        {/* LEFT COLUMN: Date Navigator & Status Lists (300px) */}
        <div style={{ width: 310, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          
          {/* Compact Calendar Card */}
          <Card size="small" title="Work Week Navigator" style={{ borderRadius: 12 }} bodyStyle={{ padding: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Button size="small" icon={<LeftOutlined />} onClick={handlePrevWeek} shape="circle" />
              <Text strong style={{ fontSize: 11 }}>{weekDates[0]?.format('MMM DD')} - {weekDates[6]?.format('MMM DD')}</Text>
              <Button size="small" icon={<RightOutlined />} onClick={handleNextWeek} shape="circle" />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {weekDates.map(date => {
                const isSelected = selectedDate === date.format('YYYY-MM-DD');
                const dateStr = date.format('YYYY-MM-DD');
                const status = weeklyStatus[dateStr];
                const isIncomplete = status === 'incomplete';
                const isRestricted = status === 'restricted';
                const isHolidayDate = status === 'holiday';
                const isOptional = status === 'optional';
                
                let bg = 'transparent';
                let border = `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#f0f0f0'}`;
                let opacity = 1;
                
                if (isSelected) {
                  bg = isDarkMode ? 'rgba(79, 70, 229, 0.3)' : '#e6f7ff';
                  border = `1px solid ${token.colorPrimary}`;
                } else if (isHolidayDate) {
                  bg = isDarkMode ? 'rgba(140,140,140,0.1)' : '#f5f5f5';
                  border = '1px solid #d9d9d9';
                  opacity = 0.65;
                } else if (isOptional) {
                  bg = isDarkMode ? 'rgba(114, 46, 209, 0.1)' : '#f9f0ff';
                  border = '1px solid #d3adf7';
                } else if (isIncomplete) {
                  bg = isDarkMode ? 'rgba(255, 77, 79, 0.12)' : '#fff1f0';
                  border = '1px solid #ffccc7';
                } else if (isRestricted) {
                  opacity = 0.5;
                }

                return (
                  <div
                    key={date.toString()}
                    onClick={() => {
                      const today = dayjs();
                      const currentWeekMonday = today.startOf('week').add(1, 'day');
                      const currentWeekSunday = today.startOf('week').add(7, 'day');
                      const isOutside = date.isBefore(currentWeekMonday, 'day') || date.isAfter(currentWeekSunday, 'day');
                      setSelectedDate(dateStr);
                    }}
                    style={{
                      textAlign: 'center',
                      cursor: isHolidayDate ? 'default' : isRestricted ? 'not-allowed' : 'pointer',
                      padding: '6px 2px', borderRadius: 8,
                      background: bg, border, opacity,
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontSize: 9, color: '#8c8c8c' }}>{date.format('dd')}</div>
                    <div style={{ fontSize: 12, fontWeight: isSelected ? 700 : 500, margin: '2px 0' }}>{date.format('DD')}</div>
                    <div style={{ fontSize: 7, scale: '0.8' }}>
                      {status === 'holiday' && <Badge color="#8c8c8c" />}
                      {status === 'optional' && <Badge color="#722ed1" />}
                      {status === 'leave' && <Badge color="#fa8c16" />}
                      {status === 'half_leave' && <Badge color="#1890ff" />}
                      {status === 'permission' && <Badge color="#13c2c2" />}
                      {status === 'submitted' && <Badge status="success" />}
                      {status === 'incomplete' && <Badge color="#ff4d4f" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Quick Date Status Legend Card */}
          <Card size="small" title="Status Details" style={{ borderRadius: 12 }} bodyStyle={{ padding: '8px 12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 11 }}>Selected Date:</Text>
                <Tag color="purple" style={{ margin: 0, fontSize: 10 }}>{dayjs(selectedDate).format('DD MMM YYYY')}</Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 11 }}>Status:</Text>
                <div style={{ scale: '0.9', origin: 'right' }}>{getStatusDisplay(dayjs(selectedDate))}</div>
              </div>
            </div>
          </Card>

          {/* Compact Timer/Hours Request Approvals inside left column */}
          {myTimerRequests.length > 0 && (
            <Card 
              size="small"
              title={<Space style={{ fontSize: 11 }}><ApartmentOutlined /><span>Issues Log</span></Space>}
              style={{ borderRadius: 12, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
              bodyStyle={{ padding: 4, flex: 1, overflowY: 'auto' }}
            >
              <Table 
                columns={[
                  {
                    title: 'Ticket',
                    dataIndex: 'ticketCode',
                    key: 'ticketCode',
                    render: (c) => <Text style={{ fontSize: 10 }} code>{c}</Text>
                  },
                  {
                    title: 'Status',
                    dataIndex: ['request', 'status'],
                    key: 'status',
                    render: (s) => (
                      <Tag color={s === 'Approved' ? 'success' : s === 'Pending' ? 'warning' : 'error'} style={{ fontSize: 9, padding: '0 4px', margin: 0 }}>
                        {s}
                      </Tag>
                    )
                  }
                ]}
                dataSource={myTimerRequests}
                rowKey={(r) => r.request.requestId}
                pagination={false}
                size="small"
              />
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN: Interactive Form Column (Flex 1) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: isDarkMode ? 'rgba(255, 255, 255, 0.01)' : '#fff', border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#eef2f6'}`, borderRadius: 12, overflow: 'hidden' }}>
          
          {currentLeave && (
            <Alert
              message={currentLeave.type === 'FullDay' ? 'Full Day Leave Approved' : 'Half Day Leave Approved'}
              description={`Quota reduced to ${currentLeave.type === 'FullDay' ? '0' : REQUIRED_HOURS} hours.`}
              type="warning"
              showIcon
              size="small"
              style={{ margin: 8, borderRadius: 8 }}
            />
          )}

          {dayjs(selectedDate).day() === 0 ? (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Result icon={<CheckCircleOutlined style={{ color: '#faad14', fontSize: 40 }} />} title="Happy Sunday!" subTitle="Rest & Recharge. No daily reporting is required today." />
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
                        Reporting for <strong>{dayjs(selectedDate).format('DD MMM YYYY')}</strong> is outside the current work week.
                      </span>
                      {existingReq?.status === 'Pending' && (
                        <Alert message="Access request is pending review by HR/PM." type="info" showIcon style={{ textAlign: 'left', borderRadius: 8, padding: 8, fontSize: 11 }} />
                      )}
                      {existingReq?.status === 'Rejected' && (
                        <Alert message={`Rejected. ${existingReq.reviewerComments ? `Reason: ${existingReq.reviewerComments}` : ''}`} type="error" showIcon style={{ textAlign: 'left', borderRadius: 8, padding: 8, fontSize: 11 }} />
                      )}
                      {!existingReq && (
                        <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                          Submit an access request to HR / PM to unlock reporting for this date.
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
              <Result icon={<CheckCircleOutlined style={{ color: '#818cf8', fontSize: 40 }} />} title="On Approved Leave!" subTitle="No EOD report is required today." />
            </div>
          ) : (
            <Form layout="vertical" onFinish={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
              
              {/* Daily progress subheader */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', background: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc', borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : '#eef2f6'}` }}>
                <div>
                  <Text strong style={{ fontSize: 13 }}>Tasks on {dayjs(selectedDate).format('DD MMM')}</Text>
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 11 }}>
                    Logged: <Text strong type={totalHours >= REQUIRED_HOURS ? 'success' : 'warning'}>{totalHours.toFixed(1)}h / {REQUIRED_HOURS}h</Text>
                  </Text>
                </div>
                <div style={{ width: 120 }}>
                  <Progress
                    percent={Math.round(Math.min((totalHours / REQUIRED_HOURS) * 100, 100))}
                    size="small"
                    status={totalHours >= REQUIRED_HOURS ? 'success' : 'active'}
                  />
                </div>
              </div>

              {/* Scrollable form body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                
                {fields.map((field, index) => {
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

                    if ((ticketData.timerAccumulatedSeconds || 0) === 0 && !hasApprovedTimerRequest) {
                      showTimerMissedWarning = true;
                    }

                    const currentInputVal = watchedItems?.[index]?.hours || 0;
                    if (currentInputVal > availableHours && !hasApprovedTimerRequest) {
                      showLimitExceededWarning = true;
                    }
                  }

                  return (
                    <Card
                      key={field.id}
                      size="small"
                      bodyStyle={{ padding: '8px 12px' }}
                      title={
                        <Space style={{ fontSize: 11 }}>
                          <Text strong>Task {index + 1}</Text>
                          {ticketData && <Tag color="cyan" style={{ fontSize: 9 }}>Timer: {timerHours}h</Tag>}
                          {ticketData && <Tag color="purple" style={{ fontSize: 9 }}>Available: {availableHours.toFixed(1)}h</Tag>}
                          {hasApprovedTimerRequest && <Tag color="success" style={{ fontSize: 9 }}>Unlocked</Tag>}
                        </Space>
                      }
                      extra={
                        <Space>
                          {!isLocked && (
                            <Button
                              size="small"
                              icon={<CalendarOutlined />}
                              onClick={() => handleOpenApplyLeaveModal(selectedDate)}
                              style={{ color: '#10b981', borderColor: '#10b981', fontSize: 10, height: 24, padding: '0 8px' }}
                            >
                              Leave
                            </Button>
                          )}
                          {!isLocked && (
                            <Button
                              size="small"
                              icon={<PlusOutlined />}
                              onClick={() => {
                                setActiveTicketRowIndex(index);
                                setIsTicketModalOpen(true);
                              }}
                              style={{ fontSize: 10, height: 24, padding: '0 8px' }}
                            >
                              New Ticket
                            </Button>
                          )}
                          {!isLocked && fields.length > 1 && (
                            <Button size="small" icon={<DeleteOutlined />} danger type="text" onClick={() => remove(index)} />
                          )}
                        </Space>
                      }
                      style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
                    >
                      <Row gutter={10}>
                        <Col span={10}>
                          <Form.Item label={<span style={{ fontSize: 10 }}>Project</span>} required style={{ marginBottom: 6 }} help={errors.items?.[index]?.projectId?.message} validateStatus={errors.items?.[index]?.projectId ? 'error' : ''}>
                            <Controller
                              name={`items.${index}.projectId`}
                              control={control}
                              rules={{ required: !isLocked ? 'Required' : false }}
                              render={({ field }) => (
                                <Select
                                  {...field}
                                  size="small"
                                  disabled={isLocked}
                                  placeholder="Select"
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

                        <Col span={10}>
                          <Form.Item label={<span style={{ fontSize: 10 }}>Ticket</span>} required style={{ marginBottom: 6 }} help={errors.items?.[index]?.ticketId?.message} validateStatus={errors.items?.[index]?.ticketId ? 'error' : ''}>
                            <Controller
                              name={`items.${index}.ticketId`}
                              control={control}
                              rules={{ required: !isLocked ? 'Required' : false }}
                              render={({ field }) => {
                                const projectTickets = myTickets.filter(t => String(t.projectId) === String(currentItemProjectId));
                                return (
                                  <Select
                                    {...field}
                                    size="small"
                                    disabled={isLocked || !currentItemProjectId}
                                    placeholder="Select"
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
                        
                        <Col span={4}>
                          <Form.Item label={<span style={{ fontSize: 10 }}>Hours</span>} required={!showTimerMissedWarning} style={{ marginBottom: 6 }} help={errors.items?.[index]?.hours?.message} validateStatus={errors.items?.[index]?.hours ? 'error' : ''}>
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
                                  size="small"
                                  disabled={isLocked || !currentItemTicketId || showTimerMissedWarning}
                                  style={{ width: '100%' }}
                                  min={0}
                                  step={0.5}
                                />
                              )}
                            />
                          </Form.Item>
                        </Col>

                        {showTimerMissedWarning && (
                          <Col span={24} style={{ marginBottom: 6 }}>
                            <Alert
                              message={
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Text style={{ fontSize: 10, color: '#fa541c' }}><WarningOutlined /> Timer Missed Restriction. Raise issue to TL:</Text>
                                  <Button size="small" type="primary" danger icon={<RaiseIcon />} onClick={() => handleOpenRequestModal('TimerMissed', ticketData)} style={{ fontSize: 9, height: 20, background: '#fa541c', borderColor: '#fa541c' }}>
                                    Raise Timer Missed
                                  </Button>
                                </div>
                              }
                              type="warning"
                              showIcon={false}
                              style={{ padding: '4px 8px', borderRadius: 4 }}
                            />
                          </Col>
                        )}

                        {showLimitExceededWarning && (
                          <Col span={24} style={{ marginBottom: 6 }}>
                            <Alert
                              message={
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Text style={{ fontSize: 10, color: '#722ed1' }}><WarningOutlined /> Exceeds available limit ({availableHours.toFixed(1)}h). Request approval:</Text>
                                  <Button size="small" type="primary" icon={<RaiseIcon />} onClick={() => handleOpenRequestModal('ExceededLimit', ticketData)} style={{ fontSize: 9, height: 20, background: '#722ed1', borderColor: '#722ed1' }}>
                                    Request Limit Lift
                                  </Button>
                                </div>
                              }
                              type="warning"
                              showIcon={false}
                              style={{ padding: '4px 8px', borderRadius: 4 }}
                            />
                          </Col>
                        )}

                        <Col span={24}>
                          <Form.Item label={<span style={{ fontSize: 10 }}>Work Done</span>} required style={{ marginBottom: 0 }} help={errors.items?.[index]?.workDone?.message} validateStatus={errors.items?.[index]?.workDone ? 'error' : ''}>
                            <Controller
                              name={`items.${index}.workDone`}
                              control={control}
                              rules={{ required: !isLocked ? 'Required' : false, minLength: { value: 5, message: 'Too short' } }}
                              render={({ field }) => <TextArea {...field} size="small" disabled={isLocked} rows={1} placeholder="What did you complete?" />}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  );
                })}

                {!isLocked && (
                  <Button type="dashed" onClick={() => append({ projectId: '', ticketId: '', hours: 0, workDone: '' })} block icon={<PlusOutlined />} size="small" style={{ borderRadius: 8 }}>
                    Add Task Row
                  </Button>
                )}

                <Row gutter={8}>
                  <Col span={12}>
                    <Card title={<span style={{ fontSize: 11 }}>Blockers</span>} size="small" bodyStyle={{ padding: 6 }}>
                      <Controller name="blockers" control={control} render={({ field }) => <TextArea {...field} disabled={isLocked} rows={1} style={{ fontSize: 11 }} />} />
                    </Card>
                  </Col>
                  
                  <Col span={12}>
                    <Card title={<span style={{ fontSize: 11 }}><AlertOutlined style={{color: 'red'}}/> Raise Alert Issue?</span>} size="small" bodyStyle={{ padding: 6 }}>
                      <Controller 
                        name="isAlertIssue" 
                        control={control} 
                        render={({ field }) => (
                          <Radio.Group {...field} disabled={isLocked} size="small" style={{ marginBottom: field.value ? 4 : 0 }}>
                            <Radio value={false} style={{ fontSize: 10 }}>No</Radio>
                            <Radio value={true} style={{ fontSize: 10 }}>Yes</Radio>
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
                              <TextArea {...field} size="small" disabled={isLocked} rows={1} placeholder="Describe issue..." style={{ fontSize: 11 }} />
                            </Form.Item>
                          )} 
                        />
                      )}
                    </Card>
                  </Col>
                </Row>
              </div>

              {/* Fixed Action Footer Bar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 16px', background: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc', borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : '#eef2f6'}` }}>
                <Space size={8}>
                  <Button size="small" onClick={() => navigate(-1)}>Back</Button>
                  {isLocked && existingReport && (
                    <Button size="small" type="default" onClick={() => setViewOnly(false)}>
                      Add Tasks / Edit
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
                      {existingReport ? 'Update' : 'Submit'}
                    </Button>
                  )}
                </Space>
              </div>
            </Form>
          )}
        </div>
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
            <span>Apply Leave — {dayjs(selectedDate).format('DD MMMM YYYY')}</span>
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
          <Form.Item name="leaveDate" hidden><Input /></Form.Item>

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
            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Ticket Name</Text>
            <Text strong>{activeRequestDetails?.ticket?.ticketCode} - {activeRequestDetails?.ticket?.title}</Text>
          </div>

          {role !== 'TeamLead' && (
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
    </div>
  );
};

export default EODReportPage;