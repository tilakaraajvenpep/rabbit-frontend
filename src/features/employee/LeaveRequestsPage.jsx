import React, { useState, useEffect } from 'react';
import {
  Form, DatePicker, Radio, Input, Button, Tag, Space,
  notification, Typography, Modal, message, Tooltip, Spin, Badge
} from 'antd';
import {
  CalendarOutlined, PlusOutlined, ClockCircleOutlined,
  CheckCircleOutlined, CloseCircleOutlined, EditOutlined,
  DeleteOutlined, SendOutlined, FileTextOutlined,
  CheckCircleFilled, ExclamationCircleFilled, CloseCircleFilled,
  SunOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { leaveService } from '../../services/leaveService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';

const { TextArea } = Input;
const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

/* ─── Status Config ──────────────────────────────────────────── */
const STATUS_CONFIG = {
  Pending:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  icon: <ClockCircleOutlined />,   label: 'Pending'  },
  Approved: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)',  icon: <CheckCircleFilled />,      label: 'Approved' },
  Rejected: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',   icon: <CloseCircleFilled />,      label: 'Rejected' },
};

const TYPE_CONFIG = {
  FullDay: { color: '#6366f1', bg: 'rgba(99,102,241,0.1)', label: 'Full Day',  icon: <SunOutlined /> },
  HalfDay: { color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',  label: 'Half Day', icon: <ClockCircleOutlined /> },
  Permission: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Permission', icon: <ClockCircleOutlined /> },
};

/* ─── Leave Card ─────────────────────────────────────────────── */
const LeaveCard = ({ leave, onEdit, onDelete }) => {
  const { isDarkMode } = useThemeStore();
  const statusCfg = STATUS_CONFIG[leave.status] || STATUS_CONFIG.Pending;
  const typeCfg   = TYPE_CONFIG[leave.type]     || TYPE_CONFIG.FullDay;
  const isPending = leave.status === 'Pending';

  return (
    <div style={{
      background: isDarkMode ? 'rgba(255,255,255,0.03)' : '#fff',
      border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : '#f0f0f0'}`,
      borderLeft: `4px solid ${statusCfg.color}`,
      borderRadius: 14,
      padding: '16px 20px',
      marginBottom: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      transition: 'box-shadow 0.2s, transform 0.15s',
      cursor: 'default',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 24px ${statusCfg.color}22`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Date blob */}
      <div style={{
        minWidth: 58, textAlign: 'center',
        background: `${statusCfg.color}15`,
        borderRadius: 12, padding: '8px 6px',
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: statusCfg.color, lineHeight: 1 }}>
          {dayjs(leave.leaveDate).format('DD')}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: statusCfg.color, opacity: 0.8 }}>
          {dayjs(leave.leaveDate).format('MMM')}
        </div>
        <div style={{ fontSize: 10, color: statusCfg.color, opacity: 0.7 }}>
          {dayjs(leave.leaveDate).format('ddd')}
        </div>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: typeCfg.bg, color: typeCfg.color,
            border: `1px solid ${typeCfg.color}40`,
            borderRadius: 20, padding: '2px 10px',
            fontSize: 11, fontWeight: 700,
          }}>
            {typeCfg.icon} {typeCfg.label}
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: statusCfg.bg, color: statusCfg.color,
            border: `1px solid ${statusCfg.border}`,
            borderRadius: 20, padding: '2px 10px',
            fontSize: 11, fontWeight: 700,
          }}>
            {statusCfg.icon} {statusCfg.label}
          </span>
        </div>
        <Text
          style={{ fontSize: 13, display: 'block', color: isDarkMode ? 'rgba(255,255,255,0.65)' : '#6b7280' }}
          ellipsis={{ tooltip: leave.reason }}
        >
          {leave.reason || <em style={{ opacity: 0.5 }}>No reason provided</em>}
        </Text>
        <Text type="secondary" style={{ fontSize: 11 }}>
          Applied {dayjs(leave.createdAt).format('DD MMM YYYY, hh:mm A')}
        </Text>
      </div>

      {/* Actions (Pending only) */}
      {isPending && (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(leave)}
              style={{ color: '#6366f1' }}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => onDelete(leave.leaveId)}
            />
          </Tooltip>
        </Space>
      )}
    </div>
  );
};

/* ─── Stat Pill ──────────────────────────────────────────────── */
const StatPill = ({ label, count, color, bg }) => (
  <div style={{
    background: bg,
    border: `1px solid ${color}40`,
    borderRadius: 12, padding: '12px 20px',
    textAlign: 'center', flex: 1, minWidth: 100,
  }}>
    <div style={{ fontSize: 26, fontWeight: 800, color }}>{count}</div>
    <div style={{ fontSize: 11, fontWeight: 600, color, opacity: 0.8, marginTop: 2 }}>{label}</div>
  </div>
);

/* ─── Main Page ──────────────────────────────────────────────── */
const LeaveRequestsPage = () => {
  const { isDarkMode } = useThemeStore();
  const [leaves, setLeaves]         = useState([]);
  const [loading, setLoading]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form]                      = Form.useForm();
  const [editForm]                  = Form.useForm();
  const [editingLeave, setEditingLeave]               = useState(null);
  const [isEditModalVisible, setIsEditModalVisible]   = useState(false);
  const [filterStatus, setFilterStatus]               = useState('All');

  useEffect(() => { fetchLeaves(); }, []);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await leaveService.getMyLeaves();
      setLeaves(res.data || []);
    } catch (e) {
      notification.error({ message: 'Error', description: 'Failed to fetch leave requests.' });
    } finally {
      setLoading(false);
    }
  };

  /* Stats */
  const stats = {
    Total:    leaves.length,
    Approved: leaves.filter(l => l.status === 'Approved').length,
    Pending:  leaves.filter(l => l.status === 'Pending').length,
    Rejected: leaves.filter(l => l.status === 'Rejected').length,
  };

  const filteredLeaves = filterStatus === 'All'
    ? leaves
    : leaves.filter(l => l.status === filterStatus);

  /* Submit */
  const handleApplyLeave = async (values) => {
    setSubmitting(true);
    try {
      const [fromMoment, toMoment] = values.leaveDates;
      const fromDate = fromMoment.format('YYYY-MM-DD');
      const toDate   = toMoment.format('YYYY-MM-DD');

      // Client-side duplicate check
      let curr = dayjs(fromDate);
      while (curr.isBefore(dayjs(toDate)) || curr.isSame(dayjs(toDate), 'day')) {
        const d = curr.format('YYYY-MM-DD');
        if (leaves.some(l => dayjs(l.leaveDate).format('YYYY-MM-DD') === d)) {
          notification.error({
            message: 'Duplicate Date',
            description: `You already have a leave request on ${dayjs(d).format('DD MMM YYYY')}.`,
          });
          setSubmitting(false);
          return;
        }
        curr = curr.add(1, 'day');
      }

      await leaveService.applyLeave({ fromDate, toDate, type: values.type, reason: values.reason });
      notification.success({
        message: '🎉 Leave Requested!',
        description: 'Your request has been sent to your Team Lead and PM.',
      });
      form.resetFields();
      fetchLeaves();
    } catch (e) {
      notification.error({ message: 'Error', description: e.response?.data?.message || 'Failed to submit.' });
    } finally {
      setSubmitting(false);
    }
  };

  /* Edit */
  const handleEditLeave = (record) => {
    setEditingLeave(record);
    editForm.setFieldsValue({ leaveDate: dayjs(record.leaveDate), type: record.type, reason: record.reason });
    setIsEditModalVisible(true);
  };

  const handleSaveEdit = async (values) => {
    try {
      await leaveService.updateLeave(editingLeave.leaveId, {
        leaveDate: values.leaveDate.format('YYYY-MM-DD'),
        type: values.type,
        reason: values.reason,
      });
      message.success('Leave request updated.');
      setIsEditModalVisible(false);
      fetchLeaves();
    } catch (e) {
      notification.error({ message: 'Update Failed', description: e.response?.data?.message || 'Try again.' });
    }
  };

  /* Delete */
  const handleDeleteLeave = (leaveId) => {
    Modal.confirm({
      title: 'Cancel Leave Request',
      content: 'This will permanently remove the leave request. Continue?',
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        await leaveService.deleteLeave(leaveId);
        message.success('Leave request deleted.');
        fetchLeaves();
      },
    });
  };

  /* ─── RENDER ─────────────────────────────────────────── */
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 60 }}>
      <PageHeader title="Leave Requests" />

      {/* ── Stats Strip ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <StatPill label="Total"    count={stats.Total}    color="#6366f1" bg="rgba(99,102,241,0.08)"  />
        <StatPill label="Approved" count={stats.Approved} color="#10b981" bg="rgba(16,185,129,0.08)" />
        <StatPill label="Pending"  count={stats.Pending}  color="#f59e0b" bg="rgba(245,158,11,0.08)" />
        <StatPill label="Rejected" count={stats.Rejected} color="#ef4444" bg="rgba(239,68,68,0.08)"  />
      </div>

      {/* ── Two Column Layout ─────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
        gap: 24,
        alignItems: 'start',
      }}>

        {/* ── LEFT: Apply Form ──────────────────────────── */}
        <div>
          <div style={{
            borderRadius: 18,
            background: isDarkMode
              ? 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)'
              : 'linear-gradient(135deg, #f0f0ff 0%, #faf5ff 100%)',
            border: `1px solid ${isDarkMode ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.2)'}`,
            padding: '28px 24px',
          }}>
            {/* Form header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CalendarOutlined style={{ color: '#fff', fontSize: 18 }} />
              </div>
              <div>
                <Title level={5} style={{ margin: 0, fontSize: 15 }}>Apply for Leave</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>Submit your leave request</Text>
              </div>
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleApplyLeave}
              initialValues={{ type: 'FullDay' }}
            >
              <Form.Item
                name="leaveDates"
                label={<Text strong style={{ fontSize: 13 }}>Date Range</Text>}
                rules={[{ required: true, message: 'Please select leave dates' }]}
              >
                <RangePicker
                  style={{ width: '100%', borderRadius: 10 }}
                  format="DD/MM/YYYY"
                  disabledDate={(c) => c && c.day() === 0}
                />
              </Form.Item>

              <Form.Item
                name="type"
                label={<Text strong style={{ fontSize: 13 }}>Leave Type</Text>}
                rules={[{ required: true }]}
              >
                <Radio.Group style={{ width: '100%' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[
                      { value: 'FullDay', label: 'Full Day',  color: '#6366f1', icon: <SunOutlined /> },
                      { value: 'HalfDay', label: 'Half Day', color: '#06b6d4', icon: <ClockCircleOutlined /> },
                      { value: 'Permission', label: 'Permission', color: '#f59e0b', icon: <ClockCircleOutlined /> },
                    ].map(opt => (
                      <Radio.Button
                        key={opt.value}
                        value={opt.value}
                        style={{
                          textAlign: 'center',
                          height: 44, lineHeight: '42px',
                          borderRadius: 10, fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        {opt.icon} {opt.label}
                      </Radio.Button>
                    ))}
                  </div>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                name="reason"
                label={<Text strong style={{ fontSize: 13 }}>Reason</Text>}
                rules={[{ required: true, message: 'Please provide a reason' }]}
              >
                <TextArea
                  rows={4}
                  placeholder="E.g. Medical checkup, family function..."
                  style={{ borderRadius: 10, resize: 'none' }}
                />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                icon={<SendOutlined />}
                loading={submitting}
                block
                style={{
                  height: 46, borderRadius: 12,
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none', fontSize: 14, fontWeight: 700,
                  boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
                }}
              >
                Submit Request
              </Button>
            </Form>
          </div>

          {/* Info note */}
          <div style={{
            marginTop: 12, padding: '10px 14px', borderRadius: 10,
            background: isDarkMode ? 'rgba(6,182,212,0.08)' : 'rgba(6,182,212,0.06)',
            border: '1px solid rgba(6,182,212,0.2)',
            display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <InfoCircleOutlined style={{ color: '#06b6d4', marginTop: 2, flexShrink: 0 }} />
            <Text style={{ fontSize: 11, color: isDarkMode ? 'rgba(255,255,255,0.55)' : '#6b7280' }}>
              Sundays are excluded. Only <strong>Pending</strong> requests can be edited or deleted.
              Approved/Rejected requests are final.
            </Text>
          </div>
        </div>

        {/* ── RIGHT: Leave History ─────────────────────── */}
        <div>
          {/* Header + Filter */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileTextOutlined style={{ color: '#6366f1', fontSize: 18 }} />
              <Title level={5} style={{ margin: 0 }}>My Leave History</Title>
              <span style={{
                background: 'rgba(99,102,241,0.1)', color: '#6366f1',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: 20, padding: '1px 10px', fontSize: 12, fontWeight: 700,
              }}>
                {filteredLeaves.length}
              </span>
            </div>

            {/* Filter buttons */}
            <Space size={6} wrap>
              {['All', 'Pending', 'Approved', 'Rejected'].map(s => {
                const cfg = s === 'All'
                  ? { color: '#6366f1', bg: 'rgba(99,102,241,0.1)' }
                  : STATUS_CONFIG[s];
                const active = filterStatus === s;
                return (
                  <Button
                    key={s}
                    size="small"
                    onClick={() => setFilterStatus(s)}
                    style={{
                      borderRadius: 20,
                      background: active ? cfg.color : 'transparent',
                      color:      active ? '#fff'   : cfg.color,
                      border: `1px solid ${active ? cfg.color : `${cfg.color}50`}`,
                      fontWeight: 600, fontSize: 11,
                      transition: 'all 0.2s',
                    }}
                  >
                    {s}
                  </Button>
                );
              })}
            </Space>
          </div>

          {/* List */}
          <Spin spinning={loading}>
            {filteredLeaves.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '60px 20px',
                border: `2px dashed ${isDarkMode ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
                borderRadius: 16,
                background: isDarkMode ? 'rgba(255,255,255,0.02)' : '#fafafa',
              }}>
                <CalendarOutlined style={{ fontSize: 48, color: '#d1d5db', marginBottom: 12 }} />
                <div style={{ color: '#9ca3af', fontWeight: 600 }}>No leave requests found</div>
                <div style={{ color: '#d1d5db', fontSize: 12, marginTop: 4 }}>
                  {filterStatus !== 'All' ? `No ${filterStatus.toLowerCase()} requests` : 'Start by applying for leave on the left'}
                </div>
              </div>
            ) : (
              <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>
                {filteredLeaves
                  .sort((a, b) => dayjs(b.leaveDate).unix() - dayjs(a.leaveDate).unix())
                  .map(leave => (
                    <LeaveCard
                      key={leave.leaveId}
                      leave={leave}
                      onEdit={handleEditLeave}
                      onDelete={handleDeleteLeave}
                    />
                  ))
                }
              </div>
            )}
          </Spin>
        </div>
      </div>

      {/* ── Edit Modal ──────────────────────────────────── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <EditOutlined style={{ color: '#fff', fontSize: 14 }} />
            </div>
            <span>Edit Leave Request</span>
          </div>
        }
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        onOk={() => editForm.submit()}
        okText="Save Changes"
        okButtonProps={{
          style: {
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            border: 'none', borderRadius: 8, fontWeight: 700,
          }
        }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        destroyOnClose
        styles={{ body: { paddingTop: 16 } }}
      >
        <Form form={editForm} layout="vertical" onFinish={handleSaveEdit}>
          <Form.Item
            name="leaveDate"
            label="Leave Date"
            rules={[{ required: true, message: 'Please select a date' }]}
          >
            <DatePicker
              style={{ width: '100%', borderRadius: 10 }}
              format="DD/MM/YYYY"
              disabledDate={(c) => c && c.day() === 0}
            />
          </Form.Item>

          <Form.Item
            name="type"
            label="Leave Type"
            rules={[{ required: true }]}
          >
            <Radio.Group style={{ width: '100%' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <Radio.Button value="FullDay"  style={{ textAlign: 'center', height: 40, lineHeight: '38px', borderRadius: 8 }}>Full Day</Radio.Button>
                <Radio.Button value="HalfDay" style={{ textAlign: 'center', height: 40, lineHeight: '38px', borderRadius: 8 }}>Half Day</Radio.Button>
                <Radio.Button value="Permission" style={{ textAlign: 'center', height: 40, lineHeight: '38px', borderRadius: 8 }}>Permission</Radio.Button>
              </div>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="reason"
            label="Reason"
            rules={[{ required: true, message: 'Please provide a reason' }]}
          >
            <TextArea rows={3} placeholder="Update your reason..." style={{ borderRadius: 10 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LeaveRequestsPage;
