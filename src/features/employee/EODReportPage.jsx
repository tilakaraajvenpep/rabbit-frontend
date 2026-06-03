import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, InputNumber, Select, Button, Space, Typography,
  Row, Col, Progress, Alert, notification, Tag, Result, Modal, Radio, theme, Badge, DatePicker, Grid, Tooltip
} from 'antd';
const { useBreakpoint } = Grid;
import {
  PlusOutlined, DeleteOutlined, CheckCircleOutlined,
  ExclamationCircleFilled, ClockCircleOutlined,
  LeftOutlined, RightOutlined, ProjectOutlined, AlertOutlined,
  WarningOutlined, CalendarOutlined, EditOutlined
} from '@ant-design/icons';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
dayjs.extend(isBetween);

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

const { TextArea } = Input;
const { Text } = Typography;

const EODReportPage = () => {
  const navigate = useNavigate();
  const { currentUser, role, setUser } = useAuthStore();
  const { token } = theme.useToken();
  const { isDarkMode } = useThemeStore();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [baseDate, setBaseDate] = useState(dayjs().startOf('week').add(1, 'day'));
  const [weekDates, setWeekDates] = useState([]);
  const [weeklyStatus, setWeeklyStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [myTickets, setMyTickets] = useState([]);
  const [allMyTickets, setAllMyTickets] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [isOutsideCurrentWeek, setIsOutsideCurrentWeek] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [existingReport, setExistingReport] = useState(null);
  const [currentLeave, setCurrentLeave] = useState(null);
  const [weeklyReports, setWeeklyReports] = useState([]);
  const [allocatedHoursPerDay, setAllocatedHoursPerDay] = useState(0);
  const [currentWeekRemainingHours, setCurrentWeekRemainingHours] = useState(null);
  const [currentRealWeekReports, setCurrentRealWeekReports] = useState([]);

  // Timer Requests State
  const [myTimerRequests, setMyTimerRequests] = useState([]);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestForm] = Form.useForm();
  const [requesting, setRequesting] = useState(false);
  const [activeRequestDetails, setActiveRequestDetails] = useState(null);
  const [teamLeads, setTeamLeads] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedTeamLeadId, setSelectedTeamLeadId] = useState(currentUser?.teamLeadId || null);
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

  // Modal State for Editing Applied Leave
  const [isEditLeaveModalOpen, setIsEditLeaveModalOpen] = useState(false);
  const [editLeaveSubmitting, setEditLeaveSubmitting] = useState(false);
  const [editingLeave, setEditingLeave] = useState(null);
  const [editLeaveForm] = Form.useForm();

  // Modal State for Report Access Request
  const [isAccessRequestModalOpen, setIsAccessRequestModalOpen] = useState(false);
  const [accessRequestSubmitting, setAccessRequestSubmitting] = useState(false);
  const [accessRequestForm] = Form.useForm();
  const [myAccessRequests, setMyAccessRequests] = useState([]);
  const [hasAccessForDate, setHasAccessForDate] = useState(false);

  // States for Manual Ticket Entry
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualForm] = Form.useForm();
  const [manualMode, setManualMode] = useState('request');
  const [visibleTickets, setVisibleTickets] = useState([]);

  // Alert Modal State
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertModalIndex, setAlertModalIndex] = useState(null);
  const [alertForm] = Form.useForm();

  const { control, handleSubmit, watch, reset, setValue, trigger } = useForm({
    defaultValues: {
      items: [{ projectId: '', ticketId: '', hours: 0, workDone: '', isAlertIssue: false, alertMessage: '' }],
      blockers: ''
    }
  });

  const handleAlertButtonClick = (index, ticketObj) => {
    if (viewOnly) return;
    const currentIsAlert = watch(`items.${index}.isAlertIssue`);
    const currentMsg = watch(`items.${index}.alertMessage`) || '';
    
    setAlertModalIndex(index);
    alertForm.setFieldsValue({
      ticketCode: ticketObj ? (ticketObj.code || '#' + ticketObj.id) : 'Ticket',
      ticketTitle: ticketObj ? (ticketObj.title || ticketObj.ticketTitle || '') : '',
      alertMessage: currentMsg
    });
    setAlertModalOpen(true);
  };

  const handleAlertModalSubmit = (values) => {
    const idx = alertModalIndex;
    if (idx !== null) {
      setValue(`items.${idx}.isAlertIssue`, true);
      setValue(`items.${idx}.alertMessage`, values.alertMessage);
      trigger(`items.${idx}.isAlertIssue`);
    }
    setAlertModalOpen(false);
  };

  const handleRemoveAlert = () => {
    const idx = alertModalIndex;
    if (idx !== null) {
      setValue(`items.${idx}.isAlertIssue`, false);
      setValue(`items.${idx}.alertMessage`, '');
      trigger(`items.${idx}.isAlertIssue`);
    }
    setAlertModalOpen(false);
  };

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const watchedItems = watch('items');
  const totalHours = watchedItems?.reduce((acc, curr) => {
    const hrs = Number(curr?.hoursInput) || 0;
    const mins = Number(curr?.minutesInput) || 0;
    return acc + hrs + (mins / 60);
  }, 0) || 0;

  // ─── Pre-render derived values ───────────────────────────────────────────
  const userId = currentUser?.userId || currentUser?.id;

  // Derivation of assigned Team Lead for the employee
  const assignedTeamLead = allUsers.find(u => String(u.id || u.userId) === String(selectedTeamLeadId)) || 
                           teamLeads.find(u => String(u.id || u.userId) === String(selectedTeamLeadId));

  const selectOptions = assignedTeamLead 
    ? [{ value: assignedTeamLead.id || assignedTeamLead.userId, label: assignedTeamLead.fullName || assignedTeamLead.name }]
    : (selectedTeamLeadId ? [{ value: selectedTeamLeadId, label: 'Loading...' }] : []);
  
  // 1. Calculate hours reported on OTHER days of this week
  const hoursReportedOtherDays = weeklyReports
    .filter(r => r.date !== selectedDate)
    .reduce((sum, r) => {
      const dayHours = r.items?.reduce((s, item) => s + (Number(item.hoursSpent || item.hours) || 0), 0) || 0;
      return sum + dayHours;
    }, 0);

  // 2. Base weekly allocated hours
  const weeklyQuota = Number(currentUser?.allocatedHours) || Number(currentUser?.prevAllocatedHours) || allocatedHoursPerDay || 0;
  const weeklyAllocated = weeklyQuota;

  // 3. Remaining weekly quota before today's input
  const remainingBeforeToday = weeklyQuota > 0 ? Math.max(0, weeklyQuota - hoursReportedOtherDays) : 24;

  const fetchTeamLeads = async () => {
    try {
      const res = await adminService.getUsers();
      const usersList = res.data || [];
      setAllUsers(usersList);
      
      let tls = [];
      if (currentUser?.role === 'TeamLead') {
        tls = usersList.filter(u => {
          const role = (u.role || '').toLowerCase().replace(/\s+/g, '');
          return role === 'projectmanager' || role === 'tenantadmin';
        });
      } else {
        tls = usersList.filter(u => {
          const role = (u.role || '').toLowerCase().replace(/\s+/g, '');
          return role === 'teamlead';
        });

        if (tls.length === 0) {
          tls = usersList.filter(u => {
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
      const projList = res.data || [];
      setAllProjects(projList);

      const userId = currentUser?.userId || currentUser?.id;
      const totalHours = projList.reduce((sum, p) => {
        const hours = Number(p.employeeAllocatedHours?.[userId]) || 0;
        return sum + hours;
      }, 0);
      setAllocatedHoursPerDay(totalHours);
    } catch (e) {
      console.error('Failed to fetch projects');
    }
  };

  const fetchTickets = async () => {
    try {
      const res = await ticketService.getTickets();
      const rawTickets = res.data || [];
      setAllMyTickets(rawTickets);

      const myUserId = currentUser?.userId || currentUser?.id;
      const ticketsData = rawTickets.filter(t => {
        if (t.status === 'Done') return false;
        
        const isAssigned = (t.assignedToUserId && String(t.assignedToUserId) === String(myUserId)) || 
                           (t.assignedTo && String(t.assignedTo) === String(myUserId)) ||
                           (t.assignedEmployees && Array.isArray(t.assignedEmployees) && t.assignedEmployees.some(emp => String(emp.userId) === String(myUserId)));
        return isAssigned;
      });
      setMyTickets(ticketsData);
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load tickets.' });
    }
  };

  const fetchCurrentWeekRemaining = async () => {
    try {
      const today = dayjs();
      const start = today.startOf('week').add(1, 'day').format('YYYY-MM-DD');
      const end = today.startOf('week').add(7, 'day').format('YYYY-MM-DD');
      const res = await reportService.getReportsByRange(currentUser.id, start, end);
      const reports = res.data || [];
      setCurrentRealWeekReports(reports);
      const logged = reports.reduce((sum, r) => {
        const dayHours = r.items?.reduce((s, item) => s + (Number(item.hoursSpent || item.hours) || 0), 0) || 0;
        return sum + dayHours;
      }, 0);
      const quota = Number(currentUser?.allocatedHours) || Number(currentUser?.prevAllocatedHours) || 0;
      setCurrentWeekRemainingHours(Math.max(0, quota - logged));
    } catch (_) {}
  };

  useEffect(() => {
    const init = async () => {
      await fetchProjects();
      await fetchTickets();
      await fetchTimerRequests();
      await fetchTeamLeads();
      await fetchCurrentWeekRemaining();
    };
    init();
    
    adminService.getMyProfile().then(res => {
      const fresh = Number(res?.data?.allocatedHours) || 0;
      const prev = Number(res?.data?.prevAllocatedHours) || 0;
      setUser({ ...currentUser, allocatedHours: String(fresh), prevAllocatedHours: String(prev) });
      const tlId = res?.data?.teamLeadId;
      if (tlId) setSelectedTeamLeadId(tlId);
    }).catch(() => {});
  }, []);

  const handleGoToToday = () => {
    const today = dayjs();
    setSelectedDate(today.format('YYYY-MM-DD'));
    setBaseDate(today.startOf('week').add(1, 'day'));
  };

  useEffect(() => {
    updateWeekDates(baseDate);
  }, [baseDate]);

  useEffect(() => {
    fetchReportForDate(selectedDate);
  }, [selectedDate, currentUser.id, adminUnlocked, myTickets.length]);

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

      let accessRequestsList = [];
      try {
        const arRes = await reportAccessService.getMyRequests();
        accessRequestsList = arRes?.data || [];
        setMyAccessRequests(accessRequestsList);
      } catch (_) {}

      const today = dayjs();
      const currentWeekStart = today.startOf('week').add(1, 'day');
      const currentWeekEnd = today.startOf('week').add(7, 'day');
      const isCurrentWeek = dates[0].isSame(currentWeekStart, 'day') ||
                            (dates[0].isBefore(currentWeekEnd) && dates[6].isAfter(currentWeekStart));

      const statusMap = {};
      dates.forEach(d => {
        const dateStr = d.format('YYYY-MM-DD');
        const report = (res.data || []).find(r => r.date === dateStr);
        const approvedLeave = userLeaves.find(
          l => dayjs(l.leaveDate).format('YYYY-MM-DD') === dateStr && l.status === 'Approved'
        );
        const hasApprovedAccess = accessRequestsList.some(
          r => dayjs(r.targetDate).format('YYYY-MM-DD') === dateStr && r.status === 'Approved'
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
        } else if (!isCurrentWeek && !hasApprovedAccess) {
          statusMap[dateStr] = 'restricted';
        } else if (!isCurrentWeek && hasApprovedAccess && isPast) {
          statusMap[dateStr] = 'incomplete';
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
          l => dayjs(l.leaveDate).format('YYYY-MM-DD') === date
        );
      } catch (err) {
        console.error('Failed to fetch leave for report date');
      }
      setCurrentLeave(leaveOnDate || null);

      const res = await reportService.getReportByDate(currentUser.id, date);

      const isHoliday = dayjs(date).day() === 0;
      const today = dayjs();
      const currentWeekMonday = today.startOf('week').add(1, 'day');
      const currentWeekSunday = today.startOf('week').add(7, 'day');
      const dateObj = dayjs(date);
      const outsideCurrentWeek = dateObj.isBefore(currentWeekMonday, 'day') || dateObj.isAfter(currentWeekSunday, 'day');
      setIsOutsideCurrentWeek(outsideCurrentWeek);

      let approvedAccess = false;
      if (outsideCurrentWeek) {
        try {
          const accessRes = await reportAccessService.checkAccess(date);
          approvedAccess = accessRes?.data?.hasAccess || false;
        } catch (_) {}
      }
      setHasAccessForDate(approvedAccess);
      await fetchCurrentWeekRemaining();

      try {
        const arRes = await reportAccessService.getMyRequests();
        setMyAccessRequests(arRes?.data || []);
      } catch (_) {}

      let projectsList = allProjects;
      if (projectsList.length === 0) {
        const resProj = await projectService.getProjects();
        projectsList = resProj.data || [];
        setAllProjects(projectsList);

        const userId = currentUser?.userId || currentUser?.id;
        const totalHours = projectsList.reduce((sum, p) => {
          const hours = Number(p.employeeAllocatedHours?.[userId]) || 0;
          return sum + hours;
        }, 0);
        setAllocatedHoursPerDay(totalHours);
      }

      let ticketsList = myTickets;
      if (ticketsList.length === 0) {
        const ticketsRes = await ticketService.getTickets();
        const rawTickets = ticketsRes.data || [];
        setAllMyTickets(rawTickets);
        
        const myUserId = currentUser?.userId || currentUser?.id;
        let filteredTickets = rawTickets.filter(t => {
          const isAssigned = (t.assignedToUserId && String(t.assignedToUserId) === String(myUserId)) || 
                             (t.assignedTo && String(t.assignedTo) === String(myUserId)) ||
                             (t.assignedEmployees && Array.isArray(t.assignedEmployees) && t.assignedEmployees.some(emp => String(emp.userId) === String(myUserId)));
          return isAssigned;
        });
        setMyTickets(filteredTickets);
        ticketsList = filteredTickets;
      }

      const hasReport = !!res.data;

      // Filter visible tickets for this EOD Page (only active tickets reportable for current date)
      const visibleFiltered = ticketsList.filter(ticket => {
        if (ticket.status === 'Done') return false;

        const repDate = dayjs(date).startOf('day');
        const start = ticket.startDate ? dayjs(ticket.startDate).startOf('day') : null;
        const due = ticket.dueDate ? dayjs(ticket.dueDate).endOf('day') : null;
        const isDateValid = !start || !due || (repDate.isAfter(start.subtract(1, 'day')) && repDate.isBefore(due.add(1, 'day')));
        
        let hasDatePermission = false;
        if (!isDateValid) {
          hasDatePermission = myTimerRequests.some(r => 
            String(r.request?.ticketId) === String(ticket.id) && 
            r.request?.requestType === 'DateRangeExtension' && 
            (r.request?.status === 'Approved' || r.request?.status === 'AccountsApproved')
          );
        }
        
        if (!isDateValid && !hasDatePermission) {
          return false;
        }

        if (role === 'ProjectManager' || role === 'TeamLead' || role === 'TenantAdmin') {
          return true;
        }

        const allotted = getAllottedHoursForTicket(ticket.id);
        const totalConsumed = Number(ticket.consumedHours) || 0;
        
        const dbReportTodayItem = res.data?.items?.find(item => String(item.ticketId) === String(ticket.id));
        const dbTodayHours = dbReportTodayItem ? (Number(dbReportTodayItem.hoursSpent) || 0) : 0;
        const consumedOther = Math.max(0, totalConsumed - dbTodayHours);
        
        const hasHoursToday = dbReportTodayItem && (Number(dbReportTodayItem.hoursSpent) > 0);
        return (consumedOther < allotted) || hasHoursToday;
      });

      setVisibleTickets(visibleFiltered);
      const visibleTickets = visibleFiltered;

      const mappedItems = visibleTickets.map(ticket => {
        const matchingItem = res.data?.items?.find(item => String(item.ticketId) === String(ticket.id));
        const totalH = matchingItem ? (Number(matchingItem.hoursSpent) || 0) : 0;
        const hVal = Math.floor(totalH);
        const mVal = Math.round((totalH - hVal) * 60);
        return {
          projectId: ticket.projectId,
          ticketId: ticket.id,
          hoursInput: matchingItem ? hVal : 0,
          minutesInput: matchingItem ? mVal : 0,
          workDone: matchingItem ? matchingItem.workDone : '',
          isAlertIssue: false,
          alertMessage: ''
        };
      });

      const mappedReport = {
        ...res.data,
        items: mappedItems
      };

      if (res.data) {
        reset(mappedReport);
        setExistingReport(mappedReport);
        setViewOnly(true);
      } else {
        reset({ items: mappedItems, blockers: '' });
        setExistingReport(null);

        const isFullDayLeave = leaveOnDate && leaveOnDate.type === 'FullDay' && leaveOnDate.status === 'Approved';
        if (isHoliday || (outsideCurrentWeek && !approvedAccess) || isFullDayLeave) {
          setViewOnly(true);
          if (outsideCurrentWeek && !approvedAccess && !isHoliday) {
            Modal.confirm({
              title: 'Permission Required',
              content: 'You should get permission from HR or PM to report for that day.',
              okText: 'Request Access Now',
              cancelText: 'OK',
              okButtonProps: { style: { background: '#6366f1', borderColor: '#6366f1' } },
              onOk: () => {
                setIsAccessRequestModalOpen(true);
              }
            });
          }
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
      let dateInfo = '';
      let targetDueDate = dayjs().add(7, 'day').toISOString();

      if (values.dateType === 'single' && values.singleDate) {
        const formattedDate = dayjs(values.singleDate).format('YYYY-MM-DD');
        dateInfo = `\n[Applicable Date: ${formattedDate}]`;
        targetDueDate = dayjs(values.singleDate).toISOString();
      } else if (values.dateType === 'range' && values.dateRange && values.dateRange.length === 2) {
        const from = dayjs(values.dateRange[0]).format('YYYY-MM-DD');
        const to = dayjs(values.dateRange[1]).format('YYYY-MM-DD');
        dateInfo = `\n[Applicable Date Range: ${from} to ${to}]`;
        targetDueDate = dayjs(values.dateRange[1]).toISOString();
      }

      const payload = {
        title: values.title,
        description: (values.description || '') + dateInfo,
        priority: 'Medium',
        estimatedHours: 0,
        assignedToUserId: currentUser.userId || currentUser.id,
        dueDate: targetDueDate
      };
      const res = await ticketService.createTicket(values.projectId, payload);
      const newTicketId = res.data.id;
      
      const newTicket = {
        ...res.data,
        estimatedHours: 0,
        consumedHours: 0,
        timerAccumulatedSeconds: 0
      };

      setMyTickets(prev => [newTicket, ...prev]);
      setAllMyTickets(prev => [newTicket, ...prev]);

      notification.success({ message: 'Ticket Created', description: 'New ticket added to your list.' });
      setIsTicketModalOpen(false);
      ticketForm.resetFields();
      
      if (activeTicketRowIndex !== null) {
        setValue(`items.${activeTicketRowIndex}.projectId`, values.projectId);
        setValue(`items.${activeTicketRowIndex}.ticketId`, newTicketId);
        setValue(`items.${activeTicketRowIndex}.hoursInput`, 0);
        setValue(`items.${activeTicketRowIndex}.minutesInput`, 0);
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
      permissionHours: 0,
      permissionMinutes: 0,
      reason: ''
    });
    setIsLeaveModalOpen(true);
  };

  const handleApplyLeaveSubmit = async (values) => {
    setLeaveApplying(true);
    try {
      const fromStr = values.fromDate ? values.fromDate.format('YYYY-MM-DD') : selectedDate;
      const toStr = values.toDate ? values.toDate.format('YYYY-MM-DD') : fromStr;
      
      let leaveReason = values.reason || '';
      let typeLabel = values.type === 'FullDay' ? 'Full Day Leave' : values.type === 'HalfDay' ? 'Half Day Leave' : 'Permission';
      
      if (values.type === 'Permission') {
        const hrs = values.permissionHours || 0;
        const mins = values.permissionMinutes || 0;
        const durationStr = `${hrs}h ${mins}m`;
        leaveReason = `[Permission Duration: ${durationStr}] - ${leaveReason}`;
        typeLabel = `Permission (${durationStr})`;
      }

      await leaveService.applyLeave({
        fromDate: fromStr,
        toDate: toStr,
        type: values.type,
        reason: leaveReason || `Applied from EOD Weekly Work Report Page (${values.type})`
      });
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

  const handleOpenEditLeaveModal = (leave) => {
    setEditingLeave(leave);
    editLeaveForm.resetFields();
    
    let permissionHours = 0;
    let permissionMinutes = 0;
    let cleanReason = leave.reason || '';
    
    if (leave.type === 'Permission' && cleanReason.startsWith('[Permission Duration:')) {
      const match = cleanReason.match(/^\[Permission Duration:\s*([^\]]+)\]\s*-\s*(.*)$/);
      if (match) {
        const durationStr = match[1];
        cleanReason = match[2];
        
        const hMatch = durationStr.match(/(\d+)\s*(?:h|hr|hour)/i);
        if (hMatch) {
          permissionHours = parseInt(hMatch[1]) || 0;
        } else if (durationStr.includes('hrs')) {
          const hrsNum = parseInt(durationStr);
          if (!isNaN(hrsNum)) permissionHours = hrsNum;
        }
        
        const mMatch = durationStr.match(/(\d+)\s*(?:m|min|minute)/i);
        if (mMatch) {
          permissionMinutes = parseInt(mMatch[1]) || 0;
        } else if (durationStr.includes('mins')) {
          if (permissionHours === 0) {
            const minsNum = parseInt(durationStr);
            if (!isNaN(minsNum)) permissionMinutes = minsNum;
          }
        }
      }
    }
    
    editLeaveForm.setFieldsValue({
      fromDate: dayjs(leave.leaveDate),
      type: leave.type,
      permissionHours,
      permissionMinutes,
      reason: cleanReason
    });
    setIsEditLeaveModalOpen(true);
  };

  const handleEditLeaveSubmit = async (values) => {
    setEditLeaveSubmitting(true);
    try {
      const dateStr = values.fromDate ? values.fromDate.format('YYYY-MM-DD') : selectedDate;
      
      let leaveReason = values.reason || '';
      if (values.type === 'Permission') {
        const hrs = values.permissionHours || 0;
        const mins = values.permissionMinutes || 0;
        const durationStr = `${hrs}h ${mins}m`;
        leaveReason = `[Permission Duration: ${durationStr}] - ${leaveReason}`;
      }

      await leaveService.updateLeave(editingLeave.leaveId, {
        leaveDate: dateStr,
        type: values.type,
        reason: leaveReason || `Applied from EOD Weekly Work Report Page (${values.type})`
      });

      notification.success({
        message: 'Leave Request Updated',
        description: 'Your leave request has been successfully updated.'
      });
      setIsEditLeaveModalOpen(false);
      fetchReportForDate(selectedDate);
      fetchWeeklyStatus(weekDates);
    } catch (e) {
      notification.error({
        message: 'Failed to update leave',
        description: e.response?.data?.message || 'Error occurred.'
      });
    } finally {
      setEditLeaveSubmitting(false);
    }
  };

  const handleDeleteLeave = (leaveId) => {
    Modal.confirm({
      title: 'Cancel Leave Request',
      content: 'This will permanently remove the leave request. Continue?',
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
          await leaveService.deleteLeave(leaveId);
          notification.success({
            message: 'Leave Request Cancelled',
            description: 'Your leave request has been cancelled.'
          });
          fetchReportForDate(selectedDate);
          fetchWeeklyStatus(weekDates);
        } catch (e) {
          notification.error({
            message: 'Failed to cancel leave',
            description: e.response?.data?.message || 'Error occurred.'
          });
        }
      },
    });
  };

  const getAllottedHoursForTicket = (ticketId) => {
    const ticket = allMyTickets.find(t => String(t.id) === String(ticketId));
    if (!ticket) return 0;
    
    const uId = currentUser?.userId || currentUser?.id;
    if (ticket.assignedEmployees && Array.isArray(ticket.assignedEmployees)) {
      const empAssign = ticket.assignedEmployees.find(emp => String(emp.userId) === String(uId));
      if (empAssign) {
        return Number(empAssign.hours) || 0;
      }
    }
    return Number(ticket.estimatedHours) || 0;
  };

  const isTicketDateBlocked = (ticketId) => {
    if (!ticketId) return false;
    const ticketObj = allMyTickets.find(t => String(t.id) === String(ticketId));
    if (!ticketObj) return false;

    const repDate = dayjs(selectedDate).startOf('day');
    const start = ticketObj.startDate ? dayjs(ticketObj.startDate).startOf('day') : null;
    const due = ticketObj.dueDate ? dayjs(ticketObj.dueDate).endOf('day') : null;
    const isDateValid = !start || !due || (repDate.isAfter(start.subtract(1, 'day')) && repDate.isBefore(due.add(1, 'day')));
    
    if (isDateValid) return false;

    const hasDatePermission = myTimerRequests.some(r => 
      String(r.request?.ticketId) === String(ticketObj.id) && 
      r.request?.requestType === 'DateRangeExtension' && 
      (r.request?.status === 'Approved' || r.request?.status === 'AccountsApproved')
    );

    return !hasDatePermission;
  };

  const onSubmit = async (data) => {
    // 1. Check if any row has negative values or minutes >= 60
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      const hrs = Number(item.hoursInput) || 0;
      const mins = Number(item.minutesInput) || 0;

      if (hrs < 0 || mins < 0) {
        notification.error({
          message: 'Validation Error',
          description: `Task #${i + 1}: Hours and minutes cannot be negative.`
        });
        return;
      }

      if (mins >= 60) {
        notification.error({
          message: 'Validation Error',
          description: `Task #${i + 1}: Minutes must be less than 60.`
        });
        return;
      }
    }

    const mappedItems = data.items
      .map(item => {
        const hrs = Number(item.hoursInput) || 0;
        const mins = Number(item.minutesInput) || 0;
        const decimalHours = Number((hrs + mins / 60).toFixed(4));
        return {
          ...item,
          hours: decimalHours
        };
      })
      .filter(item => item.hours > 0);

    if (mappedItems.length === 0) {
      notification.warning({
        message: 'No Hours Logged',
        description: 'Please log hours and minutes for at least one project task.'
      });
      return;
    }

    const invalidItems = mappedItems.filter(item => !item.ticketId || !item.workDone);
    if (invalidItems.length > 0) {
      notification.error({
        message: 'Validation Error',
        description: 'Please select a Ticket (Task Category) and enter a Message (Work Done) for all projects where you have logged hours.'
      });
      return;
    }

    // Date Range Constraint Validation
    const repDate = dayjs(selectedDate).startOf('day');
    for (let i = 0; i < mappedItems.length; i++) {
      const item = mappedItems[i];
      const ticket = allMyTickets.find(t => String(t.id) === String(item.ticketId));
      if (ticket) {
        const start = ticket.startDate ? dayjs(ticket.startDate).startOf('day') : null;
        const due = ticket.dueDate ? dayjs(ticket.dueDate).endOf('day') : null;
        const isDateValid = !start || !due || (repDate.isAfter(start.subtract(1, 'day')) && repDate.isBefore(due.add(1, 'day')));
        if (!isDateValid) {
          const hasDatePermission = myTimerRequests.some(r => 
            String(r.request?.ticketId) === String(ticket.id) && 
            r.request?.requestType === 'DateRangeExtension' && 
            (r.request?.status === 'Approved' || r.request?.status === 'AccountsApproved')
          );
          if (!hasDatePermission) {
            notification.error({
              message: 'Action Blocked',
              description: `Task #${i + 1}: Reporting date (${dayjs(selectedDate).format('DD MMM YYYY')}) is outside ticket "${ticket.code}"'s valid schedule (${dayjs(ticket.startDate).format('DD MMM YYYY')} to ${dayjs(ticket.dueDate).format('DD MMM YYYY')}). Please request date extension permission first.`
            });
            return;
          }
        }
      }
    }

    // Ticket Allotted Hours Validation Constraint
    for (let i = 0; i < mappedItems.length; i++) {
      const item = mappedItems[i];
      const ticket = allMyTickets.find(t => String(t.id) === String(item.ticketId));
      if (ticket) {
        const allottedHours = getAllottedHoursForTicket(item.ticketId);
        if (item.hours > allottedHours) {
          Modal.confirm({
            title: 'Validation Error',
            content: (
              <div>
                <p>Hours logged for <strong>"{ticket.code || '#' + ticket.id} — {ticket.title || ticket.ticketTitle}"</strong> ({fmtH(item.hours)}) exceeds the allotted hours ({fmtH(allottedHours)}).</p>
                <p style={{ fontWeight: 600, color: '#ff4d4f', marginTop: 10 }}>You cannot report beyond the allotted hours. Please raise a ticket for additional hours.</p>
              </div>
            ),
            okText: 'Raise Ticket',
            cancelText: 'Cancel',
            okButtonProps: { style: { background: accent, borderColor: accent } },
            onOk: () => {
              handleOpenRequestModal('ExceededLimit', ticket);
            }
          });
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const reportData = {
        reportDate: selectedDate,
        items: mappedItems.map(item => ({
          ticketId: Number(item.ticketId),
          hoursSpent: item.hours,
          workDone: item.workDone
        }))
      };
      await reportService.submitDailyReport(reportData);
      
      for (const item of mappedItems) {
        if (item.isAlertIssue && item.alertMessage) {
          const selectedTicket = myTickets.find(t => String(t.id) === String(item.ticketId));
          const resolvedProjectId = selectedTicket 
            ? Number(selectedTicket.projectId) 
            : (allProjects?.[0]?.id || 1);

          await analyticsService.createAlert({
            type: 'Employee Report Alert',
            severity: 'Critical',
            message: `${selectedTicket ? `[${selectedTicket.code || '#' + selectedTicket.id}] ` : ''}${item.alertMessage}`,
            employeeName: currentUser.fullName,
            projectId: resolvedProjectId,
            projectName: 'EOD Report'
          });
        }
      }

      notification.success({ message: 'Success', description: `Report submitted successfully.` });
      setViewOnly(true);
      fetchWeeklyStatus(weekDates);
      await fetchProjects();
      await fetchTickets();
      await fetchReportForDate(selectedDate);
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to submit report.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualEntrySubmit = async (values) => {
    setManualSubmitting(true);
    try {
      if (values.mode === 'request') {
        const targetDateStr = values.targetDate ? values.targetDate.format('YYYY-MM-DD') : selectedDate;
        const projectObj = allProjects.find(p => String(p.id) === String(values.projectId));
        const projName = projectObj ? (projectObj.name || projectObj.projectName) : 'Project';
        
        const ticketObj = allMyTickets.find(t => String(t.id) === String(values.ticketId));
        const ticketName = ticketObj ? `${ticketObj.code || '#' + ticketObj.id} — ${ticketObj.title || ticketObj.ticketTitle || ''}` : 'Ticket';
        
        await reportAccessService.createRequest({
          targetDate: targetDateStr,
          reason: `[Project: ${projName}] [Ticket: ${ticketName}] ${values.reason}`
        });
        
        notification.success({
          message: 'Permission Requested',
          description: `Access request for ${targetDateStr} sent to Team Leader.`
        });
        setIsManualModalOpen(false);
        manualForm.resetFields();
        fetchWeeklyStatus(weekDates);
        await fetchReportForDate(selectedDate);
      } else {
        const hrs = Number(values.hours) || 0;
        const mins = Number(values.minutes) || 0;
        const loggedHours = hrs + mins / 60;

        if (loggedHours <= 0) {
          notification.error({
            message: 'Validation Error',
            description: 'Please enter a valid time duration (hours or minutes).'
          });
          setManualSubmitting(false);
          return;
        }

        if (!values.ticketName || !values.ticketName.trim()) {
          notification.error({
            message: 'Validation Error',
            description: 'Please enter a ticket title.'
          });
          setManualSubmitting(false);
          return;
        }

        const payload = {
          title: values.ticketName,
          description: values.workDescription || 'Manual Ticket Entry',
          priority: 'Medium',
          estimatedHours: loggedHours,
          assignedToUserId: currentUser.userId || currentUser.id,
          dueDate: dayjs(selectedDate).endOf('day').toISOString()
        };
        
        const ticketRes = await ticketService.createTicket(values.projectId, payload);
        const newTicket = ticketRes.data;

        const existingItems = (watchedItems || [])
          .map(item => {
            const h = Number(item.hoursInput) || 0;
            const m = Number(item.minutesInput) || 0;
            return {
              ticketId: Number(item.ticketId),
              hoursSpent: h + m / 60,
              workDone: item.workDone
            };
          })
          .filter(item => item.hoursSpent > 0 && item.ticketId);

        const newItem = {
          ticketId: Number(newTicket.id),
          hoursSpent: loggedHours,
          workDone: values.workDescription || 'Logged from Manual Entry'
        };

        const reportData = {
          reportDate: selectedDate,
          items: [...existingItems, newItem]
        };

        await reportService.submitDailyReport(reportData);

        notification.success({
          message: 'Ticket & EOD Submitted',
          description: 'Successfully created ticket and logged hours.'
        });

        setIsManualModalOpen(false);
        manualForm.resetFields();
        await fetchProjects();
        await fetchTickets();
        await fetchReportForDate(selectedDate);
        fetchWeeklyStatus(weekDates);
      }
    } catch (err) {
      notification.error({
        message: 'Manual Entry Failed',
        description: err.response?.data?.message || err.message || 'Error occurred.'
      });
    } finally {
      setManualSubmitting(false);
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
      fetchTickets();
    } catch (err) {
      notification.error({ message: 'Failed to submit request' });
    } finally {
      setRequesting(false);
    }
  };

  const getStatusColorAndLabel = (dateObj, status, hours) => {
    const today = dayjs();
    const isPast = dateObj.isBefore(today, 'day');

    if (status === 'holiday') {
      return { bg: '#e5e7eb', text: '#4b5563', label: 'Holiday' };
    }
    if (status === 'leave') {
      return { bg: '#3b82f6', text: '#ffffff', label: 'Fullday Leave' };
    }
    if (status === 'half_leave') {
      return { bg: '#38bdf8', text: '#ffffff', label: 'Halfday Leave' };
    }
    if (status === 'permission') {
      return { bg: '#facc15', text: '#854d0e', label: 'Permission' };
    }
    if (status === 'restricted') {
      const isDateNextWeek = dateObj.isAfter(today.endOf('week'));
      if (isDateNextWeek) {
        return { bg: '#e5e7eb', text: '#4b5563', label: 'Next Week' };
      }
      return { bg: '#f3f4f6', text: '#9ca3af', label: 'Reporting Restricted' };
    }
    if (status === 'optional') {
      return { bg: '#722ed1', text: '#ffffff', label: 'Optional Workday' };
    }

    const hasReport = status === 'submitted' || hours > 0;
    if (hasReport) {
      return { bg: '#00b493', text: '#ffffff', label: 'Completed' };
    }

    if (status === 'incomplete' || (isPast && !hasReport)) {
      return { bg: '#ff5b60', text: '#ffffff', label: 'Incomplete' };
    }

    return { bg: '#ff5b60', text: '#ffffff', label: 'Incomplete' };
  };

  const showRestrictionResult = isOutsideCurrentWeek && !existingReport && !hasAccessForDate;
  const hasAccessPending = myAccessRequests.find(r => r.targetDate === selectedDate);
  const isSunday = dayjs(selectedDate).day() === 0;
  const isNextWeek = dayjs(selectedDate).isAfter(dayjs().endOf('week'));

  const bg = isDarkMode ? '#0d0f18' : '#f1f3f9';
  const card = isDarkMode ? '#161925' : '#ffffff';
  const border = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const accent = '#6366f1';
  const emerald = '#10b981';
  const t1 = isDarkMode ? '#f1f5f9' : '#0f172a';
  const t2 = isDarkMode ? '#94a3b8' : '#64748b';

  const fmtH = (dec) => {
    const h = Math.floor(dec); const m = Math.round((dec - h) * 60);
    if (!h && !m) return '0m';
    return [h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ');
  };

  const dayStatus = weeklyStatus[selectedDate];
  const { bg: stBg, text: stTxt, label: stLabel } = getStatusColorAndLabel(dayjs(selectedDate), dayStatus, totalHours);

  // Filter assigned projects
  const myAssignedProjects = allProjects.filter(p => {
    const uId = currentUser?.userId || currentUser?.id;
    const hasAllocation = p.employeeAllocatedHours?.[uId] !== undefined && Number(p.employeeAllocatedHours?.[uId]) > 0;
    const isAssignedEmp = Array.isArray(p.assignedEmployeeIds) && p.assignedEmployeeIds.map(String).includes(String(uId));
    const isProjectTL = p.assignedTeamLeadId !== undefined && p.assignedTeamLeadId !== null && String(p.assignedTeamLeadId) === String(uId);
    const isProjectPM = p.assignedProjectManagerId !== undefined && p.assignedProjectManagerId !== null && String(p.assignedProjectManagerId) === String(uId);
    const pId = p.id || p.projectId;
    const hasAssignedTicket = myTickets.some(t => String(t.projectId) === String(pId));
    return hasAllocation || isAssignedEmp || isProjectTL || isProjectPM || hasAssignedTicket;
  });

  const displayProjects = myAssignedProjects.filter(project => {
    const pId = project.id || project.projectId;
    return visibleTickets.some(t => String(t.projectId) === String(pId));
  });

  const inactiveProjects = allProjects.filter(p => {
    const pId = p.id || p.projectId;
    return !visibleTickets.some(t => String(t.projectId) === String(pId));
  });

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: bg, overflow: 'hidden', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── HEADER PORTION ── */}
      <div style={{ background: card, borderBottom: `1px solid ${border}`, padding: '0 20px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 12 }}>
        
        {/* Date Selection */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button shape="circle" size="small" icon={<LeftOutlined style={{ fontSize: 10 }} />}
            onClick={() => { const d = dayjs(selectedDate).subtract(1, 'day'); setSelectedDate(d.format('YYYY-MM-DD')); setBaseDate(d.startOf('week').add(1, 'day')); }} />
          
          <DatePicker value={dayjs(selectedDate)} allowClear={false} size="small" style={{ width: 136 }}
            onChange={d => { if (d) { setSelectedDate(d.format('YYYY-MM-DD')); setBaseDate(d.startOf('week').add(1, 'day')); } }} />
          
          <Button shape="circle" size="small" icon={<RightOutlined style={{ fontSize: 10 }} />}
            onClick={() => { const d = dayjs(selectedDate).add(1, 'day'); setSelectedDate(d.format('YYYY-MM-DD')); setBaseDate(d.startOf('week').add(1, 'day')); }} />
        </div>

        {/* Current Date and Status Display */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: t1 }}>{dayjs(selectedDate).format('dddd, D MMM YYYY')}</span>
          <span style={{ background: stBg, color: stTxt, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{stLabel}</span>
        </div>

        {/* Action Controls */}
        <Space>
          {currentLeave ? (
            currentLeave.status === 'Pending' ? (
              <Space>
                <Button 
                  size="middle" 
                  icon={<EditOutlined />} 
                  style={{ borderColor: '#6366f1', color: '#6366f1', borderRadius: 8, fontWeight: 600 }}
                  onClick={() => handleOpenEditLeaveModal(currentLeave)}
                >
                  Edit Leave
                </Button>
                <Button 
                  size="middle" 
                  danger
                  icon={<DeleteOutlined />} 
                  style={{ borderRadius: 8, fontWeight: 600 }}
                  onClick={() => handleDeleteLeave(currentLeave.leaveId)}
                >
                  Cancel Leave
                </Button>
              </Space>
            ) : (
              <Tag color={currentLeave.status === 'Approved' ? 'success' : 'error'} style={{ fontWeight: 600, padding: '4px 12px', borderRadius: 8, margin: 0 }}>
                Leave {currentLeave.status}
              </Tag>
            )
          ) : (
            <Button 
              size="middle" 
              icon={<CalendarOutlined />} 
              style={{ borderColor: '#ec4899', color: '#ec4899', borderRadius: 8, fontWeight: 600 }}
              onClick={() => handleOpenApplyLeaveModal(selectedDate)}
            >
              Apply Leave / Permission
            </Button>
          )}

          {existingReport && viewOnly && (
            <Button size="middle" type="primary" icon={<EditOutlined />}
              style={{ background: accent, borderColor: accent, borderRadius: 8, fontWeight: 600 }} onClick={() => setViewOnly(false)}>Edit</Button>
          )}

          {existingReport && !viewOnly && (
            <Button size="middle" style={{ borderRadius: 8 }} onClick={() => { setViewOnly(true); reset(existingReport); }}>Cancel</Button>
          )}

          {!viewOnly && !isSunday && !isNextWeek && (
            <Button size="middle" type="primary" icon={<CheckCircleOutlined />} loading={submitting}
              style={{ background: emerald, borderColor: emerald, fontWeight: 700, borderRadius: 8 }}
              onClick={handleSubmit(onSubmit)}>Submit EOD</Button>
          )}
        </Space>
      </div>

      {/* ── HORIZONTAL WEEK STRIP ── */}
      <div style={{ background: card, borderBottom: `1px solid ${border}`, padding: '8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: t2 }}>Reporting Week:</span>
          <Button size="small" style={{ height: 22, width: 26, padding: 0 }} icon={<LeftOutlined style={{ fontSize: 10 }} />} onClick={handlePrevWeek} />
          <Button size="small" style={{ height: 22, width: 26, padding: 0 }} icon={<RightOutlined style={{ fontSize: 10 }} />} onClick={handleNextWeek} />
        </div>
        <div style={{ display: 'flex', gap: 8, flex: 1, justifyContent: 'center', maxWidth: 600 }}>
          {weekDates.map((d, i) => {
            const ds = d.format('YYYY-MM-DD');
            const sel = ds === selectedDate;
            const st = weeklyStatus[ds];
            const dotColors = { submitted: emerald, incomplete: '#ef4444', leave: '#3b82f6', half_leave: '#38bdf8', holiday: '#9ca3af', restricted: '#9ca3af', pending: '#f59e0b', optional: '#8b5cf6' };
            return (
              <div key={i} onClick={() => { setSelectedDate(ds); setBaseDate(d.startOf('week').add(1, 'day')); }}
                style={{ flex: 1, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '4px 6px', borderRadius: 8,
                  background: sel ? `${accent}15` : 'transparent', border: `1px solid ${sel ? accent : 'transparent'}`, transition: 'all 0.2s' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: sel ? accent : t2 }}>{d.format('dd').toUpperCase()}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: sel ? accent : t1 }}>{d.format('D')}</span>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColors[st] || '#cbd5e1' }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button size="small" type="primary" onClick={handleGoToToday} style={{ background: accent, borderColor: accent }}>Go to Today</Button>
        </div>
      </div>

      {/* ── MAIN WORKSPACE ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        
        {isSunday ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Result icon={<CheckCircleOutlined style={{ color: '#faad14' }} />} title="Happy Sunday!" subTitle="No EOD reporting required today. Rest & recharge." />
          </div>
        ) : showRestrictionResult ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
            <Result icon={<CalendarOutlined style={{ color: accent }} />} title="Reporting Restricted"
              subTitle="This date is outside your current week. Request access to log a report." />
            {!hasAccessPending && (
              <Button type="primary" style={{ background: accent, borderColor: accent }}
                onClick={() => setIsAccessRequestModalOpen(true)}>Request Access</Button>
            )}
          </div>
        ) : displayProjects.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Result
              icon={<ProjectOutlined style={{ color: accent }} />}
              title="No Assigned Projects"
              subTitle="You are not currently assigned to any active projects. Please contact your administrator."
            />
          </div>
        ) : (
          displayProjects.map(project => {
            const userId = currentUser.userId || currentUser.id;
            const projectAllocatedHours = Number(project.employeeAllocatedHours?.[userId] || 0);

            return (
              <Card
                key={project.id}
                title={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <ProjectOutlined style={{ color: accent, fontSize: 18 }} />
                      <span style={{ fontSize: 16, fontWeight: 800, color: t1 }}>{project.name || project.projectName}</span>
                    </div>
                    {!viewOnly && (
                      <Button 
                        type="primary" 
                        icon={<PlusOutlined />} 
                        size="small"
                        style={{ background: accent, borderColor: accent, borderRadius: 6, fontSize: 12 }}
                        onClick={() => {
                          const firstMatchIdx = fields.findIndex(f => String(f.projectId) === String(project.id));
                          setActiveTicketRowIndex(firstMatchIdx !== -1 ? firstMatchIdx : fields.length);
                          ticketForm.setFieldsValue({ projectId: project.id });
                          setIsTicketModalOpen(true);
                        }}
                      >
                        Create Ticket
                      </Button>
                    )}
                  </div>
                }
                bordered={true}
                style={{ background: card, borderColor: border, borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
                headStyle={{ borderBottom: `1px solid ${border}`, padding: '8px 16px', minHeight: 'auto' }}
                bodyStyle={{ padding: '12px 16px' }}
              >
                {/* List task rows inside this project */}
                {(() => {
                  const rows = fields.map((field, index) => ({ field, index })).filter(({ field, index }) => {
                    const item = watchedItems?.[index];
                    return String(item?.projectId) === String(project.id);
                  });

                  if (rows.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '10px 0', color: t2, fontSize: 13 }}>
                        No active assigned tickets for this project today.
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {rows.map(({ field, index }) => {
                        const item = watchedItems?.[index] || {};

                        return (
                          <div key={field.id} style={{ padding: '8px 12px', background: isDarkMode ? '#1e2130' : '#f8fafc', borderRadius: 8, border: `1px solid ${border}` }}>
                            <Row gutter={[12, 8]} align="middle">
                              <Col xs={24} md={11}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: t2 }}>TICKET NAME</span>
                                  {(() => {
                                    const ticketObj = allMyTickets.find(t => String(t.id) === String(item.ticketId));
                                    if (!ticketObj) return <span style={{ color: t2, fontSize: 12 }}>Ticket</span>;
                                    const code = ticketObj.code || `#${ticketObj.id}`;
                                    const title = ticketObj.title || ticketObj.ticketTitle || '';
                                    
                                    const allottedHours = getAllottedHoursForTicket(item.ticketId);
                                    const totalConsumed = ticketObj ? (Number(ticketObj.consumedHours) || 0) : 0;
                                    
                                    const dbReportTodayItem = existingReport?.items?.find(ri => String(ri.ticketId) === String(item.ticketId));
                                    const dbTodayHours = dbReportTodayItem ? (Number(dbReportTodayItem.hoursSpent || dbReportTodayItem.hours) || 0) : 0;
                                    const consumedOther = Math.max(0, totalConsumed - dbTodayHours);

                                    const curH = Number(watch(`items.${index}.hoursInput`)) || 0;
                                    const curM = Number(watch(`items.${index}.minutesInput`)) || 0;
                                    const curTotal = curH + (curM / 60);

                                    const remainingHours = Math.max(0, allottedHours - consumedOther - curTotal);

                                    const allotH = Math.floor(allottedHours);
                                    const allotM = Math.round((allottedHours - allotH) * 60);

                                    const remH = Math.floor(remainingHours);
                                    const remM = Math.round((remainingHours - remH) * 60);

                                    return (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap', whiteSpace: 'nowrap', overflow: 'hidden', marginTop: 4 }}>
                                        <span style={{ 
                                          fontSize: '11px', 
                                          fontWeight: 700, 
                                          background: `${accent}15`, 
                                          color: accent, 
                                          padding: '2px 6px', 
                                          borderRadius: 4,
                                          border: `1px solid ${accent}30`,
                                          flexShrink: 0
                                        }}>
                                          {code}
                                        </span>
                                        <Tooltip title={title}>
                                          <span 
                                            style={{ 
                                              fontSize: 12, 
                                              fontWeight: 600, 
                                              color: t1,
                                              textOverflow: 'ellipsis',
                                              overflow: 'hidden',
                                              whiteSpace: 'nowrap',
                                              maxWidth: 240,
                                              flexShrink: 1,
                                              cursor: 'pointer'
                                            }}
                                          >
                                            {title}
                                          </span>
                                        </Tooltip>
                                        <span style={{ fontSize: '10px', fontWeight: 600, color: t2, marginLeft: 4, flexShrink: 0 }}>
                                          (Allotted: {allotH}h {allotM}m)
                                        </span>
                                        <span style={{ fontSize: '10px', fontWeight: 700, color: remainingHours <= 0.5 ? '#ef4444' : '#10b981', flexShrink: 0 }}>
                                          (Remaining: {remH}h {remM}m)
                                        </span>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </Col>

                              <Col xs={24} md={4}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: t2 }}>TIME LOGGED</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Controller control={control} name={`items.${index}.hoursInput`} render={({ field: f }) => (
                                      <InputNumber {...f} min={0} size="small" style={{ width: '100%', borderRadius: 6 }} disabled={viewOnly || isTicketDateBlocked(item.ticketId)} placeholder="Hrs" />
                                    )} />
                                    <span style={{ fontSize: 11, color: t2, fontWeight: 600 }}>h</span>
                                    
                                    <Controller control={control} name={`items.${index}.minutesInput`} render={({ field: f }) => (
                                      <InputNumber {...f} min={0} max={59} size="small" style={{ width: '100%', borderRadius: 6 }} disabled={viewOnly || isTicketDateBlocked(item.ticketId)} placeholder="Mins" />
                                    )} />
                                    <span style={{ fontSize: 11, color: t2, fontWeight: 600 }}>m</span>
                                  </div>
                                </div>
                              </Col>

                              <Col xs={24} md={7}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: t2 }}>WORK DESCRIPTION</span>
                                  <Controller control={control} name={`items.${index}.workDone`} render={({ field: f }) => (
                                    <Input {...f} size="small" disabled={viewOnly || isTicketDateBlocked(item.ticketId)} placeholder="Describe work done..." style={{ fontSize: 12, borderRadius: 6, height: 32 }} />
                                  )} />
                                </div>
                              </Col>

                              <Col xs={24} md={2} style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 14 }}>
                                {(() => {
                                  const isAlert = watch(`items.${index}.isAlertIssue`);
                                  const ticketObj = allMyTickets.find(t => String(t.id) === String(item.ticketId));
                                  return (
                                    <Button 
                                      size="small" 
                                      icon={<AlertOutlined />} 
                                      danger={isAlert} 
                                      type={isAlert ? 'primary' : 'default'}
                                      disabled={viewOnly || isTicketDateBlocked(item.ticketId)}
                                      style={{ fontSize: 11, borderRadius: 6, width: '100%', height: 32 }} 
                                      onClick={() => handleAlertButtonClick(index, ticketObj)}
                                    >
                                      {isAlert ? 'Alert ON' : 'Alert'}
                                    </Button>
                                  );
                                })()}
                              </Col>
                            </Row>

                            {(() => {
                              if (!item.ticketId) return null;
                              const enteredHrs = Number(watch(`items.${index}.hoursInput`)) || 0;
                              const enteredMins = Number(watch(`items.${index}.minutesInput`)) || 0;
                              
                              if (enteredHrs < 0 || enteredMins < 0) {
                                return (
                                  <div style={{ color: '#ef4444', fontSize: '11px', marginTop: 4, fontWeight: 'bold' }}>
                                    ⚠️ Hours and minutes cannot be negative.
                                  </div>
                                );
                              }
                              if (enteredMins >= 60) {
                                return (
                                  <div style={{ color: '#ef4444', fontSize: '11px', marginTop: 4, fontWeight: 'bold' }}>
                                    ⚠️ Minutes must be less than 60.
                                  </div>
                                );
                              }
                              
                              const totalEnteredHours = enteredHrs + (enteredMins / 60);
                              const allottedHours = getAllottedHoursForTicket(item.ticketId);
                              if (totalEnteredHours > allottedHours) {
                                const ticketObj = allMyTickets.find(t => String(t.id) === String(item.ticketId));
                                return (
                                  <div style={{ color: '#ef4444', fontSize: '11px', marginTop: 6, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span>⚠️ Entered hours ({fmtH(totalEnteredHours)}) exceeds allotted ({fmtH(allottedHours)}).</span>
                                    {!viewOnly && (
                                      <Button 
                                        type="primary" 
                                        size="small" 
                                        danger 
                                        style={{ fontSize: '10px', height: '20px', padding: '0 8px', borderRadius: 4 }}
                                        onClick={() => handleOpenRequestModal('ExceededLimit', ticketObj)}
                                      >
                                        Request Hours
                                      </Button>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            })()}

                            {(() => {
                              if (!item.ticketId) return null;
                              const ticketObj = allMyTickets.find(t => String(t.id) === String(item.ticketId));
                              if (!ticketObj) return null;

                              const repDate = dayjs(selectedDate).startOf('day');
                              const start = ticketObj.startDate ? dayjs(ticketObj.startDate).startOf('day') : null;
                              const due = ticketObj.dueDate ? dayjs(ticketObj.dueDate).endOf('day') : null;
                              const isDateValid = !start || !due || (repDate.isAfter(start.subtract(1, 'day')) && repDate.isBefore(due.add(1, 'day')));
                              
                              if (isDateValid) return null;

                              const hasDatePermission = myTimerRequests.some(r => 
                                String(r.request?.ticketId) === String(ticketObj.id) && 
                                r.request?.requestType === 'DateRangeExtension' && 
                                (r.request?.status === 'Approved' || r.request?.status === 'AccountsApproved')
                              );

                              if (hasDatePermission) {
                                return (
                                  <div style={{ color: '#10b981', fontSize: '11px', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <CheckCircleOutlined />
                                    <span>Date range extension approved by TL & PM.</span>
                                  </div>
                                );
                              }

                              const pendingRequest = myTimerRequests.find(r => 
                                String(r.request?.ticketId) === String(ticketObj.id) && 
                                r.request?.requestType === 'DateRangeExtension' && 
                                (r.request?.status === 'PendingTL' || r.request?.status === 'PendingPM')
                              );

                              if (pendingRequest) {
                                return (
                                  <div style={{ color: '#eab308', fontSize: '11px', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <ClockCircleOutlined />
                                    <span>Request pending Team Leader / PM approval.</span>
                                  </div>
                                );
                              }

                              return (
                                <div style={{ color: '#ef4444', fontSize: '11px', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span>⚠️ Date Blocked: Selected date is outside valid ticket schedule ({start ? start.format('DD MMM YYYY') : ''} to {due ? due.format('DD MMM YYYY') : ''}).</span>
                                  <Button 
                                    type="primary" 
                                    size="small" 
                                    style={{ background: '#6366f1', borderColor: '#6366f1', fontSize: '10px', height: '20px', padding: '0 8px', borderRadius: 4 }}
                                    onClick={() => handleOpenRequestModal('DateRangeExtension', ticketObj)}
                                  >
                                    Request Permission
                                  </Button>
                                </div>
                              );
                            })()}

                            {(() => {
                              const isAlert = watch(`items.${index}.isAlertIssue`);
                              const alertMsg = watch(`items.${index}.alertMessage`);
                              if (isAlert && alertMsg) {
                                return (
                                  <div style={{ marginTop: 8, padding: '6px 12px', background: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2', border: '1px dashed #ef4444', borderRadius: 8 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                      <WarningOutlined style={{ color: '#ef4444' }} />
                                      <span>CRITICAL ALERT RAISED TO TEAM LEADER</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: isDarkMode ? '#fca5a5' : '#991b1b', fontStyle: 'italic' }}>
                                      "{alertMsg}"
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </Card>
            );
          })
        )}

        {/* Manual Ticket Entry Button */}
        {!viewOnly && !isSunday && !showRestrictionResult && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12, marginBottom: 20 }}>
            <Button 
              type="dashed" 
              icon={<PlusOutlined />} 
              size="large" 
              onClick={() => {
                manualForm.resetFields();
                setManualMode('request');
                setIsManualModalOpen(true);
              }}
              style={{ borderRadius: 8, fontWeight: 600, borderColor: accent, color: accent, display: 'flex', alignItems: 'center' }}
            >
              Manual Ticket Entry
            </Button>
          </div>
        )}
      </div>

      {/* ── MODALS ── */}
      <Modal 
        title={<span style={{ fontSize: 16, fontWeight: 700, color: t1 }}>Manual Ticket Entry</span>}
        open={isManualModalOpen} 
        onCancel={() => {
          setIsManualModalOpen(false);
          manualForm.resetFields();
        }} 
        footer={null} 
        destroyOnClose
        bodyStyle={{ padding: '16px 4px 4px 4px' }}
      >
        <Form 
          form={manualForm} 
          layout="vertical" 
          onFinish={handleManualEntrySubmit}
          initialValues={{ mode: 'request', targetDate: dayjs(selectedDate) }}
          style={{ marginTop: 12 }}
        >
          <Form.Item 
            name="projectId" 
            label={<span style={{ fontWeight: 600, color: t2, fontSize: 12 }}>SELECT INACTIVE PROJECT</span>}
            rules={[{ required: true, message: 'Please select a project' }]}
          >
            <Select 
              placeholder="Select project..." 
              style={{ width: '100%' }}
              options={inactiveProjects.map(p => ({
                value: p.id || p.projectId,
                label: p.name || p.projectName
              }))}
            />
          </Form.Item>

          <Form.Item 
            name="mode" 
            label={<span style={{ fontWeight: 600, color: t2, fontSize: 12 }}>ACTION TO PERFORM</span>}
            rules={[{ required: true }]}
          >
            <Radio.Group 
              style={{ width: '100%' }} 
              buttonStyle="solid" 
              onChange={(e) => setManualMode(e.target.value)}
            >
              <Radio.Button value="request" style={{ width: '50%', textAlign: 'center' }}>Request Permission</Radio.Button>
              <Radio.Button value="create" style={{ width: '50%', textAlign: 'center' }}>Create Ticket</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.mode !== curr.mode || prev.projectId !== curr.projectId}>
            {({ getFieldValue }) => {
              const currentMode = getFieldValue('mode') || 'request';
              const selectedProjectId = getFieldValue('projectId');

              if (currentMode === 'request') {
                const projectTickets = allMyTickets.filter(t => {
                  if (String(t.projectId) !== String(selectedProjectId)) return false;
                  const allotted = getAllottedHoursForTicket(t.id);
                  const totalConsumed = Number(t.consumedHours) || 0;
                  return totalConsumed < allotted;
                });
                return (
                  <>
                    <Form.Item 
                      name="ticketId" 
                      label={<span style={{ fontWeight: 600, color: t2, fontSize: 12 }}>SELECT TICKET</span>}
                      rules={[{ required: true, message: 'Please select a ticket' }]}
                    >
                      <Select 
                        placeholder={selectedProjectId ? "Select ticket..." : "First select a project above"} 
                        disabled={!selectedProjectId}
                        style={{ width: '100%' }}
                        options={projectTickets.map(t => ({
                          value: t.id,
                          label: `${t.code || '#' + t.id} — ${t.title || t.ticketTitle || ''}`
                        }))}
                      />
                    </Form.Item>

                    <Form.Item 
                      name="targetDate" 
                      label={<span style={{ fontWeight: 600, color: t2, fontSize: 12 }}>TARGET DATE</span>}
                      rules={[{ required: true, message: 'Please select a date' }]}
                    >
                      <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                    </Form.Item>
                    
                    <Form.Item 
                      name="reason" 
                      label={<span style={{ fontWeight: 600, color: t2, fontSize: 12 }}>REASON FOR PERMISSION</span>}
                      rules={[{ required: true, message: 'Please enter reason' }]}
                    >
                      <TextArea rows={3} placeholder="Provide reason to request reporting access for this date..." style={{ borderRadius: 8, fontSize: 13 }} />
                    </Form.Item>
                  </>
                );
              } else {
                return (
                  <>
                    <Form.Item 
                      name="ticketName" 
                      label={<span style={{ fontWeight: 600, color: t2, fontSize: 12 }}>NEW TICKET TITLE</span>}
                      rules={[{ required: true, message: 'Please enter a ticket title' }]}
                    >
                      <Input placeholder="Enter ticket name..." style={{ borderRadius: 8, fontSize: 13 }} />
                    </Form.Item>

                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Item 
                          name="hours" 
                          label={<span style={{ fontWeight: 600, color: t2, fontSize: 12 }}>HOURS</span>}
                          initialValue={0}
                        >
                          <InputNumber min={0} style={{ width: '100%', borderRadius: 8 }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item 
                          name="minutes" 
                          label={<span style={{ fontWeight: 600, color: t2, fontSize: 12 }}>MINUTES</span>}
                          initialValue={0}
                        >
                          <InputNumber min={0} max={59} style={{ width: '100%', borderRadius: 8 }} />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Form.Item 
                      name="workDescription" 
                      label={<span style={{ fontWeight: 600, color: t2, fontSize: 12 }}>WORK DESCRIPTION</span>}
                      rules={[{ required: true, message: 'Please enter work description' }]}
                    >
                      <TextArea rows={3} placeholder="Describe work done for this ticket..." style={{ borderRadius: 8, fontSize: 13 }} />
                    </Form.Item>
                  </>
                );
              }
            }}
          </Form.Item>

          <Button 
            type="primary" 
            htmlType="submit" 
            loading={manualSubmitting} 
            block 
            style={{ background: accent, borderColor: accent, height: 40, borderRadius: 8, fontWeight: 600, fontSize: 14, marginTop: 12 }}
          >
            Submit
          </Button>
        </Form>
      </Modal>

      <Modal title="Apply for Leave / Permission" open={isLeaveModalOpen} onCancel={() => setIsLeaveModalOpen(false)} footer={null} destroyOnClose>
        <Form form={leaveForm} layout="vertical" onFinish={handleApplyLeaveSubmit} style={{ marginTop: 16 }}>
          <Form.Item name="fromDate" label="From Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="toDate" label="To Date (optional)"><DatePicker style={{ width: '100%' }} /></Form.Item>
          
          <Form.Item name="type" label="Leave / Permission Type" rules={[{ required: true }]}>
            <Radio.Group style={{ width: '100%' }} buttonStyle="solid" defaultValue="FullDay">
              <Radio.Button value="FullDay" style={{ width: '33.33%', textAlign: 'center' }}>Full Day</Radio.Button>
              <Radio.Button value="HalfDay" style={{ width: '33.33%', textAlign: 'center' }}>Half Day</Radio.Button>
              <Radio.Button value="Permission" style={{ width: '33.33%', textAlign: 'center' }}>Permission</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.type !== curr.type}>
            {({ getFieldValue }) => {
              const type = getFieldValue('type');
              if (type === 'Permission') {
                return (
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item 
                        name="permissionHours" 
                        label="Permission Hours" 
                        rules={[{ required: true, message: 'Select hours' }]}
                        initialValue={0}
                      >
                        <Select style={{ width: '100%' }}>
                          <Select.Option value={0}>0</Select.Option>
                          <Select.Option value={1}>1</Select.Option>
                          <Select.Option value={2}>2</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item 
                        name="permissionMinutes" 
                        label="Permission Minutes" 
                        rules={[{ required: true, message: 'Enter minutes' }]}
                        initialValue={0}
                      >
                        <InputNumber min={0} max={59} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item name="reason" label="Reason"><TextArea rows={3} /></Form.Item>
          <Button type="primary" htmlType="submit" loading={leaveApplying} block style={{ background: accent, borderColor: accent }}>Submit Request</Button>
        </Form>
      </Modal>

      <Modal 
        title="Raise Alert to Team Leader" 
        open={alertModalOpen} 
        onCancel={() => setAlertModalOpen(false)} 
        footer={null} 
        destroyOnClose
      >
        <Form form={alertForm} layout="vertical" onFinish={handleAlertModalSubmit} style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: t2, display: 'block', fontWeight: 600 }}>Ticket</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: t1 }}>
              {alertForm.getFieldValue('ticketCode')} — {alertForm.getFieldValue('ticketTitle')}
            </span>
          </div>

          <Form.Item 
            name="alertMessage" 
            label="Describe blocker / critical issue" 
            rules={[{ required: true, message: 'Please describe the blocker' }]}
          >
            <TextArea 
              rows={4} 
              placeholder="Type critical issues or blockers preventing progress on this ticket..." 
              style={{ borderRadius: 8 }}
            />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            {alertModalIndex !== null && watch(`items.${alertModalIndex}.isAlertIssue`) ? (
              <Button danger onClick={handleRemoveAlert}>
                Remove Alert
              </Button>
            ) : <div />}
            <Space>
              <Button onClick={() => setAlertModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" style={{ background: '#ef4444', borderColor: '#ef4444' }}>
                Raise Alert
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>

      <Modal title="Edit Leave / Permission" open={isEditLeaveModalOpen} onCancel={() => setIsEditLeaveModalOpen(false)} footer={null} destroyOnClose>
        <Form form={editLeaveForm} layout="vertical" onFinish={handleEditLeaveSubmit} style={{ marginTop: 16 }}>
          <Form.Item name="fromDate" label="Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} disabled /></Form.Item>
          
          <Form.Item name="type" label="Leave / Permission Type" rules={[{ required: true }]}>
            <Radio.Group style={{ width: '100%' }} buttonStyle="solid">
              <Radio.Button value="FullDay" style={{ width: '33.33%', textAlign: 'center' }}>Full Day</Radio.Button>
              <Radio.Button value="HalfDay" style={{ width: '33.33%', textAlign: 'center' }}>Half Day</Radio.Button>
              <Radio.Button value="Permission" style={{ width: '33.33%', textAlign: 'center' }}>Permission</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.type !== curr.type}>
            {({ getFieldValue }) => {
              const type = getFieldValue('type');
              if (type === 'Permission') {
                return (
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item 
                        name="permissionHours" 
                        label="Permission Hours" 
                        rules={[{ required: true, message: 'Select hours' }]}
                        initialValue={0}
                      >
                        <Select style={{ width: '100%' }}>
                          <Select.Option value={0}>0</Select.Option>
                          <Select.Option value={1}>1</Select.Option>
                          <Select.Option value={2}>2</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item 
                        name="permissionMinutes" 
                        label="Permission Minutes" 
                        rules={[{ required: true, message: 'Enter minutes' }]}
                        initialValue={0}
                      >
                        <InputNumber min={0} max={59} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item name="reason" label="Reason"><TextArea rows={3} /></Form.Item>
          <Button type="primary" htmlType="submit" loading={editLeaveSubmitting} block style={{ background: accent, borderColor: accent }}>Save Changes</Button>
        </Form>
      </Modal>

      <Modal title="Create New Ticket" open={isTicketModalOpen} onCancel={() => setIsTicketModalOpen(false)} footer={null} destroyOnClose>
        <Form form={ticketForm} layout="vertical" onFinish={handleCreateTicket} style={{ marginTop: 16 }}>
          <Form.Item name="projectId" label="Project" rules={[{ required: true }]}>
            <Select options={allProjects.map(p => ({ value: p.id, label: p.name || p.projectName }))} />
          </Form.Item>
          <Form.Item name="title" label="Ticket Title" rules={[{ required: true }]}><Input /></Form.Item>
          
          <Form.Item name="dateType" label="Target Date Mode" initialValue="single" rules={[{ required: true }]}>
            <Radio.Group optionType="button" buttonStyle="solid">
              <Radio value="single">Single Date</Radio>
              <Radio value="range">Date Range</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.dateType !== curr.dateType}>
            {({ getFieldValue }) => {
              const type = getFieldValue('dateType') || 'single';
              if (type === 'single') {
                return (
                  <Form.Item name="singleDate" label="Target Date" rules={[{ required: true, message: 'Please select a date' }]}>
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                );
              }
              return (
                <Form.Item name="dateRange" label="Target Date Range" rules={[{ required: true, message: 'Please select date range' }]}>
                  <DatePicker.RangePicker style={{ width: '100%' }} />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item name="description" label="Description"><TextArea rows={3} /></Form.Item>
          <Button type="primary" htmlType="submit" loading={newTicketLoading} block style={{ background: accent, borderColor: accent }}>Create Ticket</Button>
        </Form>
      </Modal>

      <Modal title="Request Additional Hours" open={isRequestModalOpen} onCancel={() => setIsRequestModalOpen(false)} footer={null} destroyOnClose>
        <Form form={requestForm} layout="vertical" onFinish={handleRequestSubmit} style={{ marginTop: 16 }}>
          <Form.Item name="ticketId" hidden><Input /></Form.Item>
          <Form.Item name="requestType" label="Request Type" rules={[{ required: true }]}>
            <Select options={[
              { value: 'TimerMissed', label: 'Timer Missed' }, 
              { value: 'ExceededLimit', label: 'Hours Exceeded' },
              { value: 'DateRangeExtension', label: 'Date Range Extension' }
            ]} />
          </Form.Item>
          {!['TeamLead', 'ProjectManager', 'TenantAdmin'].includes(role) && (
            <Form.Item name="teamLeadId" label="Team Lead" rules={[{ required: true }]}>
              <Select
                disabled
                options={selectOptions}
              />
            </Form.Item>
          )}
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.requestType !== curr.requestType}>
            {({ getFieldValue }) => {
              const rType = getFieldValue('requestType');
              if (rType === 'DateRangeExtension') {
                return (
                  <Form.Item name="requestedHours" label="Requested Hours (Can be 0 for date extension only)" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                );
              }
              return (
                <Form.Item name="requestedHours" label="Requested Hours" rules={[{ required: true }]}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}><TextArea rows={3} /></Form.Item>
          <Button type="primary" htmlType="submit" loading={requesting} block>Submit Request</Button>
        </Form>
      </Modal>

      <Modal title="Request Report Access" open={isAccessRequestModalOpen} onCancel={() => setIsAccessRequestModalOpen(false)} footer={null} destroyOnClose>
        <Form form={accessRequestForm} layout="vertical" style={{ marginTop: 16 }}
          onFinish={async (vals) => {
            setAccessRequestSubmitting(true);
            try {
              const start = dayjs(vals.fromDate);
              if (vals.toDate) {
                const end = dayjs(vals.toDate);
                const daysDiff = end.diff(start, 'day');
                
                for (let i = 0; i <= daysDiff; i++) {
                  const target = start.add(i, 'day').format('YYYY-MM-DD');
                  await reportAccessService.createRequest({ targetDate: target, reason: vals.reason, requestType: 'single' });
                }
                notification.success({ 
                  message: 'Access Requests Submitted', 
                  description: `Requested access from ${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}.` 
                });
              } else {
                const target = start.format('YYYY-MM-DD');
                await reportAccessService.createRequest({ targetDate: target, reason: vals.reason, requestType: 'single' });
                notification.success({ 
                  message: 'Access Request Submitted',
                  description: `Requested access for ${target}.`
                });
              }
              setIsAccessRequestModalOpen(false);
              fetchWeeklyStatus(weekDates);
              await fetchReportForDate(selectedDate);
            } catch (err) { 
              notification.error({ 
                message: 'Failed to submit access requests',
                description: err.response?.data?.message || 'Error occurred while submitting request.'
              }); 
            } finally { 
              setAccessRequestSubmitting(false); 
            }
          }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="fromDate" label="From Date" rules={[{ required: true, message: 'From date is required' }]}
                initialValue={dayjs(selectedDate)}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="toDate" label="To Date (optional)">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reason" label="Reason for access" rules={[{ required: true }]}><TextArea rows={3} /></Form.Item>
          <Button type="primary" htmlType="submit" loading={accessRequestSubmitting} block style={{ background: accent, borderColor: accent }}>Submit Request</Button>
        </Form>
      </Modal>
    </div>
  );
};

export default EODReportPage;
