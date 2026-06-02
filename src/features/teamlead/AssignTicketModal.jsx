import React, { useState, useEffect } from 'react';
import { Modal, Select, Space, Avatar, Typography, notification, InputNumber } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { ticketService } from '../../services/ticketService';
import { adminService } from '../../services/adminService';
import { mockUsers } from '../../mocks/mockUsers';
import { useAuthStore } from '../../store/authStore';

const { Text } = Typography;

const AssignTicketModal = ({ open, onClose, ticket, onSuccess }) => {
  const { currentUser, role } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [assignedEmployees, setAssignedEmployees] = useState([]);

  useEffect(() => {
    if (open) {
      fetchEmployees();
    }
  }, [open, ticket]);

  const fetchEmployees = async () => {
    let eligibleUsers = [];
    try {
      const res = await adminService.getUsers();
      const allUsers = res.data || [];
      if (role === 'ProjectManager' || role === 'TenantAdmin') {
        eligibleUsers = allUsers.filter(u => u.role === 'Employee' || u.role === 'TeamLead');
      } else {
        eligibleUsers = allUsers.filter(u => u.role === 'Employee' || u.role === 'TeamLead');
      }
      setEmployees(eligibleUsers);
    } catch (e) {
      console.error('Failed to fetch employees');
      eligibleUsers = mockUsers.filter(u => u.role === 'Employee');
      setEmployees(eligibleUsers);
    }

    if (ticket?.assignedEmployees && Array.isArray(ticket.assignedEmployees)) {
      setAssignedEmployees(ticket.assignedEmployees);
      setSelectedUser(ticket.assignedEmployees.map(emp => emp.userId));
    } else if (ticket?.assignedTo) {
      const match = eligibleUsers.find(u => String(u.id) === String(ticket.assignedTo));
      const initAssignee = {
        userId: Number(ticket.assignedTo),
        name: match ? (match.name || match.fullName) : `Employee ${ticket.assignedTo}`,
        hours: Number(ticket.estimatedHours) || 0
      };
      setAssignedEmployees([initAssignee]);
      setSelectedUser([Number(ticket.assignedTo)]);
    } else {
      setAssignedEmployees([]);
      setSelectedUser([]);
    }
  };

  const handleAssign = async () => {
    const missingHours = assignedEmployees.some(emp => !emp.hours || emp.hours <= 0);
    if (missingHours) {
      notification.error({ message: 'Validation Error', description: 'Please assign valid hours for all selected employees.' });
      return;
    }

    setLoading(true);
    try {
      await ticketService.updateTicket(ticket.id, { assignedEmployees });
      notification.success({ message: 'Success', description: 'Ticket assignment updated successfully.' });
      onSuccess();
      onClose();
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to update ticket assignment.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Reassign Ticket"
      open={open}
      onCancel={onClose}
      onOk={handleAssign}
      confirmLoading={loading}
      width={500}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Text strong>Select Assignees:</Text>
          <Select 
            mode="multiple"
            style={{ width: '100%', marginTop: 8 }} 
            placeholder="Select employees"
            value={selectedUser}
            onChange={(val) => {
              setSelectedUser(val);
              const newAssigned = val.map(id => {
                const existing = assignedEmployees.find(emp => String(emp.userId) === String(id));
                if (existing) return existing;
                const user = employees.find(u => String(u.id) === String(id));
                return {
                  userId: Number(id),
                  name: user ? (user.name || user.fullName) : `Employee ${id}`,
                  hours: 0
                };
              });
              setAssignedEmployees(newAssigned);
            }}
          >
            {employees.map(emp => (
              <Select.Option key={emp.id} value={emp.id}>
                <Space>
                  <Avatar size="small" src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${emp.email}`} icon={<UserOutlined />} />
                  {emp.name || emp.fullName} ({emp.role})
                </Space>
              </Select.Option>
            ))}
          </Select>
        </div>

        {assignedEmployees.length > 0 && (
          <div style={{ marginTop: 16, border: '1px solid rgba(128, 128, 128, 0.15)', borderRadius: '8px', padding: '12px 16px', background: 'rgba(128, 128, 128, 0.04)' }}>
            <Text strong>Assign Hours per Employee:</Text>
            <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
              {assignedEmployees.map((emp, index) => (
                <div key={emp.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <Text strong>{emp.name}</Text>
                  <InputNumber
                    min={0.5}
                    step={0.5}
                    placeholder="Hours"
                    value={emp.hours || undefined}
                    onChange={(val) => {
                      const updated = [...assignedEmployees];
                      updated[index].hours = Number(val) || 0;
                      setAssignedEmployees(updated);
                    }}
                    style={{ width: 120 }}
                  />
                </div>
              ))}
            </Space>
          </div>
        )}
      </Space>
    </Modal>
  );
};

export default AssignTicketModal;
