import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, InputNumber, Select, Button, Space, Typography,
  Row, Col, Progress, Alert, notification, Tag, Result, Modal, Radio, theme
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SendOutlined, CheckCircleOutlined,
  CheckCircleFilled, ExclamationCircleFilled, ClockCircleOutlined,
  LeftOutlined, RightOutlined, ProjectOutlined, AlertOutlined
} from '@ant-design/icons';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { reportService } from '../../services/reportService';
import { ticketService } from '../../services/ticketService';
import { analyticsService } from '../../services/analyticsService';
import { leaveService } from '../../services/leaveService';

import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import PageHeader from '../../components/common/PageHeader';

const { TextArea } = Input;
const { Title, Text } = Typography;

const EODReportPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
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
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [existingReport, setExistingReport] = useState(null);
  const [currentLeave, setCurrentLeave] = useState(null);
  const [weeklyReports, setWeeklyReports] = useState([]);


  // Modal State for New Ticket
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [activeTicketRowIndex, setActiveTicketRowIndex] = useState(null);
  const [newTicketLoading, setNewTicketLoading] = useState(false);
  const [ticketForm] = Form.useForm();

  const { control, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm({
    defaultValues: {
      items: [{ ticketId: '', hours: 0, workDone: '' }],
      blockers: '',
      isAlertIssue: false,
      alertMessage: ''
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');
  const totalHours = watchedItems?.reduce((acc, curr) => acc + (curr.hours || 0), 0) || 0;
  
  // Dynamic quota based on half-day/full-day leave
  const baseRequiredHours = Number(currentUser?.allocatedHours) || 8.5;
  const REQUIRED_HOURS = currentLeave 
    ? (currentLeave.type === 'HalfDay' ? baseRequiredHours / 2 : 0)
    : baseRequiredHours;


  const selectedTicketIds = watchedItems?.map(item => item.ticketId).filter(id => !!id) || [];

  const hoursReportedOtherDays = weeklyReports
    .filter(r => r.date !== selectedDate)
    .reduce((sum, r) => {
      const dayHours = r.items?.reduce((s, item) => s + (Number(item.hoursSpent || item.hours) || 0), 0) || 0;
      return sum + dayHours;
    }, 0);

  const weeklyAllocated = baseRequiredHours * 5;
  const loggedThisWeek = hoursReportedOtherDays + totalHours;
  const remainingWeekly = Math.max(0, weeklyAllocated - loggedThisWeek);

  useEffect(() => {
    updateWeekDates(baseDate);
    fetchTickets();
    fetchProjects();
  }, []);

  useEffect(() => {
    updateWeekDates(baseDate);
  }, [baseDate]);

  useEffect(() => {
    fetchReportForDate(selectedDate);
  }, [selectedDate, currentUser.id, adminUnlocked]);

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

      const statusMap = {};
      dates.forEach(d => {
        const dateStr = d.format('YYYY-MM-DD');
        const report = res.data.find(r => r.date === dateStr);
        const endOfCurrentWeek = dayjs().endOf('week');
        const leave = userLeaves.find(l => dayjs(l.leaveDate).format('YYYY-MM-DD') === dateStr && l.status === 'Approved');

        if (d.day() === 0) statusMap[dateStr] = 'holiday';
        else if (leave) statusMap[dateStr] = leave.type === 'FullDay' ? 'full_leave' : 'half_leave';
        else if (report) statusMap[dateStr] = 'submitted';
        else if (d.isAfter(endOfCurrentWeek, 'day')) statusMap[dateStr] = 'not_available';
        else if (d.day() === 6) statusMap[dateStr] = 'optional';
        else if (d.isBefore(dayjs(), 'day')) statusMap[dateStr] = 'incomplete';
        else statusMap[dateStr] = 'pending';
      });
      setWeeklyStatus(statusMap);
    } catch (error) {
      console.error('Failed to fetch weekly status', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await projectService.getProjects();
      setAllProjects(res.data);
    } catch (e) {
      console.error('Failed to fetch projects');
    }
  };

  const fetchTickets = async () => {
    try {
      const res = await ticketService.getTickets();
      // Filter out completed tickets. The backend already filters by current user.
      setMyTickets(res.data.filter(t => t.status !== 'Done'));
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load tickets.' });
    }
  };

  const fetchReportForDate = async (date) => {
    setLoading(true);
    try {
      // Fetch leave for this date
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
      
      const isHoliday = dayjs(date).day() === 0;
      const endOfCurrentWeek = dayjs().endOf('week');
      const isFuture = dayjs(date).isAfter(endOfCurrentWeek, 'day');
      const hasReport = !!res.data;

      if (hasReport) {
        reset(res.data);
        setExistingReport(res.data);
        setViewOnly(true);
      } else {
        reset({ items: [{ ticketId: '', hours: 0, workDone: '' }], blockers: '', isAlertIssue: false, alertMessage: '' });
        setExistingReport(null);
        
        const isFullDayLeave = leaveOnDate && leaveOnDate.type === 'FullDay';
        if (isHoliday || (isFuture && !adminUnlocked) || isFullDayLeave) {
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

  // Logic to handle New Ticket Creation
  const handleCreateTicket = async (values) => {
    setNewTicketLoading(true);
    try {
      const payload = {
        title: values.title,
        description: values.description || '',
        priority: 'Medium',
        estimatedHours: values.estimatedHours || 8,
        assignedToUserId: currentUser.id,
        dueDate: dayjs().add(7, 'day').toISOString() // Default due date
      };
      const res = await ticketService.createTicket(values.projectId, payload);
      const newTicketId = res.data.id;
      
      const newTicket = {
        ...res.data,
        estimatedHours: Number(res.data.estimatedHours) || values.estimatedHours,
        consumedHours: 0
      };

      // Manually add the new ticket to state to avoid React batching delays
      setMyTickets(prev => [newTicket, ...prev]);

      notification.success({ message: 'Ticket Created', description: 'New ticket added to your list.' });
      setIsTicketModalOpen(false);
      ticketForm.resetFields();
      
      // Auto-assign to the active row
      if (activeTicketRowIndex !== null) {
        setValue(`items.${activeTicketRowIndex}.ticketId`, newTicketId);
      } else {
        const emptyIndex = watchedItems.findIndex(item => !item.ticketId);
        if (emptyIndex !== -1) {
          setValue(`items.${emptyIndex}.ticketId`, newTicketId);
        } else {
          append({ ticketId: newTicketId, hours: 0, workDone: '' });
        }
      }
      setActiveTicketRowIndex(null);
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to create ticket.' });
    } finally {
      setNewTicketLoading(false);
    }
  };

  const onSubmit = async (data) => {
    // Enforce allocated hours cap
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
          employeeName: currentUser.name,
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

  const getStatusDisplay = (date) => {
    const dateStr = date.format('YYYY-MM-DD');
    const status = weeklyStatus[dateStr];
    if (date.day() === 0) return <Tag color="default">Holiday</Tag>;

    switch (status) {
      case 'submitted':
        return <Space direction="vertical" size={0}><CheckCircleFilled style={{ color: '#52c41a' }} /><Text type="success" style={{ fontSize: 10 }}>Completed</Text></Space>;
      case 'incomplete':
        return <Space direction="vertical" size={0}><ExclamationCircleFilled style={{ color: '#ff4d4f' }} /><Text type="danger" style={{ fontSize: 10 }}>Incomplete</Text></Space>;
      case 'not_available':
        return <Space direction="vertical" size={0}><ClockCircleOutlined style={{ color: '#d9d9d9' }} /><Text disabled style={{ fontSize: 10 }}>Not Available</Text></Space>;
      case 'optional':
        return <Space direction="vertical" size={0}><ClockCircleOutlined style={{ color: '#bfbfbf' }} /><Text type="secondary" style={{ fontSize: 10 }}>Optional</Text></Space>;
      case 'full_leave':
        return <Space direction="vertical" size={0}><CheckCircleFilled style={{ color: '#818cf8' }} /><Text style={{ fontSize: 10, color: '#818cf8', fontWeight: 600 }}>Full Leave</Text></Space>;
      case 'half_leave':
        return <Space direction="vertical" size={0}><CheckCircleFilled style={{ color: '#22d3ee' }} /><Text style={{ fontSize: 10, color: '#22d3ee', fontWeight: 600 }}>Half Leave</Text></Space>;
      default:
        return <Space direction="vertical" size={0}><ClockCircleOutlined style={{ color: '#bfbfbf' }} /><Text type="secondary" style={{ fontSize: 10 }}>Pending</Text></Space>;
    }
  };

  const isLocked = viewOnly && !adminUnlocked;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>
      <PageHeader title="Weekly Work Report" />

      {/* Allocated Hours Banner */}
      <Card
        style={{
          marginBottom: 20,
          borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)',
          border: '1px solid rgba(99,102,241,0.25)',
        }}
        bodyStyle={{ padding: '14px 20px' }}
      >
        <Row align="middle" justify="space-between" gutter={[16, 16]}>
          <Col xs={24} sm={10}>
            <Space size={12}>
              <ClockCircleOutlined style={{ fontSize: 22, color: '#6366f1' }} />
              <div>
                <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Weekly Work Quota
                </Text>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#6366f1', lineHeight: 1.2 }}>
                  {weeklyAllocated.toFixed(1)}h / week
                </div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Daily Quota: {REQUIRED_HOURS}h/day
                </Text>
              </div>
            </Space>
          </Col>
          <Col xs={24} sm={14}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>
                  {totalHours.toFixed(1)}h
                </div>
                <Text type="secondary" style={{ fontSize: 11 }}>Logged Today</Text>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#6366f1' }}>
                  {loggedThisWeek.toFixed(1)}h
                </div>
                <Text type="secondary" style={{ fontSize: 11 }}>Logged This Week</Text>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: remainingWeekly > 0 ? '#fa9e0b' : '#6b7280' }}>
                  {remainingWeekly.toFixed(1)}h
                </div>
                <Text type="secondary" style={{ fontSize: 11 }}>Remaining Weekly</Text>
              </div>
            </div>
          </Col>
        </Row>
      </Card>


      {/* Weekly Navigator */}
      <Card style={{ marginBottom: 24, borderRadius: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button icon={<LeftOutlined />} onClick={handlePrevWeek} shape="circle" />
          <div style={{ display: 'flex', flex: 1, justifyContent: 'space-between', alignItems: 'center', overflowX: 'auto', padding: '10px 0' }}>
            {weekDates.map(date => {
              const isSelected = selectedDate === date.format('YYYY-MM-DD');
              return (
                <div
                  key={date.toString()}
                  onClick={() => {
                    if (weeklyStatus[date.format('YYYY-MM-DD')] === 'not_available') {
                      notification.warning({ message: 'Restricted', description: 'Contact admin to report for that day.' });
                      return;
                    }
                    setSelectedDate(date.format('YYYY-MM-DD'));
                  }}
                  style={{
                    textAlign: 'center', cursor: 'pointer', padding: '8px 12px', borderRadius: 12, minWidth: 90,
                    background: isSelected 
                      ? (isDarkMode ? 'rgba(79, 70, 229, 0.2)' : '#e6f7ff') 
                      : 'transparent',
                    border: isSelected 
                      ? `1px solid ${token.colorPrimary}` 
                      : `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#f0f0f0'}`
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 12 }}>{date.format('ddd')}</Text>
                  <div style={{ fontSize: 18, fontWeight: isSelected ? 700 : 400, margin: '2px 0' }}>{date.format('DD')}</div>
                  {getStatusDisplay(date)}
                </div>
              );
            })}
          </div>
          <Button icon={<RightOutlined />} onClick={handleNextWeek} shape="circle" />
        </div>
      </Card>

      {currentLeave && (
        <Alert
          message={currentLeave.type === 'FullDay' ? 'Full Day Leave Approved' : 'Half Day Leave Approved'}
          description={
            currentLeave.type === 'FullDay'
              ? 'You are on an approved Full Day Leave today. No daily report submission is required.'
              : `You are on an approved Half Day Leave today. Your required daily work quota is reduced by 50% to ${REQUIRED_HOURS} hours.`
          }
          type="warning"
          showIcon
          style={{ marginBottom: 24, borderRadius: 12 }}
        />
      )}

      {!isLocked && (
        <Alert
          message="Multi-Task Reporting"
          description="You can report work on multiple tickets. If a ticket is missing, use the 'New Ticket' button inside a task card."
          type="info" showIcon style={{ marginBottom: 24 }}
        />
      )}

      {dayjs(selectedDate).day() === 0 ? (
        <Result icon={<CheckCircleOutlined style={{ color: '#faad14' }} />} title="Happy Sunday!" />
      ) : currentLeave && currentLeave.type === 'FullDay' ? (
        <Result icon={<CheckCircleOutlined style={{ color: '#818cf8' }} />} title="On Approved Full Day Leave!" subTitle="No EOD report submission is required for today." />
      ) : (
        <Form layout="vertical" onFinish={handleSubmit(onSubmit)}>
          <Card style={{ marginBottom: 24, background: isDarkMode ? 'rgba(255, 255, 255, 0.02)' : '#fafafa' }}>
            <Row align="middle" gutter={24}>
              <Col span={12}>
                <Title level={5} style={{ margin: 0 }}>{dayjs(selectedDate).format('DD MMMM YYYY')}</Title>
                <Text type="secondary">
                  Allocated: <Text strong>{REQUIRED_HOURS}h</Text> &nbsp;|&nbsp; Logged: 
                  <Text strong type={totalHours >= REQUIRED_HOURS ? 'success' : totalHours > REQUIRED_HOURS * 0.8 ? 'warning' : 'secondary'}>
                    {' '}{totalHours.toFixed(1)}h
                  </Text>
                  {totalHours > REQUIRED_HOURS && (
                    <Text type="danger" style={{ marginLeft: 8, fontSize: 12 }}>⚠ Exceeds allocation!</Text>
                  )}
                </Text>
              </Col>
              <Col span={12}>
                <Progress
                  percent={Math.round(Math.min((totalHours / REQUIRED_HOURS) * 100, 100))}
                  status={totalHours >= REQUIRED_HOURS ? 'success' : 'active'}
                  format={(percent) => `${percent}%`}
                />
              </Col>
            </Row>
          </Card>

          {fields.map((field, index) => {
            const currentItemTicketId = watchedItems?.[index]?.ticketId;
            const ticketData = myTickets.find(t => t.id === currentItemTicketId);

            let maxAllowed = 0;
            if (ticketData) {
              maxAllowed = ticketData.estimatedHours - ticketData.consumedHours;
              const previouslySavedItem = existingReport?.items?.find(item => item.ticketId === currentItemTicketId);
              if (previouslySavedItem) {
                maxAllowed += previouslySavedItem.hours;
              }
            }

            return (
              <Card
                key={field.id}
                style={{ marginBottom: 16 }}
                size="small"
                title={
                  <Space>
                    <Text strong>Task {index + 1}</Text>
                    {currentItemTicketId && (
                      <Tag color={maxAllowed > 0 ? 'blue' : 'red'}>
                        Max Available: {maxAllowed.toFixed(1)} hrs
                      </Tag>
                    )}
                  </Space>
                }
                extra={
                  <Space>
                    {!isLocked && (
                      <Button
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          setActiveTicketRowIndex(index);
                          setIsTicketModalOpen(true);
                        }}
                      >
                        New Ticket
                      </Button>
                    )}
                    {!isLocked && fields.length > 1 && (
                      <Button icon={<DeleteOutlined />} danger type="text" onClick={() => remove(index)} />
                    )}
                  </Space>
                }
              >
                <Row gutter={16}>
                  <Col span={16}>
                    <Form.Item label="Ticket" required help={errors.items?.[index]?.ticketId?.message} validateStatus={errors.items?.[index]?.ticketId ? 'error' : ''}>
                      <Controller
                        name={`items.${index}.ticketId`}
                        control={control}
                        rules={{ required: !isLocked ? 'Required' : false }}
                        render={({ field }) => (
                          <Select
                            {...field}
                            disabled={isLocked}
                            placeholder="Select ticket"
                            showSearch
                            optionFilterProp="children"
                            onChange={(val) => {
                              field.onChange(val);
                              setValue(`items.${index}.hours`, 0);
                            }}
                          >
                            {myTickets.map(t => {
                              const isConsumed = t.estimatedHours <= t.consumedHours && !existingReport?.items?.some(i => i.ticketId === t.id);
                              const isAlreadySelectedElsewhere = selectedTicketIds.includes(t.id) && currentItemTicketId !== t.id;

                              return (
                                <Select.Option
                                  key={t.id}
                                  value={t.id}
                                  disabled={isConsumed || isAlreadySelectedElsewhere}
                                >
                                  <Space>
                                    {t.code} — {t.title}
                                    <Text type="secondary" style={{ fontSize: '11px' }}>
                                      ({(t.estimatedHours - t.consumedHours).toFixed(1)}h left)
                                    </Text>
                                    {isAlreadySelectedElsewhere && <Tag color="warning" style={{ fontSize: '10px' }}>Selected</Tag>}
                                  </Space>
                                </Select.Option>
                              );
                            })}
                          </Select>
                        )}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Hours" required help={errors.items?.[index]?.hours?.message} validateStatus={errors.items?.[index]?.hours ? 'error' : ''}>
                      <Controller
                        name={`items.${index}.hours`}
                        control={control}
                        rules={{
                          required: !isLocked ? 'Required' : false,
                          min: { value: 0.1, message: 'Min 0.1' },
                          max: { value: maxAllowed || 24, message: `Only ${maxAllowed}h left` }
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
                  <Col span={24}>
                    <Form.Item label="Work Done" required help={errors.items?.[index]?.workDone?.message} validateStatus={errors.items?.[index]?.workDone ? 'error' : ''}>
                      <Controller
                        name={`items.${index}.workDone`}
                        control={control}
                        rules={{ required: !isLocked ? 'Required' : false, minLength: { value: 5, message: 'Too short' } }}
                        render={({ field }) => <TextArea {...field} disabled={isLocked} rows={2} placeholder="What did you complete?" />}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            );
          })}

          {!isLocked && (
            <Button type="dashed" onClick={() => append({ ticketId: '', hours: 0, workDone: '' })} block icon={<PlusOutlined />} style={{ marginBottom: 24 }}>
              Add Task Row
            </Button>
          )}

          <Card title="Blockers" size="small" style={{ marginBottom: 24 }}>
            <Controller name="blockers" control={control} render={({ field }) => <TextArea {...field} disabled={isLocked} rows={2} />} />
          </Card>

          <Card title={<Space><AlertOutlined style={{color: 'red'}}/> Raise Alert Issue?</Space>} size="small" style={{ marginBottom: 24 }}>
            <Controller 
              name="isAlertIssue" 
              control={control} 
              render={({ field }) => (
                <Radio.Group {...field} disabled={isLocked} style={{ marginBottom: field.value ? 16 : 0 }}>
                  <Radio value={false}>No</Radio>
                  <Radio value={true}>Yes</Radio>
                </Radio.Group>
              )} 
            />
            {watch('isAlertIssue') && (
              <Controller 
                name="alertMessage" 
                control={control} 
                rules={{ required: watch('isAlertIssue') ? 'Please describe the alert issue' : false }}
                render={({ field }) => (
                  <Form.Item validateStatus={errors.alertMessage ? 'error' : ''} help={errors.alertMessage?.message} style={{ marginBottom: 0 }}>
                    <TextArea {...field} disabled={isLocked} rows={2} placeholder="Describe the critical alert issue..." />
                  </Form.Item>
                )} 
              />
            )}
          </Card>

          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => navigate(-1)}>Back</Button>
              {isLocked && existingReport && (
                <Button type="default" onClick={() => setViewOnly(false)}>
                  Add Tasks / Edit
                </Button>
              )}
              {!isLocked && existingReport && (
                <Button 
                  onClick={() => {
                    setViewOnly(true);
                    reset(existingReport);
                  }}
                >
                  Cancel
                </Button>
              )}
              {!isLocked && (
                <Button type="primary" icon={<SendOutlined />} htmlType="submit" loading={submitting} disabled={totalHours === 0}>
                  {existingReport ? 'Update Report' : 'Submit Report'}
                </Button>
              )}
            </Space>
          </div>
        </Form>
      )}

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
          <Form.Item name="projectId" label="Project Name" rules={[{ required: true, message: 'Please enter project name' }]}>
            <Input placeholder="Enter project name manually" />
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
    </div>
  );
};

export default EODReportPage;