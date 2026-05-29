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
    if (selectedTopProjectId && !viewOnly && !loading) {
      const hasTasks = watchedItems?.some(item => String(item?.projectId) === String(selectedTopProjectId));
      if (!hasTasks) {
        append({
          projectId: selectedTopProjectId,
          ticketId: '',
          hoursInput: 0,
          minutesInput: 0,
          workDone: ''
        });
      }
    }
  }, [selectedTopProjectId, watchedItems, append, viewOnly, loading]);

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
     setSelectedTopProjectId(null);
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
      return { bg: '#00b493', text: '#ffffff', label: 'Completed' };
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


  // ─── Pre-render derived values ───────────────────────────────────────────
  const userId = currentUser?.userId || currentUser?.id;
  const selectedProject = allProjects.find(p => String(p.id) === String(selectedTopProjectId));
  const projectAllocatedHours = selectedProject ? Number(selectedProject.employeeAllocatedHours?.[userId] || 0) : 0;

  // Calculate hours logged for this project on ALL OTHER days of the current week strip from weeklyReports
  const projectHoursOtherDays = weeklyReports
    .filter(r => r.date !== selectedDate)
    .reduce((sum, r) => {
      const dayHours = r.items
        ?.filter(item => {
          const tkt = allMyTickets.find(t => String(t.id) === String(item.ticketId));
          const pId = tkt ? tkt.projectId : item.projectId;
          return String(pId) === String(selectedTopProjectId);
        })
        .reduce((s, item) => s + (Number(item.hoursSpent || item.hours) || 0), 0) || 0;
      return sum + dayHours;
    }, 0);

  const projectHoursToday = (watchedItems || [])
    .filter(item => String(item.projectId) === String(selectedTopProjectId))
    .reduce((s, item) => s + (Number(item.hoursInput) || 0) + (Number(item.minutesInput) || 0) / 60, 0);

  const projectRemaining = Math.max(0, projectAllocatedHours - (projectHoursOtherDays + projectHoursToday));

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

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: bg, overflow: 'hidden', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── TOP BAR ── */}
      <div style={{ background: card, borderBottom: `1px solid ${border}`, padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <Button shape="circle" size="small" icon={<LeftOutlined style={{ fontSize: 10 }} />}
          onClick={() => { const d = dayjs(selectedDate).subtract(1, 'day'); setSelectedDate(d.format('YYYY-MM-DD')); setBaseDate(d.startOf('week').add(1, 'day')); }} />
        <DatePicker value={dayjs(selectedDate)} allowClear={false} size="small" style={{ width: 136 }}
          onChange={d => { if (d) { setSelectedDate(d.format('YYYY-MM-DD')); setBaseDate(d.startOf('week').add(1, 'day')); } }} />
        <Button shape="circle" size="small" icon={<RightOutlined style={{ fontSize: 10 }} />}
          onClick={() => { const d = dayjs(selectedDate).add(1, 'day'); setSelectedDate(d.format('YYYY-MM-DD')); setBaseDate(d.startOf('week').add(1, 'day')); }} />

        <div style={{ fontWeight: 800, fontSize: 15, color: t1, marginLeft: 4 }}>{dayjs(selectedDate).format('dddd, D MMM YYYY')}</div>
        <span style={{ background: stBg, color: stTxt, padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, marginLeft: 2 }}>{stLabel}</span>

        <div style={{ flex: 1 }} />

        <Button size="small" onClick={handleGoToToday}>Today</Button>
        <Button size="small" icon={<CalendarOutlined />} style={{ borderColor: '#ec4899', color: '#ec4899' }}
          onClick={() => handleOpenApplyLeaveModal(selectedDate)}>Apply Leave</Button>
        {existingReport && viewOnly && (
          <Button size="small" type="primary" icon={<EditOutlined />}
            style={{ background: accent, borderColor: accent }} onClick={() => setViewOnly(false)}>Edit</Button>
        )}
        {existingReport && !viewOnly && (
          <Button size="small" onClick={() => { setViewOnly(true); reset(existingReport); }}>Cancel</Button>
        )}
        {!viewOnly && !isSunday && !isNextWeek && (
          <Button size="small" type="primary" icon={<CheckCircleOutlined />} loading={submitting}
            style={{ background: emerald, borderColor: emerald, fontWeight: 700 }}
            onClick={handleSubmit(onSubmit)}>Submit Report</Button>
        )}
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT SIDEBAR */}
        <div style={{ width: 252, background: card, borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>

          {/* Week strip */}
          <div style={{ padding: '12px 12px 10px', borderBottom: `1px solid ${border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: t2 }}>This Week</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <Button size="small" style={{ height: 20, width: 24, padding: 0, fontSize: 10 }} icon={<LeftOutlined />} onClick={handlePrevWeek} />
                <Button size="small" style={{ height: 20, width: 24, padding: 0, fontSize: 10 }} icon={<RightOutlined />} onClick={handleNextWeek} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {weekDates.map((d, i) => {
                const ds = d.format('YYYY-MM-DD');
                const sel = ds === selectedDate;
                const st = weeklyStatus[ds];
                const dotColors = { submitted: emerald, incomplete: '#ef4444', leave: '#3b82f6', half_leave: '#38bdf8', holiday: '#9ca3af', restricted: '#9ca3af', pending: '#f59e0b', optional: '#8b5cf6' };
                return (
                  <div key={i} onClick={() => { setSelectedDate(ds); setBaseDate(d.startOf('week').add(1, 'day')); }}
                    style={{ flex: 1, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '5px 2px', borderRadius: 8,
                      background: sel ? `${accent}15` : 'transparent', border: `1.5px solid ${sel ? accent : 'transparent'}` }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: sel ? accent : t2 }}>{d.format('dd').toUpperCase()}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: sel ? accent : t1 }}>{d.format('D')}</span>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: dotColors[st] || '#cbd5e1' }} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Project selector */}
          <div style={{ padding: '16px 12px', borderBottom: `1px solid ${border}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: t2, marginBottom: 8 }}>Project Selection</div>
            <Select placeholder="Choose a Project to Report" value={selectedTopProjectId} onChange={v => setSelectedTopProjectId(v)}
              style={{ width: '100%' }} size="middle" showSearch
              filterOption={(inp, opt) => (opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())}
              options={allProjects.map(p => ({ value: p.id, label: p.name || p.projectName }))} />
            {selectedProject && (
              <div style={{ marginTop: 12, background: isDarkMode ? '#0b0d15' : '#f8f9ff', borderRadius: 8, padding: '12px', border: `1px solid ${border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: t2 }}>Allocated Hours</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>{fmtH(projectAllocatedHours)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: t2 }}>Remaining Hours</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: projectRemaining > 0 ? emerald : '#ef4444' }}>{fmtH(projectRemaining)}</span>
                </div>
                <Progress size="small" showInfo={false}
                  percent={projectAllocatedHours > 0 ? Math.min(100, Math.round((projectHoursToday / projectAllocatedHours) * 100)) : 0}
                  strokeColor={emerald} />
              </div>
            )}
          </div>

          {/* Leave info */}
          {currentLeave && (
            <div style={{ padding: '10px 12px' }}>
              <Alert type="warning" showIcon style={{ fontSize: 11, borderRadius: 8 }}
                message={currentLeave.type === 'FullDay' ? 'Full Day Leave' : currentLeave.type === 'HalfDay' ? 'Half Day Leave' : 'Permission'} />
            </div>
          )}
        </div>

        {/* RIGHT MAIN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
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
          ) : !selectedTopProjectId ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 24, textAlign: 'center' }}>
              <Result
                icon={<ProjectOutlined style={{ color: accent, fontSize: 56 }} />}
                title={<span style={{ color: t1, fontSize: 20, fontWeight: 800 }}>No Project Selected</span>}
                subTitle={<span style={{ color: t2, fontSize: 14 }}>Please select a project from the sidebar dropdown list to start logging tasks.</span>}
              />
            </div>
          ) : (
            <>
              {/* Tasks header */}
              <div style={{ padding: '10px 20px', background: card, borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: t1 }}>Task Entries</span>
                  {(() => {
                    const projectTasksCount = (watchedItems || []).filter(item => String(item.projectId) === String(selectedTopProjectId)).length;
                    return (
                      <span style={{ fontSize: 12, color: t2 }}>{projectTasksCount} task{projectTasksCount !== 1 ? 's' : ''} for this project</span>
                    );
                  })()}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: t2 }}>Logged Today:</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: totalHours > REQUIRED_HOURS ? '#ef4444' : emerald }}>{fmtH(totalHours)}</span>
                  {REQUIRED_HOURS > 0 && <span style={{ fontSize: 12, color: t2 }}>/ {fmtH(REQUIRED_HOURS)}</span>}
                </div>
              </div>

              {/* Scrollable task list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {fields.map((field, index) => {
                  const item = watchedItems?.[index] || {};
                  const rowProjId = item.projectId || selectedTopProjectId;
                  
                  // Only display tasks registered to the active project selection
                  if (String(rowProjId) !== String(selectedTopProjectId)) {
                    return null;
                  }

                  const rowTickets = rowProjId
                    ? myTickets.filter(t => String(t.projectId) === String(rowProjId))
                    : myTickets;
                  return (
                    <div key={field.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: '14px 16px' }}>
                      {/* Row top */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: `${accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: accent, flexShrink: 0 }}>{index + 1}</div>
                        {/* Display Premium Project Tag instead of select dropdown */}
                        <Tag color="geekblue" style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4, border: 'none' }}>
                          {selectedProject?.name || selectedProject?.projectName}
                        </Tag>
                        <div style={{ flex: 1 }} />
                        {/* Alert toggle */}
                        <Controller control={control} name="isAlertIssue" render={({ field: af }) => (
                          <Button size="small" icon={<AlertOutlined />} danger={af.value} type={af.value ? 'primary' : 'default'}
                            style={{ fontSize: 11, borderRadius: 6 }} onClick={() => af.onChange(!af.value)}>
                            {af.value ? 'Alert ON' : 'Alert'}
                          </Button>
                        )} />
                        {/* New ticket */}
                        {!viewOnly && (
                          <Button size="small" icon={<PlusOutlined />} style={{ fontSize: 11, borderRadius: 6 }}
                            onClick={() => { setActiveTicketRowIndex(index); ticketForm.setFieldsValue({ projectId: item.projectId || selectedTopProjectId }); setIsTicketModalOpen(true); }}>
                            New Ticket
                          </Button>
                        )}
                        {/* Delete */}
                        {!viewOnly && fields.length > 1 && (
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => remove(index)} />
                        )}
                      </div>

                      {/* Ticket + Hours row */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap' }}>
                        <Controller control={control} name={`items.${index}.ticketId`} render={({ field: f }) => (
                          <Select {...f} placeholder="Select ticket / task category" size="small" style={{ flex: 1, minWidth: 200 }}
                            disabled={viewOnly} showSearch
                            filterOption={(inp, opt) => (opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())}
                            options={rowTickets.map(t => ({ value: t.id, label: `${t.code || '#' + t.id} — ${t.title || t.ticketTitle || ''}` }))} />
                        )} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          <Controller control={control} name={`items.${index}.hoursInput`} render={({ field: f }) => (
                            <InputNumber {...f} min={0} max={24} size="small" style={{ width: 58 }} disabled={viewOnly} placeholder="0" />
                          )} />
                          <span style={{ fontSize: 11, color: t2, fontWeight: 600 }}>h</span>
                          <Controller control={control} name={`items.${index}.minutesInput`} render={({ field: f }) => (
                            <InputNumber {...f} min={0} max={59} size="small" style={{ width: 58 }} disabled={viewOnly} placeholder="0" />
                          )} />
                          <span style={{ fontSize: 11, color: t2, fontWeight: 600 }}>m</span>
                        </div>
                      </div>

                      {/* Description */}
                      <Controller control={control} name={`items.${index}.workDone`} render={({ field: f }) => (
                        <TextArea {...f} rows={2} disabled={viewOnly} placeholder="Describe work done for this task..." style={{ resize: 'none', fontSize: 12, borderRadius: 8 }} />
                      )} />

                      {/* Alert message (only on first row when alert is ON) */}
                      {index === 0 && (
                        <Controller control={control} name="isAlertIssue" render={({ field: af }) => af.value ? (
                          <div style={{ marginTop: 8 }}>
                            <Controller control={control} name="alertMessage" render={({ field: f }) => (
                              <Input {...f} prefix={<WarningOutlined style={{ color: '#ef4444' }} />}
                                placeholder="Describe the blocker or critical issue..." disabled={viewOnly}
                                style={{ borderRadius: 8, borderColor: '#ef4444', fontSize: 12 }} />
                            )} />
                          </div>
                        ) : null} />
                      )}
                    </div>
                  );
                })}

                {/* Add task for this project */}
                {!viewOnly && (
                  <button type="button" onClick={() => append({ projectId: selectedTopProjectId, ticketId: '', hoursInput: 0, minutesInput: 0, workDone: '' })}
                    style={{ width: '100%', height: 44, border: `2px dashed ${accent}60`, borderRadius: 10, background: 'transparent', color: accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add Another Task for this Project
                  </button>
                )}
              </div>

              {/* Footer submit */}
              <div style={{ padding: '10px 20px', borderTop: `1px solid ${border}`, background: card, display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
                {!viewOnly && (
                  <Button type="primary" icon={<CheckCircleOutlined />} loading={submitting}
                    style={{ background: emerald, borderColor: emerald, height: 38, fontWeight: 700, fontSize: 13, paddingInline: 28 }}
                    onClick={handleSubmit(onSubmit)}>Submit EOD Report</Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── MODALS ── */}
      <Modal title="Apply for Leave" open={isLeaveModalOpen} onCancel={() => setIsLeaveModalOpen(false)} footer={null} destroyOnClose>
        <Form form={leaveForm} layout="vertical" onFinish={handleApplyLeaveSubmit} style={{ marginTop: 16 }}>
          <Form.Item name="fromDate" label="From Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="toDate" label="To Date (optional)"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="type" label="Leave Type" rules={[{ required: true }]}>
            <Select options={[{ value: 'FullDay', label: 'Full Day Leave' }, { value: 'HalfDay', label: 'Half Day Leave' }, { value: 'Permission', label: 'Permission (< 2 hrs)' }]} />
          </Form.Item>
          <Form.Item name="reason" label="Reason"><TextArea rows={3} /></Form.Item>
          <Button type="primary" htmlType="submit" loading={leaveApplying} block style={{ background: accent, borderColor: accent }}>Submit Leave Request</Button>
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

      <Modal title="Hours Exceeded — Action Required" open={isHoursBlockedModalOpen} onCancel={() => setIsHoursBlockedModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsHoursBlockedModalOpen(false)}>Cancel</Button>,
          <Button key="req" type="primary" danger onClick={() => { setIsHoursBlockedModalOpen(false); const t = watchedItems?.[0]; handleOpenRequestModal('ExceededLimit', { id: t?.ticketId, title: 'EOD Report' }); }}>Request Additional Hours</Button>
        ]}>
        <Result icon={<ExclamationCircleFilled style={{ color: '#ff4d4f' }} />}
          title={`${fmtH(blockedSubmitTotal)} exceeds your quota`}
          subTitle="You must request additional hours approval before submitting." />
      </Modal>

      <Modal title="Request Additional Hours" open={isRequestModalOpen} onCancel={() => setIsRequestModalOpen(false)} footer={null} destroyOnClose>
        <Form form={requestForm} layout="vertical" onFinish={handleRequestSubmit} style={{ marginTop: 16 }}>
          <Form.Item name="ticketId" hidden><Input /></Form.Item>
          <Form.Item name="requestType" label="Request Type" rules={[{ required: true }]}>
            <Select options={[{ value: 'TimerMissed', label: 'Timer Missed' }, { value: 'ExceededLimit', label: 'Hours Exceeded' }]} />
          </Form.Item>
          {!['TeamLead', 'ProjectManager', 'TenantAdmin'].includes(role) && (
            <Form.Item name="teamLeadId" label="Team Lead" rules={[{ required: true }]}>
              <Select options={teamLeads.map(tl => ({ value: tl.id || tl.userId, label: tl.fullName || tl.name }))} />
            </Form.Item>
          )}
          <Form.Item name="requestedHours" label="Requested Hours" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
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
                  await reportAccessService.createRequest({ targetDate: target, reason: vals.reason, requestType: accessRequestType });
                }
                notification.success({ 
                  message: 'Access Requests Submitted', 
                  description: `Requested access from ${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}.` 
                });
              } else {
                const target = start.format('YYYY-MM-DD');
                await reportAccessService.createRequest({ targetDate: target, reason: vals.reason, requestType: accessRequestType });
                notification.success({ 
                  message: 'Access Request Submitted',
                  description: `Requested access for ${target}.`
                });
              }
              setIsAccessRequestModalOpen(false);
              fetchWeeklyStatus(weekDates);
              await fetchReportForDate(selectedDate);
            } catch { 
              notification.error({ message: 'Failed to submit access requests' }); 
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
