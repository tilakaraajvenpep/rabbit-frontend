import React, { useState } from 'react';
import { Modal, Form, Input, Select, InputNumber, DatePicker, notification, Space, Alert } from 'antd';
import { useForm, Controller } from 'react-hook-form';
import dayjs from 'dayjs';
import { ticketService } from '../../services/ticketService';
import { adminService } from '../../services/adminService';
import { useAuthStore } from '../../store/authStore';

const { TextArea } = Input;

const CreateTicketModal = ({ open, onClose, projectId, project, onSuccess }) => {
  const { currentUser: authUser, role: authRole } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      title: '',
      description: '',
      priority: 'Medium',
      estimatedHours: 4,
      assignedTo: '',
      dueDate: null,
      milestone: ''
    }
  });
  
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);

  React.useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await adminService.getUsers();
      const allUsers = res.data || [];
      setUsers(allUsers);
      setEmployees(allUsers.filter(u => u.role === 'Employee'));
    } catch (e) {
      console.error('Failed to fetch users');
    }
  };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const formattedData = {
        title: data.title,
        description: data.description,
        priority: data.priority,
        estimatedHours: data.estimatedHours,
        assignedToUserId: data.assignedTo,
        dueDate: data.dueDate && dayjs(data.dueDate).isValid() ? dayjs(data.dueDate).toISOString() : null,
        milestone: data.milestone
      };
      await ticketService.createTicket(projectId, formattedData);
      notification.success({ message: 'Success', description: 'Ticket created successfully.' });
      reset();
      onSuccess();
      onClose();
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to create ticket.' });
    } finally {
      setLoading(false);
    }
  };



  return (
    <Modal
      title="Create New Ticket"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit(onSubmit)}
      confirmLoading={loading}
      width={640}
    >
      <Form layout="vertical">
        <Form.Item label="Ticket Title" required validateStatus={errors.title ? 'error' : ''} help={errors.title?.message}>
          <Controller
            name="title"
            control={control}
            rules={{ required: 'Title is required', maxLength: 500 }}
            render={({ field }) => <Input {...field} placeholder="Enter ticket title" maxLength={500} showCount />}
          />
        </Form.Item>

        <Form.Item label="Description">
          <Controller
            name="description"
            control={control}
            render={({ field }) => <TextArea {...field} rows={4} placeholder="Describe the task..." />}
          />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item label="Priority">
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <Select {...field} style={{ width: '100%' }}>
                  <Select.Option value="Critical">Critical</Select.Option>
                  <Select.Option value="High">High</Select.Option>
                  <Select.Option value="Medium">Medium</Select.Option>
                  <Select.Option value="Low">Low</Select.Option>
                </Select>
              )}
            />
          </Form.Item>

          <Form.Item label="Estimated Hours" required>
            <Controller
              name="estimatedHours"
              control={control}
              rules={{ required: true, min: 0.5 }}
              render={({ field }) => <InputNumber {...field} style={{ width: '100%' }} min={0.5} step={0.5} />}
            />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item label="Assigned Employee" required>
            <Controller
              name="assignedTo"
              control={control}
              rules={{ required: 'Please assign an employee' }}
              render={({ field }) => {
                const projectTLId = project?.assignedTeamLeadId;
                let eligibleUsers = [];
                if (authRole === 'ProjectManager' || authRole === 'TenantAdmin') {
                  const pmId = authUser?.userId || authUser?.id;
                  const pmName = authUser?.fullName || authUser?.name || 'Project Manager';
                  eligibleUsers = [{
                    id: pmId,
                    userId: pmId,
                    name: pmName,
                    fullName: pmName,
                    role: authRole
                  }];
                } else {
                  eligibleUsers = users.filter(u => {
                    if (!projectTLId) return u.role === 'Employee' || u.role === 'TeamLead';
                    if (u.role === 'TeamLead' && u.id === projectTLId) return true;
                    if (u.role === 'Employee' && u.teamLeadId === projectTLId) return true;
                    return false;
                  });
                }
                return (
                  <Select {...field} style={{ width: '100%' }} placeholder="Select employee">
                    {eligibleUsers.map(u => (
                      <Select.Option key={u.id} value={u.id}>
                        {u.name || u.fullName}
                      </Select.Option>
                    ))}
                  </Select>
                );
              }}
            />
          </Form.Item>

          <Form.Item label="Due Date" required>
            <Controller
              name="dueDate"
              control={control}
              rules={{ required: 'Due date is required' }}
              render={({ field }) => (
                <DatePicker 
                  {...field} 
                  format={['DD/MM/YYYY', 'DD/MM/YY', 'YYYY-MM-DD']} 
                  placeholder="DD/MM/YYYY" 
                  style={{ width: '100%' }} 
                />
              )}
            />
          </Form.Item>
        </div>

        <Form.Item label="Milestone Tag">
          <Controller
            name="milestone"
            control={control}
            render={({ field }) => <Input {...field} placeholder="e.g. Sprint 1, Phase 2" />}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateTicketModal;
