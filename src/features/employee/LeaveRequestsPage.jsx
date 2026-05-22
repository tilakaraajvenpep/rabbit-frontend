import React, { useState, useEffect } from 'react';
import { Card, Form, DatePicker, Radio, Input, Button, Table, Tag, Space, notification, Typography, Alert, Modal, message } from 'antd';
import { CalendarOutlined, PlusOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { leaveService } from '../../services/leaveService';
import PageHeader from '../../components/common/PageHeader';

const { TextArea } = Input;
const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const LeaveRequestsPage = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  
  // Edit State
  const [editingLeave, setEditingLeave] = useState(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await leaveService.getMyLeaves();
      setLeaves(res.data);
    } catch (e) {
      notification.error({ message: 'Error', description: 'Failed to fetch leave requests.' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditLeave = (record) => {
    setEditingLeave(record);
    editForm.setFieldsValue({
      leaveDate: dayjs(record.leaveDate),
      type: record.type,
      reason: record.reason
    });
    setIsEditModalVisible(true);
  };

  const handleSaveEdit = async (values) => {
    try {
      await leaveService.updateLeave(editingLeave.leaveId, {
        leaveDate: values.leaveDate.format('YYYY-MM-DD'),
        type: values.type,
        reason: values.reason
      });
      notification.success({ message: 'Leave request updated successfully.' });
      setIsEditModalVisible(false);
      fetchLeaves();
    } catch (e) {
      const errMsg = e.response?.data?.message || 'Failed to update leave request.';
      notification.error({ message: 'Error', description: errMsg });
    }
  };

  const handleDeleteLeave = (leaveId) => {
    Modal.confirm({
      title: 'Delete Leave Request',
      content: 'Are you sure you want to cancel and delete this leave request?',
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
          await leaveService.deleteLeave(leaveId);
          message.success('Leave request deleted.');
          fetchLeaves();
        } catch (error) {
          console.error('Failed to delete leave request', error);
          message.error('Failed to delete leave request.');
        }
      }
    });
  };

  const handleApplyLeave = async (values) => {
    setSubmitting(true);
    try {
      const [fromMoment, toMoment] = values.leaveDates;
      const fromDate = fromMoment.format('YYYY-MM-DD');
      const toDate = toMoment.format('YYYY-MM-DD');
      
      // Client-side check for duplicate leave date
      // Generate dates in range to check against existing
      const dates = [];
      const start = dayjs(fromDate);
      const end = dayjs(toDate);
      let curr = start;
      while (curr.isBefore(end) || curr.isSame(end, 'day')) {
        dates.push(curr.format('YYYY-MM-DD'));
        curr = curr.add(1, 'day');
      }

      for (const d of dates) {
        const alreadyHasLeave = leaves.some(l => dayjs(l.leaveDate).format('YYYY-MM-DD') === d);
        if (alreadyHasLeave) {
          notification.error({
            message: 'Validation Error',
            description: `You have already applied for a leave on ${dayjs(d).format('DD/MM/YYYY')}.`
          });
          setSubmitting(false);
          return;
        }
      }

      await leaveService.applyLeave({
        fromDate,
        toDate,
        type: values.type,
        reason: values.reason
      });

      notification.success({
        message: 'Leave Requested',
        description: 'Your leave request has been submitted to your Team Lead and PM.'
      });

      form.resetFields();
      fetchLeaves();
    } catch (e) {
      const errMsg = e.response?.data?.message || 'Failed to submit leave request.';
      notification.error({ message: 'Error', description: errMsg });
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: 'Leave Date',
      dataIndex: 'leaveDate',
      key: 'leaveDate',
      render: (date) => dayjs(date).format('DD MMM YYYY (dddd)'),
      sorter: (a, b) => dayjs(a.leaveDate).unix() - dayjs(b.leaveDate).unix(),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color={type === 'FullDay' ? 'indigo' : 'cyan'}>
          {type === 'FullDay' ? 'Full Day' : 'Half Day'}
        </Tag>
      ),
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason) => reason || <Text type="secondary">N/A</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        let color = 'gold';
        let icon = <ClockCircleOutlined />;
        if (status === 'Approved') {
          color = 'success';
          icon = <CheckCircleOutlined />;
        } else if (status === 'Rejected') {
          color = 'error';
          icon = <CloseCircleOutlined />;
        }
        return (
          <Tag icon={icon} color={color} style={{ borderRadius: 6, padding: '2px 8px' }}>
            {status}
          </Tag>
        );
      },
    },
    {
      title: 'Applied On',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('DD MMM YYYY, hh:mm A'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => {
        if (record.status !== 'Pending') return null;
        return (
          <Space size="small">
            <Button 
              type="link" 
              size="small" 
              icon={<EditOutlined />}
              onClick={() => handleEditLeave(record)}
            >
              Edit
            </Button>
            <Button 
              type="link" 
              danger 
              size="small" 
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteLeave(record.leaveId)}
            >
              Delete
            </Button>
          </Space>
        );
      }
    }
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 40 }}>
      <PageHeader title="Leave Requests" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
        {/* Leave Form Card */}
        <div>
          <Card 
            title={
              <Space>
                <CalendarOutlined style={{ color: '#4f46e5' }} />
                <span>Apply for Leave</span>
              </Space>
            } 
            style={{ borderRadius: 12, boxShadow: '0 4px 20px rgba(99, 102, 241, 0.04)' }}
          >
            <Form form={form} layout="vertical" onFinish={handleApplyLeave} initialValues={{ type: 'FullDay' }}>
              <Form.Item 
                name="leaveDates" 
                label="Select Date Range (From - To)" 
                rules={[{ required: true, message: 'Please select leave dates' }]}
              >
                <RangePicker 
                  style={{ width: '100%' }} 
                  format="DD/MM/YYYY"
                  disabledDate={(current) => current && current.day() === 0} // Disable Sundays
                />
              </Form.Item>

              <Form.Item 
                name="type" 
                label="Duration Type" 
                rules={[{ required: true }]}
              >
                <Radio.Group style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Radio.Button value="FullDay" style={{ textAlign: 'center', height: 40, lineHeight: '38px', borderRadius: 8 }}>
                    Full Day
                  </Radio.Button>
                  <Radio.Button value="HalfDay" style={{ textAlign: 'center', height: 40, lineHeight: '38px', borderRadius: 8 }}>
                    Half Day
                  </Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Form.Item 
                name="reason" 
                label="Reason for Leave" 
                rules={[{ required: true, message: 'Please provide a reason' }]}
              >
                <TextArea rows={4} placeholder="E.g. medical checkup, family function..." />
              </Form.Item>

              <Button 
                type="primary" 
                htmlType="submit" 
                icon={<PlusOutlined />} 
                loading={submitting}
                block
                style={{ height: 42 }}
              >
                Submit Request
              </Button>
            </Form>
          </Card>
        </div>

        {/* Leave Requests Table */}
        <div>
          <Card 
            title="My Leave History" 
            style={{ borderRadius: 12, boxShadow: '0 4px 20px rgba(99, 102, 241, 0.04)' }}
          >
            <Table 
              columns={columns} 
              dataSource={leaves} 
              rowKey="leaveId"
              loading={loading}
              pagination={{ pageSize: 5 }}
              locale={{ emptyText: 'No leave requests submitted yet.' }}
            />
          </Card>
        </div>
      </div>

      <Modal
        title="Edit Leave Request"
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        onOk={() => editForm.submit()}
        okText="Save Changes"
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleSaveEdit}>
          <Form.Item 
            name="leaveDate" 
            label="Leave Date" 
            rules={[{ required: true, message: 'Please select a leave date' }]}
          >
            <DatePicker 
              style={{ width: '100%' }} 
              format="DD/MM/YYYY"
              disabledDate={(current) => current && current.day() === 0} // Disable Sundays
            />
          </Form.Item>

          <Form.Item 
            name="type" 
            label="Duration Type" 
            rules={[{ required: true }]}
          >
            <Radio.Group style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Radio.Button value="FullDay" style={{ textAlign: 'center', height: 40, lineHeight: '38px', borderRadius: 8 }}>
                Full Day
              </Radio.Button>
              <Radio.Button value="HalfDay" style={{ textAlign: 'center', height: 40, lineHeight: '38px', borderRadius: 8 }}>
                Half Day
              </Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item 
            name="reason" 
            label="Reason for Leave" 
            rules={[{ required: true, message: 'Please provide a reason' }]}
          >
            <TextArea rows={4} placeholder="E.g. medical checkup, family function..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LeaveRequestsPage;
