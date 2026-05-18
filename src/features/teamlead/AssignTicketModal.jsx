import React, { useState } from 'react';
import { Modal, Select, Space, Avatar, Typography, notification } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { ticketService } from '../../services/ticketService';
import { mockUsers } from '../../mocks/mockUsers';

const { Text } = Typography;

const AssignTicketModal = ({ open, onClose, ticket, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(ticket?.assignedTo);

  const handleAssign = async () => {
    if (!selectedUser) return;
    
    setLoading(true);
    try {
      await ticketService.assignTicket(ticket.id, selectedUser);
      notification.success({ message: 'Success', description: 'Ticket reassigned successfully.' });
      onSuccess();
      onClose();
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to reassign ticket.' });
    } finally {
      setLoading(false);
    }
  };

  const employees = mockUsers.filter(u => u.role === 'Employee');

  return (
    <Modal
      title="Reassign Ticket"
      open={open}
      onCancel={onClose}
      onOk={handleAssign}
      confirmLoading={loading}
      width={400}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Text type="secondary">Currently Assigned to:</Text>
          <div style={{ marginTop: 8 }}>
            <Space>
              <Avatar src={mockUsers.find(u => u.id === ticket?.assignedTo)?.avatar} />
              <Text strong>{mockUsers.find(u => u.id === ticket?.assignedTo)?.name || 'Unassigned'}</Text>
            </Space>
          </div>
        </div>

        <div>
          <Text strong>Select New Assignee:</Text>
          <Select 
            style={{ width: '100%', marginTop: 8 }} 
            placeholder="Select employee"
            value={selectedUser}
            onChange={setSelectedUser}
          >
            {employees.map(emp => (
              <Select.Option key={emp.id} value={emp.id}>
                <Space>
                  <Avatar size="small" src={emp.avatar} />
                  {emp.name}
                </Space>
              </Select.Option>
            ))}
          </Select>
        </div>
      </Space>
    </Modal>
  );
};

export default AssignTicketModal;
