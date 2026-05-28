import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, InputNumber, Select, Button, Space, Typography,
  Row, Col, Progress, Alert, notification, Tag, Result, Modal, Radio, theme, Table, Badge, Tabs, DatePicker, Collapse
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SendOutlined, CheckCircleOutlined,
  CheckCircleFilled, ExclamationCircleFilled, ClockCircleOutlined,
  LeftOutlined, RightOutlined, ProjectOutlined, AlertOutlined,
  WarningOutlined, SendOutlined as RaiseIcon, ApartmentOutlined, CalendarOutlined,
  EditOutlined, CalendarFilled
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
  const [selectedTopProjectId, setSelectedTopProjectId] = useState(null);
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
  const [hasWarnedExceeded, setHasWarnedExceeded] = useState(false);
  const [accessRequestType, setAccessRequestType] = useState('single');

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

  const { control, handleSubmit, watch, reset, setValue, trigger, formState: { errors } } = useForm({
    defaultValues: {
      items: [{ projectId: '', ticketId: '', hours: 0, workDone: '' }],
      blockers: '',
      isAlertIssue: false,
      alertMessage: ''
    }
  });

  const handleNextToReview = async () => {
    const isValid = await trigger('items');
    if (isValid) {
      setActiveTabKey('submit-tab');
    } else {
      message.error('Please fill in all required task fields before proceeding.');
    }
  };

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const [taskHours, setTaskHours] = useState(0);
  const [taskMinutes, setTaskMinutes] = useState(0);
  const [taskWorkDone, setTaskWorkDone] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState('');

  const handleAddTask = () => {
    if (!selectedTicketId) {
      notification.warning({ message: 'Select Ticket', description: 'Please select a ticket or task category first.' });
      return;
    }
    if (taskHours === 0 && taskMinutes === 0) {
      notification.warning({ message: 'Input Hours', description: 'Please input hours or minutes spent.' });
      return;
    }
    if (!taskWorkDone.trim()) {
      notification.warning({ message: 'Enter Description', description: 'Please describe the work done.' });
      return;
    }

    const activeProjectId = selectedTopProjectId || allProjects[0]?.id;
    append({
      projectId: activeProjectId,
      ticketId: selectedTicketId,
      hoursInput: taskHours,
      minutesInput: taskMinutes,
      workDone: taskWorkDone
    });

    setSelectedTicketId('');
    setTaskHours(0);
    setTaskMinutes(0);
    setTaskWorkDone('');
    notification.success({ message: 'Task Added', description: "Task added to today's log list." });
  };
  const watchedItems = watch('items');
  const totalHours = watchedItems?.reduce((acc, curr) => {
    const hrs = Number(curr?.hoursInput) || 0;
    const mins = Number(curr?.minutesInput) || 0;
    return acc + hrs + (mins / 60);
  }, 0) || 0;
  
  // 1. Calculate hours reported on OTHER days of this week
  const hoursReportedOtherDays = weeklyReports
    .filter(r => r.date !== selectedDate)
    .reduce((sum, r) => {
      const dayHours = r.items?.reduce((s, item) => s + (Number(item.hoursSpent || item.hours) || 0), 0) || 0;
      return sum + dayHours;
    }, 0);

  // 2. Base weekly allocated hours
  const weeklyAllocated = allocatedHoursPerDay;

  // 3. Remaining weekly quota before today's input
  const remainingBeforeToday = isOutsideCurrentWeek
    ? (currentWeekRemainingHours !== null ? currentWeekRemainingHours : (allocatedHoursPerDay > 0 ? (allocatedHoursPerDay / 5) : 24))
    : (allocatedHoursPerDay > 0 ? Math.max(0, allocatedHoursPerDay - hoursReportedOtherDays) : 24);

  // 4. Dynamic daily quota (REQUIRED_HOURS) capped at remainingBeforeToday
  const baseRequiredHours = remainingBeforeToday;
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

  useEffect(() => {
    if (!viewOnly && allocatedHoursPerDay > 0 && REQUIRED_HOURS > 0) {
      if (totalHours > REQUIRED_HOURS) {
        if (!hasWarnedExceeded) {
          setBlockedSubmitTotal(totalHours);
          setIsHoursBlockedModalOpen(true);
          setHasWarnedExceeded(true);
        }
      } else {
        setHasWarnedExceeded(false);
      }
    }
  }, [totalHours, REQUIRED_HOURS, allocatedHoursPerDay, hasWarnedExceeded, viewOnly]);

  const loggedThisWeek = hoursReportedOtherDays + totalHours;
  const remainingWeekly = Math.max(0, weeklyAllocated - loggedThisWeek);
  
  // Calculate lock state if they have fully completed their weekly quota
  const isLocked = (viewOnly && !adminUnlocked) || (allocatedHoursPerDay > 0 && remainingBeforeToday <= 0 && !existingReport);

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

      let ticketsData = rawTickets.filter(t => t.status !== 'Done');
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

  const fetchCurrentWeekRemaining = async () => {
    try {
      const today = dayjs();
      const start = today.startOf('week').add(1, 'day').format('YYYY-MM-DD');
      const end = today.startOf('week').add(7, 'day').format('YYYY-MM-DD');
      const res = await reportService.getReportsByRange(currentUser.id, start, end);
      const reports = res.data || [];
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
      // Keep auth store in sync so it's consistent across page navigation
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

      let accessRequestsList = [];
      try {
        const arRes = await reportAccessService.getMyRequests();
        accessRequestsList = arRes?.data || [];
        setMyAccessRequests(accessRequestsList);
      } catch (_) {}

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
     setHasWarnedExceeded(false);
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
      await fetchCurrentWeekRemaining();

      // Fetch employee's access requests for status display
      try {
        const arRes = await reportAccessService.getMyRequests();
        setMyAccessRequests(arRes?.data || []);
      } catch (_) {}

      // Force fetch projects if they aren't loaded yet
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

      // Force fetch tickets if they aren't loaded yet to map properly
      let ticketsList = myTickets;
      if (ticketsList.length === 0) {
        const ticketsRes = await ticketService.getTickets();
        const rawTickets = ticketsRes.data || [];
        setAllMyTickets(rawTickets);
        
        let filteredTickets = rawTickets.filter(t => t.status !== 'Done');
        if (role === 'TeamLead' || role === 'ProjectManager' || role === 'TenantAdmin') {
          const myUserId = currentUser?.userId || currentUser?.id;
          filteredTickets = filteredTickets.filter(t => 
            (t.assignedToUserId && String(t.assignedToUserId) === String(myUserId)) || 
            (t.assignedTo && String(t.assignedTo) === String(myUserId))
          );
        }
        setMyTickets(filteredTickets);
        ticketsList = filteredTickets;
      }

      const hasReport = !!res.data;

      if (hasReport) {
        const mappedItems = (res.data.items || []).map(item => {
          const ticket = ticketsList.find(t => String(t.id) === String(item.ticketId));
          const pId = ticket ? ticket.projectId : '';
          const totalH = Number(item.hoursSpent) || 0;
          const hVal = Math.floor(totalH);
          const mVal = Math.round((totalH - hVal) * 60);
          return {
            projectId: pId,
            ticketId: item.ticketId,
            hoursInput: hVal,
            minutesInput: mVal,
            workDone: item.workDone
          };
        });

        // Add empty rows for projects that are allocated to the user but not in the report
        const userId = currentUser.userId || currentUser.id;
        const reportedProjectIds = new Set(mappedItems.map(i => String(i.projectId)));
        
        projectsList.forEach(p => {
          const empHours = p.employeeAllocatedHours?.[userId];
          if (empHours !== undefined && Number(empHours) > 0 && !reportedProjectIds.has(String(p.id))) {
            mappedItems.push({
              projectId: p.id,
              ticketId: '',
              hoursInput: 0,
              minutesInput: 0,
              workDone: ''
            });
          }
        });

        const mappedReport = {
          ...res.data,
          items: mappedItems
        };
        reset(mappedReport);
        setExistingReport(mappedReport);
        setViewOnly(true);
      } else {
        const defaultItems = [];
        const userId = currentUser.userId || currentUser.id;
        projectsList.forEach(p => {
          const empHours = p.employeeAllocatedHours?.[userId];
          if (empHours !== undefined && Number(empHours) > 0) {
            defaultItems.push({
              projectId: p.id,
              ticketId: '',
              hoursInput: 0,
              minutesInput: 0,
              workDone: ''
            });
          }
        });
        if (defaultItems.length === 0) {
          projectsList.forEach(p => {
            defaultItems.push({
              projectId: p.id,
              ticketId: '',
              hoursInput: 0,
              minutesInput: 0,
              workDone: ''
            });
          });
        }
        reset({ items: defaultItems, blockers: '', isAlertIssue: false, alertMessage: '' });
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
      setAllMyTickets(prev => [newTicket, ...prev]);

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

    const submittedTotal = mappedItems.reduce((acc, curr) => acc + curr.hours, 0);
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
        items: mappedItems.map(item => ({
          ticketId: Number(item.ticketId),
          hoursSpent: item.hours,
          workDone: item.workDone
        }))
      };
      await reportService.submitDailyReport(reportData);
      
      // Sync mock projects locally if in mock mode
      if (import.meta.env.VITE_USE_MOCK === 'true') {
        try {
          const { mockProjects } = await import('../../mocks/mockProjects');
          mappedItems.forEach(item => {
            const tkt = myTickets.find(t => String(t.id) === String(item.ticketId));
            if (tkt && tkt.projectId) {
              const proj = mockProjects.find(p => String(p.id) === String(tkt.projectId));
              if (proj) {
                const spent = Number(item.hours) || 0;
                proj.consumedHours = Number(proj.consumedHours || 0) + spent;
                if (proj.totalHours !== undefined) {
                  proj.totalHours = Math.max(0, Number(proj.totalHours) - spent);
                }
              }
            }
          });
        } catch (mockErr) {
          console.error('Failed to sync mock projects:', mockErr);
        }
      }
      
      if (data.isAlertIssue && data.alertMessage) {
        const firstItem = mappedItems?.[0];
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
      await fetchProjects(); // Refresh projects list to update local state available hours!
      await fetchReportForDate(selectedDate);
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
  ];

  const formatHoursAndMinutes = (hoursDecimal) => {
    const h = Math.floor(hoursDecimal);
    const m = Math.round((hoursDecimal - h) * 60);
    if (h === 0 && m === 0) return '0 mins';
    const hStr = h > 0 ? `${h}h` : '';
    const mStr = m > 0 ? `${m}m` : '';
    return [hStr, mStr].filter(Boolean).join(' ');
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
      if (hours >= REQUIRED_HOURS) {
        return { bg: '#00b493', text: '#ffffff', label: 'Completed' };
      } else {
        return { bg: '#f97316', text: '#ffffff', label: 'Partially Complete' };
      }
    }

    if (status === 'incomplete' || (isPast && !hasReport)) {
      return { bg: '#ff5b60', text: '#ffffff', label: 'Incomplete' };
    }

    // Default/Pending
    return { bg: '#ff5b60', text: '#ffffff', label: 'Incomplete' };
  };

  const formatHourStrip = (hoursDecimal) => {
    const h = Math.floor(hoursDecimal);
    const m = Math.round((hoursDecimal - h) * 60);
    if (h === 0 && m === 0) return '0 hrs';
    if (m === 0) return `${h} hrs`;
    return `${h}h ${m}m`;
  };

  const showRestrictionResult = isOutsideCurrentWeek && !existingReport && !hasAccessForDate;
  const hasAccessPending = myAccessRequests.find(r => r.targetDate === selectedDate);
  const isSunday = dayjs(selectedDate).day() === 0;
  const isFullDayLeave = currentLeave && currentLeave.type === 'FullDay';
  const isNextWeek = dayjs(selectedDate).isAfter(dayjs().endOf('week'));

  // Render the Tabbed EOD dashboard
  return (
    <div style={{
      padding: '20px 24px',
      background: isDarkMode ? '#0b0f19' : '#f4f6fa',
      height: 'calc(100vh - 64px)',
      maxHeight: 'calc(100vh - 64px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxSizing: 'border-box'
    }}>
      
      {/* ── HEADER BANNER: Premium Glassmorphic Layout ──────────────────────────────── */}
      <div style={{
        background: isDarkMode ? 'rgba(30, 41, 59, 0.45)' : '#ffffff',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
        padding: '24px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 20,
        boxShadow: isDarkMode ? '0 12px 40px rgba(0, 0, 0, 0.25)' : '0 8px 30px rgba(0, 0, 0, 0.03)',
        marginBottom: 24,
        flexWrap: 'wrap',
        gap: 20
      }}>
        {/* Left Section: Selected Date & Status Pill */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160 }}>
          <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6366f1' }}>
            Work Report Date
          </span>
          <span style={{ fontSize: 26, fontWeight: 900, color: isDarkMode ? '#f8fafc' : '#0f172a', fontFamily: 'Outfit, Inter, sans-serif' }}>
            {dayjs(selectedDate).format('DD MMMM YYYY')}
          </span>
          {(() => {
            const dateStr = selectedDate;
            const status = weeklyStatus[dateStr];
            const reportForDate = weeklyReports.find(r => r.date === dateStr);
            const hours = reportForDate ? Number(reportForDate.totalHours) : 0;
            const displayHours = totalHours;
            const { bg, text, label } = getStatusColorAndLabel(dayjs(selectedDate), status, displayHours);
            return (
              <span style={{
                background: bg,
                color: text,
                padding: '5px 16px',
                borderRadius: 30,
                fontSize: 11,
                fontWeight: 800,
                display: 'inline-block',
                width: 'fit-content',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {label}
              </span>
            );
          })()}
        </div>

        {/* Middle Section: Inline Date Picker & Week Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            shape="circle"
            icon={<LeftOutlined style={{ fontSize: 11 }} />}
            onClick={() => {
              const prevDate = dayjs(selectedDate).subtract(1, 'day');
              setSelectedDate(prevDate.format('YYYY-MM-DD'));
              setBaseDate(prevDate.startOf('week').add(1, 'day'));
            }}
            style={{ 
              background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0', 
              border: 'none', 
              color: isDarkMode ? '#cbd5e1' : '#4b5563', 
              width: 30, 
              height: 30,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}
          />
          
          <DatePicker
            value={dayjs(selectedDate)}
            onChange={(date) => {
              if (date) {
                const dateStr = date.format('YYYY-MM-DD');
                setSelectedDate(dateStr);
                setBaseDate(date.startOf('week').add(1, 'day'));
              }
            }}
            allowClear={false}
            picker="date"
            style={{
              borderRadius: 8,
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
              background: isDarkMode ? 'rgba(30, 41, 59, 0.65)' : '#ffffff',
              color: isDarkMode ? '#cbd5e1' : '#0f172a',
              height: 32,
              width: 130,
              fontSize: 12,
              fontWeight: 700
            }}
          />

          <Button
            shape="circle"
            icon={<RightOutlined style={{ fontSize: 11 }} />}
            onClick={() => {
              const nextDate = dayjs(selectedDate).add(1, 'day');
              setSelectedDate(nextDate.format('YYYY-MM-DD'));
              setBaseDate(nextDate.startOf('week').add(1, 'day'));
            }}
            style={{ 
              background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0', 
              border: 'none', 
              color: isDarkMode ? '#cbd5e1' : '#4b5563', 
              width: 30, 
              height: 30,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}
          />
        </div>
        
        {/* Right Section: Action Buttons */}
        <div style={{ display: 'flex', gap: 12, minWidth: 220, justifyContent: 'flex-end', alignItems: 'center' }}>
          <Button
            icon={<CalendarOutlined />}
            onClick={() => handleOpenApplyLeaveModal(selectedDate)}
            style={{ 
              borderRadius: 10, 
              height: 42, 
              borderColor: '#ec4899', 
              color: '#ec4899', 
              background: 'transparent',
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(236, 72, 153, 0.05)'
            }}
          >
            Apply Leave
          </Button>

          {existingReport && (
            viewOnly ? (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => setViewOnly(false)}
                style={{ 
                  background: '#6366f1', 
                  borderColor: '#6366f1', 
                  borderRadius: 10, 
                  height: 42, 
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
                }}
              >
                Edit Report
              </Button>
            ) : (
              <Button
                icon={<LeftOutlined />}
                onClick={() => {
                  setViewOnly(true);
                  reset(existingReport);
                }}
                style={{ 
                  borderRadius: 10, 
                  height: 42, 
                  fontWeight: 700
                }}
              >
                Cancel Edit
              </Button>
            )
          )}

          <Button
            onClick={handleGoToToday}
            style={{ borderRadius: 10, height: 42, fontWeight: 600 }}
          >
            Today
          </Button>
        </div>
      </div>
      
      <Form onFinish={handleSubmit(onSubmit)} layout="vertical" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <Row gutter={24} style={{ flex: 1, minHeight: 0, display: 'flex', flexWrap: 'nowrap' }}>
          
          
          {/* ── MAIN WORKSPACE: Task Reporting Full-Width Dashboard ──────────────────── */}
          <Col xs={24} lg={24} style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
    
            
            {/* Conditional Notifications */}
            {currentLeave && (
              <Alert
                message={currentLeave.type === 'FullDay' ? 'Full Day Leave Approved' : 'Half Day Leave Approved'}
                description="Your required EOD quota has been reduced automatically."
                type="warning"
                showIcon
                style={{ marginBottom: 16, borderRadius: 12 }}
              />
            )}
            
            {allocatedHoursPerDay > 0 && remainingBeforeToday <= 0 && !existingReport && (
              <Alert
                message="Weekly Quota Fully Completed"
                description="You have already reported the entire weekly allotted hours. No further task logging is permitted for this week."
                type="warning"
                showIcon
                style={{ marginBottom: 16, borderRadius: 12 }}
              />
            )}

            {/* Main Workspace Table / Cards */}
            {isSunday ? (
              <div style={{ background: isDarkMode ? '#1e293b' : '#ffffff', padding: 48, borderRadius: 16, textAlign: 'center', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, boxShadow: '0 8px 30px rgba(0,0,0,0.02)' }}>
                <Result icon={<CheckCircleOutlined style={{ color: '#faad14', fontSize: 54 }} />} title="Happy Sunday!" subTitle="Rest & Recharge. No EOD reporting required today." />
              </div>
            ) : isNextWeek ? (
              <div style={{
                background: isDarkMode ? '#1e293b' : '#ffffff',
                padding: '54px 40px',
                borderRadius: 16,
                textAlign: 'center',
                border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                boxShadow: '0 8px 30px rgba(0,0,0,0.02)'
              }}>
                <Result
                  icon={<CalendarOutlined style={{ color: '#6366f1', fontSize: 56 }} />}
                  title={<span style={{ fontSize: 22, fontWeight: 900, color: isDarkMode ? '#f8fafc' : '#0f172a' }}>Future Date Task Logging</span>}
                  subTitle={
                    <Space direction="vertical" style={{ width: '100%', textAlign: 'center', marginTop: 10 }}>
                      <Text style={{ fontSize: 15, color: isDarkMode ? '#94a3b8' : '#4b5563' }}>
                        You have selected a date for next week. To report for this date, you need to raise a ticket first.
                      </Text>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        Once created, the ticket will be available for you to report and log tasks.
                      </Text>
                    </Space>
                  }
                  extra={
                    <Space size={14}>
                      <Button 
                        type="primary" 
                        icon={<PlusOutlined />} 
                        onClick={() => {
                          ticketForm.resetFields();
                          setActiveTicketRowIndex(null);
                          setIsTicketModalOpen(true);
                        }}
                        style={{ background: '#6366f1', borderColor: '#6366f1', borderRadius: 10, height: 44, padding: '0 28px', fontWeight: 700 }}
                      >
                        Raise a Ticket
                      </Button>
                      <Button 
                        onClick={handleGoToToday}
                        style={{ borderRadius: 10, height: 44, fontWeight: 600 }}
                      >
                        Back to Today
                      </Button>
                    </Space>
                  }
                />
              </div>
            ) : showRestrictionResult ? (
              <div style={{ background: isDarkMode ? '#1e293b' : '#ffffff', padding: 48, borderRadius: 16, border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, boxShadow: '0 8px 30px rgba(0,0,0,0.02)' }}>
                <Result
                  status={hasAccessPending?.status === 'Rejected' ? 'error' : 'warning'}
                  title={hasAccessPending?.status === 'Pending' ? 'Access Pending' : hasAccessPending?.status === 'Rejected' ? 'Access Rejected' : 'Reporting Restricted'}
                  subTitle={
                    <Space direction="vertical" style={{ width: '100%', textAlign: 'center' }}>
                      <span style={{ fontSize: 14 }}>
                        Reporting for this date is outside the current work week.
                      </span>
                      {hasAccessPending?.status === 'Pending' && (
                        <Alert message="Access request is pending review by HR/PM." type="info" showIcon style={{ textAlign: 'left', borderRadius: 10, padding: 10, fontSize: 12, marginTop: 8 }} />
                      )}
                      {hasAccessPending?.status === 'Rejected' && (
                        <Alert message={`Rejected. ${hasAccessPending.reviewerComments ? `Reason: ${hasAccessPending.reviewerComments}` : ''}`} type="error" showIcon style={{ textAlign: 'left', borderRadius: 10, padding: 10, fontSize: 12, marginTop: 8 }} />
                      )}
                      {!hasAccessPending && (
                        <span style={{ fontSize: 13, color: '#8c8c8c' }}>
                          Submit an access request to HR / PM to unlock reporting.
                        </span>
                      )}
                    </Space>
                  }
                  extra={
                    <Space>
                      <Button size="small" type="default" onClick={handleGoToToday} style={{ borderRadius: 8, height: 36 }}>
                        Go to Today
                      </Button>
                      {!hasAccessPending || hasAccessPending.status === 'Rejected' ? (
                        <Button
                          size="small"
                          type="primary"
                          icon={<CalendarOutlined />}
                          onClick={() => {
                             accessRequestForm.resetFields();
                             accessRequestForm.setFieldsValue({ targetDate: dayjs(selectedDate) });
                             setIsAccessRequestModalOpen(true);
                          }}
                          style={{ borderRadius: 8, height: 36, background: '#6366f1', borderColor: '#6366f1' }}
                        >
                          Request Access
                        </Button>
                      ) : null}
                    </Space>
                  }
                />
              </div>
            ) : isFullDayLeave ? (
              <div style={{ background: isDarkMode ? '#1e293b' : '#ffffff', padding: 48, borderRadius: 16, textAlign: 'center', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, boxShadow: '0 8px 30px rgba(0,0,0,0.02)' }}>
                <Result icon={<CheckCircleOutlined style={{ color: '#818cf8', fontSize: 54 }} />} title="Approved Full Day Leave" subTitle="No EOD report is required today." />
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                
                {/* ── COMBINED SLIM STEP 1 & STEP 2 PANEL ────────────────────────────────────── */}
                <div style={{ background: isDarkMode ? 'rgba(30, 41, 59, 0.35)' : '#ffffff', border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`, padding: '12px 18px', borderRadius: 16, marginBottom: 14 }}>
                  <Row gutter={16}>
                    <Col xs={24} md={14}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                          Step 1: Choose Active Project
                        </span>
                        <Select
                          disabled={isLocked || viewOnly}
                          placeholder="Select a Project to Log Task"
                          style={{ width: '100%', height: 40 }}
                          value={selectedTopProjectId || allProjects[0]?.id || undefined}
                          onChange={(val) => {
                            setSelectedTopProjectId(val);
                            setSelectedTicketId('');
                          }}
                        >
                          {allProjects.map(p => (
                            <Select.Option key={p.id} value={p.id}>
                              {p.name || p.projectName} (Quota: {p.employeeAllocatedHours?.[currentUser.userId || currentUser.id] || 0} hrs)
                            </Select.Option>
                          ))}
                        </Select>
                      </div>
                    </Col>
                    
                    <Col xs={24} md={10}>
                      {(() => {
                        const activeProjectId = selectedTopProjectId || allProjects[0]?.id;
                        const proj = allProjects.find(p => String(p.id) === String(activeProjectId));
                        const empHours = proj?.employeeAllocatedHours?.[currentUser.userId || currentUser.id] || 0;
                        
                        const totalLoggedForProject = allMyTickets
                          .filter(t => String(t.projectId) === String(activeProjectId))
                          .reduce((sum, t) => sum + (Number(t.consumedHours) || 0), 0);
                        
                        const existingReportProjectHours = existingReport?.items?.reduce((sum, item) => {
                          if (String(item.projectId) === String(activeProjectId)) {
                            return sum + (Number(item.hours) || 0);
                          }
                          return sum;
                        }, 0) || 0;
                        
                        const currentProjectHoursInForm = watchedItems?.reduce((sum, item) => {
                          if (String(item.projectId) === String(activeProjectId)) {
                            const h = Number(item.hoursInput) || 0;
                            const m = Number(item.minutesInput) || 0;
                            return sum + h + (m / 60);
                          }
                          return sum;
                        }, 0) || 0;
                        
                        const previouslyLogged = Math.max(0, totalLoggedForProject - existingReportProjectHours);
                        const timeLeft = Math.max(0, Number(empHours) - previouslyLogged - currentProjectHoursInForm);
                        const timeLeftText = formatHoursAndMinutes(timeLeft);

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                              Step 2: Project Quota Left
                            </span>
                            <div style={{
                              height: 40,
                              background: isDarkMode ? 'rgba(16, 185, 129, 0.08)' : '#ecfdf5',
                              border: '1px solid #10b981',
                              borderRadius: 10,
                              padding: '0 16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: isDarkMode ? '#a7f3d0' : '#047857' }}>
                                Remaining
                              </span>
                              <span style={{ fontSize: 16, fontWeight: 950, color: '#10b981', fontFamily: 'Outfit, sans-serif' }}>
                                {timeLeftText}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </Col>
                  </Row>
                </div>
                
                {/* }
                <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: isDarkMode ? '#cbd5e1' : '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                  Step 1: Select Active Project
                </span>
                <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 10, marginBottom: 16 }}>
                  {allProjects.map(p => {
                    const isSelected = String(p.id) === String(selectedTopProjectId || allProjects[0]?.id);
                    const empHours = p.employeeAllocatedHours?.[currentUser.userId || currentUser.id] || 0;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedTopProjectId(p.id)}
                        style={{
                          minWidth: 170,
                          borderRadius: 14,
                          background: isSelected 
                            ? (isDarkMode ? 'rgba(99, 102, 241, 0.15)' : '#f5f7ff') 
                            : (isDarkMode ? 'rgba(30, 41, 59, 0.45)' : '#ffffff'),
                          border: isSelected 
                            ? '2px solid #6366f1' 
                            : `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
                          padding: '12px 16px',
                          cursor: 'pointer',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: isSelected ? '0 4px 20px rgba(99, 102, 241, 0.15)' : '0 2px 8px rgba(0,0,0,0.01)',
                        }}
                      >
                        <Space direction="vertical" size={6} style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <ProjectOutlined style={{ color: isSelected ? '#6366f1' : '#94a3b8', fontSize: 18 }} />
                            {isSelected && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1' }} />}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 800, color: isDarkMode ? '#f8fafc' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                            {p.name || p.projectName}
                          </span>
                          <span style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 600 }}>
                            Quota: {empHours} hrs
                          </span>
                        </Space>
                      </div>
                    );
                  })}
                </div>

                {/* Scrollable Container for Tasks Logger, Form, Blockers, and Logs */}
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  
                  {(() => {
                    const activeProjectId = selectedTopProjectId || allProjects[0]?.id;
                    const proj = allProjects.find(p => String(p.id) === String(activeProjectId));
                    const empHours = proj?.employeeAllocatedHours?.[currentUser.userId || currentUser.id] || 0;
                    
                    // Available Hours Calculation
                    const totalLoggedForProject = allMyTickets
                      .filter(t => String(t.projectId) === String(activeProjectId))
                      .reduce((sum, t) => sum + (Number(t.consumedHours) || 0), 0);
                    
                    const existingReportProjectHours = existingReport?.items?.reduce((sum, item) => {
                      if (String(item.projectId) === String(activeProjectId)) {
                        return sum + (Number(item.hours) || 0);
                      }
                      return sum;
                    }, 0) || 0;
                    
                    const currentProjectHoursInForm = watchedItems?.reduce((sum, item) => {
                      if (String(item.projectId) === String(activeProjectId)) {
                        const h = Number(item.hoursInput) || 0;
                        const m = Number(item.minutesInput) || 0;
                        return sum + h + (m / 60);
                      }
                      return sum;
                    }, 0) || 0;
                    
                    const previouslyLogged = Math.max(0, totalLoggedForProject - existingReportProjectHours);
                    const timeLeft = Math.max(0, Number(empHours) - previouslyLogged - currentProjectHoursInForm);
                    const timeLeftText = formatHoursAndMinutes(timeLeft);

                    const projectTasks = fields.map((field, index) => ({
                      field,
                      index,
                      item: watchedItems?.[index]
                    })).filter(w => String(w.item?.projectId) === String(activeProjectId));

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        
                        {/* ── STEP 2: DISPLAY PROJECT AVAILABLE HOURS DETAILS ──────────────────────── */}
                        
                        {/* Slim Step 1 & 2 combined above outside scroll view */}


                        {/* ── STEP 3: SELECT TICKET AND REPORT TASK ───────────────────────────────── */}
                        <Card
                          title={
                            <span style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase', color: '#6366f1', letterSpacing: '0.5px' }}>
                              Step 3: Log Task Details for {proj?.name || proj?.projectName}
                            </span>
                          }
                          style={{
                            borderRadius: 16,
                            background: isDarkMode ? 'rgba(30, 41, 59, 0.45)' : '#ffffff',
                            border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
                            boxShadow: '0 8px 30px rgba(0,0,0,0.02)'
                          }}
                          bodyStyle={{ padding: 24 }}
                        >
                          <Row gutter={[20, 20]}>
                            <Col span={24}>
                              <Form.Item label={<Text strong style={{ fontSize: 13, color: isDarkMode ? '#e2e8f0' : '#334155' }}>Task Category / Ticket</Text>} style={{ marginBottom: 0 }}>
                                <Select
                                  disabled={isLocked || viewOnly}
                                  placeholder="Select Project Ticket to Report"
                                  style={{ width: '100%', height: 44 }}
                                  value={selectedTicketId || undefined}
                                  onChange={(val) => {
                                    setSelectedTicketId(val);
                                    const ticket = myTickets.find(t => t.id === val);
                                    if (ticket && ticket.timerAccumulatedSeconds) {
                                      const decimalHrs = (ticket.timerAccumulatedSeconds || 0) / 3600;
                                      const hVal = Math.floor(decimalHrs);
                                      const mVal = Math.round((decimalHrs - hVal) * 60);
                                      setTaskHours(hVal);
                                      setTaskMinutes(mVal);
                                    }
                                  }}
                                >
                                  {myTickets
                                    .filter(t => String(t.projectId) === String(activeProjectId))
                                    .map(t => (
                                      <Select.Option key={t.id} value={t.id}>
                                        {t.code} — {t.title}
                                      </Select.Option>
                                    ))}
                                </Select>
                              </Form.Item>
                              {!viewOnly && !isLocked && (
                                <Button 
                                  type="link" 
                                  size="small" 
                                  icon={<PlusOutlined />} 
                                  onClick={() => {
                                    setActiveTicketRowIndex(null); 
                                    setIsTicketModalOpen(true);
                                  }}
                                  style={{ padding: 0, fontSize: 12, height: 'auto', marginTop: 8, fontWeight: 700, color: '#6366f1' }}
                                >
                                  Create New Ticket for this Project
                                </Button>
                              )}
                            </Col>

                            <Col xs={12} md={12}>
                              <Form.Item label={<Text strong style={{ fontSize: 13, color: isDarkMode ? '#e2e8f0' : '#334155' }}>Hours Spent</Text>} style={{ marginBottom: 0 }}>
                                <InputNumber
                                  disabled={isLocked || viewOnly}
                                  min={0}
                                  max={24}
                                  placeholder="Hours"
                                  value={taskHours}
                                  onChange={setTaskHours}
                                  style={{ width: '100%', borderRadius: 10, height: 44, display: 'flex', alignItems: 'center' }}
                                />
                              </Form.Item>
                            </Col>

                            <Col xs={12} md={12}>
                              <Form.Item label={<Text strong style={{ fontSize: 13, color: isDarkMode ? '#e2e8f0' : '#334155' }}>Minutes Spent</Text>} style={{ marginBottom: 0 }}>
                                <InputNumber
                                  disabled={isLocked || viewOnly}
                                  min={0}
                                  max={59}
                                  placeholder="Mins"
                                  value={taskMinutes}
                                  onChange={setTaskMinutes}
                                  style={{ width: '100%', borderRadius: 10, height: 44, display: 'flex', alignItems: 'center' }}
                                />
                              </Form.Item>
                            </Col>

                            <Col span={24}>
                              <Form.Item label={<Text strong style={{ fontSize: 13, color: isDarkMode ? '#e2e8f0' : '#334155' }}>Work Done Description (Detailed)</Text>} style={{ marginBottom: 0 }}>
                                <Input.TextArea
                                  disabled={isLocked || viewOnly}
                                  placeholder="Provide a detailed description of what you accomplished..."
                                  value={taskWorkDone}
                                  onChange={(e) => setTaskWorkDone(e.target.value)}
                                  rows={4}
                                  style={{ width: '100%', borderRadius: 10, padding: '12px 16px', fontSize: 13 }}
                                />
                              </Form.Item>
                            </Col>

                            {!viewOnly && !isLocked && (
                              <Col span={24} style={{ textAlign: 'right', marginTop: 10 }}>
                                <Button
                                  type="primary"
                                  icon={<PlusOutlined />}
                                  onClick={handleAddTask}
                                  style={{ background: '#10b981', borderColor: '#10b981', borderRadius: 10, height: 44, padding: '0 28px', fontWeight: 800, fontSize: 14, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
                                >
                                  Add Task to Report
                                </Button>
                              </Col>
                            )}
                          </Row>
                        </Card>

                        {/* ── TODAY'S TASK LOG LIST FOR SELECTED PROJECT ───────────────────────── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: isDarkMode ? '#cbd5e1' : '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Today's Task Log ({projectTasks.length})
                          </span>

                          {projectTasks.length === 0 ? (
                            <div style={{
                              textAlign: 'center',
                              padding: '36px 20px',
                              background: isDarkMode ? 'rgba(30, 41, 59, 0.25)' : '#f8fafc',
                              border: `1px dashed ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                              borderRadius: 16
                            }}>
                              <ClockCircleOutlined style={{ fontSize: 32, color: isDarkMode ? '#475569' : '#cbd5e1', marginBottom: 12 }} />
                              <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                                No tasks logged for this project today
                              </span>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                Select a ticket above, fill in the effort, and click 'Add Task' to include it.
                              </Text>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {projectTasks.map(({ field, index, item }) => {
                                const ticket = myTickets.find(t => t.id === item?.ticketId);
                                const ticketTitle = ticket ? `${ticket.code} — ${ticket.title}` : 'General Log / Administrative';
                                return (
                                  <Card
                                    key={field.id}
                                    style={{
                                      borderRadius: 12,
                                      background: isDarkMode ? 'rgba(30, 41, 59, 0.35)' : '#ffffff',
                                      border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'}`,
                                      boxShadow: '0 2px 8px rgba(0,0,0,0.01)'
                                    }}
                                    bodyStyle={{ padding: '16px 20px' }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                          <Tag color="blue" style={{ borderRadius: 6, fontWeight: 700 }}>
                                            {item?.hoursInput}h {item?.minutesInput}m
                                          </Tag>
                                          <span style={{ fontWeight: 800, fontSize: 13, color: isDarkMode ? '#f8fafc' : '#1e293b' }}>
                                            {ticketTitle}
                                          </span>
                                        </div>
                                        <span style={{ fontSize: 12, color: isDarkMode ? '#94a3b8' : '#64748b', marginTop: 4 }}>
                                          {item?.workDone || 'No description provided'}
                                        </span>
                                      </div>

                                      {!viewOnly && !isLocked && (
                                        <Button
                                          type="primary"
                                          danger
                                          icon={<DeleteOutlined />}
                                          onClick={() => remove(index)}
                                          style={{ borderRadius: 8, height: 32, width: 32, padding: 0 }}
                                        />
                                      )}
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>
                          )}

                        </div>

                      </div>
                    );
                  })()}

                  {/* ── BLOCKERS & CRITICAL ALERTS ───────────────────────────────────────── */}
                  <div style={{
                    padding: '24px',
                    background: isDarkMode ? 'rgba(30, 41, 59, 0.45)' : '#ffffff',
                    border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
                    borderRadius: 16,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 20
                  }}>
                    <Row gutter={[24, 24]}>
                      <Col xs={24} md={12}>
                        <Form.Item label={<Text strong style={{ fontSize: 13, color: isDarkMode ? '#cbd5e1' : '#475569' }}>Blockers Faced Today</Text>} style={{ marginBottom: 0 }}>
                          <Controller
                            name="blockers"
                            control={control}
                            render={({ field }) => (
                              <TextArea
                                {...field}
                                disabled={isLocked || viewOnly}
                                rows={4}
                                placeholder="Type here if you were blocked by anyone or anything..."
                                style={{ borderRadius: 10 }}
                              />
                            )}
                          />
                        </Form.Item>
                      </Col>
                      
                      <Col xs={24} md={12}>
                        <Card
                          title={
                            <Space>
                              <AlertOutlined style={{ color: '#ef4444' }} />
                              <span style={{ fontSize: 13, fontWeight: 800 }}>Raise Critical Project Alert?</span>
                            </Space>
                          }
                          size="small"
                          style={{
                            borderRadius: 12,
                            background: isDarkMode ? 'rgba(239, 68, 68, 0.04)' : '#fffafb',
                            border: `1px solid ${watch('isAlertIssue') ? '#ef4444' : isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#ffe4e6'}`,
                            boxShadow: watch('isAlertIssue') ? '0 0 15px rgba(239, 68, 68, 0.1)' : 'none',
                            transition: 'all 0.3s ease'
                          }}
                          bodyStyle={{ padding: 16 }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <Controller
                              name="isAlertIssue"
                              control={control}
                              render={({ field: checkField }) => (
                                <Radio.Group
                                  {...checkField}
                                  disabled={isLocked || viewOnly}
                                  onChange={(e) => {
                                    checkField.onChange(e.target.value);
                                    if (!e.target.value) {
                                      setValue('alertMessage', '');
                                    }
                                  }}
                                >
                                  <Space>
                                    <Radio value={false}>No Alert</Radio>
                                    <Radio value={true} style={{ color: '#ef4444', fontWeight: 700 }}>Raise Alert</Radio>
                                  </Space>
                                </Radio.Group>
                              )}
                            />
                            
                            {watch('isAlertIssue') && (
                              <Controller
                                name="alertMessage"
                                control={control}
                                render={({ field: msgField }) => (
                                  <TextArea
                                    {...msgField}
                                    disabled={isLocked || viewOnly}
                                    rows={2}
                                    placeholder="Describe the critical blocker/issue to notify Project Manager & TL..."
                                    style={{ marginTop: 6, borderRadius: 8 }}
                                  />
                                )}
                              />
                            )}
                          </div>
                        </Card>
                      </Col>
                    </Row>

                    {/* Submit / Cancel Buttons Block */}
                    {!viewOnly && (
                      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}`, paddingTop: 18 }}>
                        <Button
                          onClick={() => {
                            reset({ items: [], blockers: '', isAlertIssue: false, alertMessage: '' });
                          }}
                          style={{ borderRadius: 10, height: 42, fontWeight: 600 }}
                        >
                          Reset Form
                        </Button>
                        
                        <Button
                          type="primary"
                          htmlType="submit"
                          loading={submitting}
                          style={{ background: '#6366f1', borderColor: '#6366f1', borderRadius: 10, height: 42, padding: '0 28px', fontWeight: 700 }}
                        >
                          Submit Report
                        </Button>

                        {existingReport && (
                          <Button
                            onClick={() => {
                              setViewOnly(true);
                              reset(existingReport);
                            }}
                            style={{ borderRadius: 10, height: 42, fontWeight: 600 }}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    )}

                  </div>

                  {/* Request Logs list */}
                  {myTimerRequests.length > 0 && (
                    <Collapse 
                      ghost
                      style={{
                        background: isDarkMode ? '#111827' : '#ffffff',
                        borderRadius: 12,
                        border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                        marginTop: 10
                      }}
                      expandIconPosition="end"
                      items={[{
                        key: 'history',
                        label: <span style={{ fontWeight: 700, color: '#ec4899', fontSize: 12 }}>Additional Hours Request History Logs ({myTimerRequests.length})</span>,
                        children: (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <Button size="small" onClick={fetchTimerRequests} type="link">Refresh Logs</Button>
                            </div>
                            <Table
                              dataSource={myTimerRequests}
                              columns={requestColumns}
                              rowKey={(record) => record.id || record.request?.id}
                              size="small"
                              pagination={{ pageSize: 4 }}
                            />
                          </div>
                        )
                      }]}
                    />
                  )}

                </div>
              </div>
            )}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 20,
              padding: '16px 24px',
              borderTop: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
              background: isDarkMode ? '#1e293b' : '#ffffff',
              borderRadius: '0 0 16px 16px',
              marginTop: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#e5e7eb', display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cbd5e1' : '#4b5563' }}>Holiday</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cbd5e1' : '#4b5563' }}>Fullday Leave</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cbd5e1' : '#4b5563' }}>Halfday Leave</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#facc15', display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cbd5e1' : '#4b5563' }}>Permission</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#00b493', display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cbd5e1' : '#4b5563' }}>Completed</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#ff5b60', display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cbd5e1' : '#4b5563' }}>Incomplete</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#f97316', display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cbd5e1' : '#4b5563' }}>Partially Complete</span>
              </div>
            </div>

            </div>
          </Col>
        </Row>
      </Form>

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
          
          <div style={{ marginBottom: 16, background: isDarkMode ? '#141414' : '#f8fafc', border: `1px solid ${isDarkMode ? '#303030' : '#e2e8f0'}`, padding: 12, borderRadius: 8 }}>
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
              if (accessRequestType === 'single') {
                const targetDate = values.targetDate 
                  ? dayjs(values.targetDate).format('YYYY-MM-DD') 
                  : dayjs(selectedDate).format('YYYY-MM-DD');
                await reportAccessService.createRequest({
                  targetDate,
                  reason: values.reason
                });
              } else {
                const start = dayjs(values.dateRange[0]);
                const end = dayjs(values.dateRange[1]);
                const diffDays = end.diff(start, 'day');
                
                const requests = [];
                for (let i = 0; i <= diffDays; i++) {
                  const curDate = start.add(i, 'day').format('YYYY-MM-DD');
                  requests.push(
                    reportAccessService.createRequest({
                      targetDate: curDate,
                      reason: values.reason
                    })
                  );
                }
                await Promise.all(requests);
              }
              notification.success({
                message: 'Access Request Submitted',
                description: 'Your request to report has been sent to HR and Project Manager. You will be notified once it is reviewed.'
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
          <Form.Item name="requestType" label="Selection Mode" initialValue="single" style={{ marginBottom: 12 }}>
            <Radio.Group value={accessRequestType} onChange={(e) => setAccessRequestType(e.target.value)}>
              <Radio value="single">Single Date</Radio>
              <Radio value="range">Date Range</Radio>
            </Radio.Group>
          </Form.Item>

          {accessRequestType === 'single' ? (
            <Form.Item 
              name="targetDate" 
              label="Select Target Date" 
              rules={[{ required: true, message: 'Please select a date' }]}
              initialValue={dayjs(selectedDate)}
            >
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
          ) : (
            <Form.Item 
              name="dateRange" 
              label="Select Date Range" 
              rules={[{ required: true, message: 'Please select a range' }]}
            >
              <DatePicker.RangePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
          )}

          <div style={{ 
            background: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc', 
            padding: 12, 
            borderRadius: 8, 
            marginBottom: 16,
            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`
          }}>
            <Text type="secondary" style={{ fontSize: 12, color: isDarkMode ? '#8c8c8c' : '#555' }}>Requesting access for</Text>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#6366f1', marginTop: 4 }}>
              {accessRequestType === 'single' 
                ? (accessRequestForm.getFieldValue('targetDate') 
                   ? dayjs(accessRequestForm.getFieldValue('targetDate')).format('dddd, DD MMMM YYYY')
                   : dayjs(selectedDate).format('dddd, DD MMMM YYYY'))
                : 'Selected Date Range'
              }
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