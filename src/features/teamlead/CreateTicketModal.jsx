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
      estimatedHours: 0,
      assignedTo: [],
      dueDate: null,
      milestone: ''
    }
  });
  
  const [users, setUsers] = useState([]);
  const [assignedEmployees, setAssignedEmployees] = useState([]);

  React.useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await adminService.getUsers();
      const allUsers = res.data || [];
      setUsers(allUsers);
    } catch (e) {
      console.error('Failed to fetch users');
    }
  };

  const projectTLId = project?.assignedTeamLeadId;
  const pmId = authUser?.userId || authUser?.id;
  let eligibleUsers = [];
  if (authRole === 'ProjectManager' || authRole === 'TenantAdmin' || authUser?.role === 'ProjectManager' || authUser?.role === 'TenantAdmin') {
    eligibleUsers = users.filter(u => {
      if (u.role !== 'Employee' && u.role !== 'TeamLead') return false;
      if (authRole === 'ProjectManager' || authUser?.role === 'ProjectManager') {
        if (u.role === 'TeamLead') {
          return String(u.projectManagerId) === String(pmId);
        }
        if (u.role === 'Employee') {
          if (String(u.projectManagerId) === String(pmId)) return true;
          if (u.teamLeadId) {
            const tl = users.find(tlUser => String(tlUser.id || tlUser.userId) === String(u.teamLeadId));
            if (tl && String(tl.projectManagerId) === String(pmId)) return true;
          }
          return false;
        }
      }
      return true;
    });
  } else {
    eligibleUsers = users.filter(u => {
      if (!projectTLId) return u.role === 'Employee' || u.role === 'TeamLead';
      if (u.role === 'TeamLead' && u.id === projectTLId) return true;
      if (u.role === 'Employee' && u.teamLeadId === projectTLId) return true;
      return false;
    });
  }

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const missingHours = assignedEmployees.some(emp => !emp.hours || emp.hours <= 0);
      if (missingHours) {
        notification.error({ message: 'Validation Error', description: 'Please assign valid hours for all selected employees.' });
        setLoading(false);
        return;
      }

      const totalTicketHours = assignedEmployees.reduce((sum, emp) => sum + emp.hours, 0);
      const projectTotalHours = Number(project?.totalHours || project?.approvedHours || 0);
      if (totalTicketHours > projectTotalHours) {
        notification.error({
          message: 'Validation Error',
          description: `Total assigned ticket hours (${totalTicketHours}h) must be less than the total hours allotted to the project (${projectTotalHours}h).`
        });
        setLoading(false);
        return;
      }

      const formattedData = {
        title: data.title,
        description: data.description,
        priority: data.priority,
        estimatedHours: assignedEmployees.reduce((sum, emp) => sum + emp.hours, 0),
        assignedToUserId: assignedEmployees[0]?.userId || null,
        assignedEmployees: assignedEmployees,
        dueDate: data.dueDate && dayjs(data.dueDate).isValid() ? dayjs(data.dueDate).toISOString() : null,
        milestone: data.milestone
      };
      await ticketService.createTicket(projectId, formattedData);
      notification.success({ message: 'Success', description: 'Ticket created successfully.' });
      reset();
      setAssignedEmployees([]);
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item label="Assigned Employees" required validateStatus={errors.assignedTo ? 'error' : ''} help={errors.assignedTo?.message}>
            <Controller
              name="assignedTo"
              control={control}
              rules={{ required: 'Please assign at least one employee' }}
              render={({ field }) => (
                <Select 
                  {...field} 
                  mode="multiple"
                  style={{ width: '100%' }} 
                  placeholder="Select employees"
                  onChange={(val) => {
                    field.onChange(val);
                    const newAssigned = val.map(id => {
                      const existing = assignedEmployees.find(emp => String(emp.userId) === String(id));
                      if (existing) return existing;
                      const user = eligibleUsers.find(u => String(u.id) === String(id));
                      return {
                        userId: Number(id),
                        name: user ? (user.name || user.fullName) : `Employee ${id}`,
                        hours: 0
                      };
                    });
                    setAssignedEmployees(newAssigned);
                  }}
                >
                  {eligibleUsers.map(u => (
                    <Select.Option key={u.id} value={u.id}>
                      {u.name || u.fullName} ({u.role})
                    </Select.Option>
                  ))}
                </Select>
              )}
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

        {assignedEmployees.length > 0 && (
          <Form.Item label="Assign Hours per Employee" required style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '12px 16px', background: '#fafafa' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {assignedEmployees.map((emp, index) => (
                <div key={emp.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <Text strong>{emp.name}</Text>
                  <InputNumber
                    min={0.5}
                    step={0.5}
                    placeholder="Hours"
                    value={emp.hours || undefined}
                    onChange={(val) => {
                      const numVal = Number(val) || 0;
                      const projectTotalHours = Number(project?.totalHours || project?.approvedHours || 0);
                      if (numVal > projectTotalHours) {
                        notification.error({
                          message: 'Invalid Hours',
                          description: `Assigned hours (${numVal}h) must be less than the total hours allotted to the project (${projectTotalHours}h).`
                        });
                        const updated = [...assignedEmployees];
                        updated[index].hours = 0;
                        setAssignedEmployees(updated);
                        return;
                      }
                      const updated = [...assignedEmployees];
                      updated[index].hours = numVal;
                      setAssignedEmployees(updated);
                    }}
                    style={{ width: 120 }}
                  />
                </div>
              ))}
            </Space>
          </Form.Item>
        )}

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
