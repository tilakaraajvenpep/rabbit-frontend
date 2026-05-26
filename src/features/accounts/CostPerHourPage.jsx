import React, { useState, useEffect } from 'react';
import { Table, InputNumber, Button, Space, Typography, Tag, notification, Skeleton, Input } from 'antd';
import { SaveOutlined, SearchOutlined, EditOutlined } from '@ant-design/icons';
import { adminService } from '../../services/adminService';
import PageHeader from '../../components/common/PageHeader';

const { Text } = Typography;

const CostPerHourPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  
  // Track which rows are being edited
  const [editingKey, setEditingKey] = useState('');
  const [tempCost, setTempCost] = useState(null);
  const [savingKeys, setSavingKeys] = useState({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await adminService.getUsers();
      setUsers(res.data || []);
    } catch (err) {
      notification.error({ message: 'Error', description: 'Failed to load user cost details.' });
    } finally {
      setLoading(false);
    }
  };

  const isEditing = (record) => record.id === editingKey;

  const startEdit = (record) => {
    setEditingKey(record.id);
    setTempCost(Number(record.costPerHour) || 0);
  };

  const cancelEdit = () => {
    setEditingKey('');
    setTempCost(null);
  };

  const saveCost = async (userId) => {
    if (tempCost === null || tempCost < 0) {
      notification.warning({ message: 'Validation', description: 'Please enter a valid cost per hour.' });
      return;
    }

    setSavingKeys(prev => ({ ...prev, [userId]: true }));
    try {
      await adminService.updateCostPerHour(userId, tempCost);
      notification.success({ 
        message: 'Rate Updated', 
        description: 'Cost per hour updated successfully.' 
      });
      setEditingKey('');
      setTempCost(null);
      // Refresh list
      const res = await adminService.getUsers();
      setUsers(res.data || []);
    } catch (err) {
      notification.error({ message: 'Error', description: 'Failed to update hourly rate.' });
    } finally {
      setSavingKeys(prev => ({ ...prev, [userId]: false }));
    }
  };

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  const columns = [
    {
      title: 'Full Name',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <Text strong>{text || '-'}</Text>
    },
    {
      title: 'Email Address',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role) => {
        let color = 'blue';
        if (role === 'ProjectManager') color = 'purple';
        if (role === 'TeamLead') color = 'geekblue';
        if (role === 'Accounts') color = 'gold';
        return <Tag color={color}>{role}</Tag>;
      }
    },
    {
      title: 'Cost Per Hour',
      dataIndex: 'costPerHour',
      key: 'costPerHour',
      width: 250,
      render: (val, record) => {
        const editable = isEditing(record);
        const saving = savingKeys[record.id];

        if (editable) {
          return (
            <Space>
              <InputNumber
                value={tempCost}
                min={0}
                formatter={value => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={value => value.replace(/\₹\s?|(,*)/g, '')}
                onChange={setTempCost}
                style={{ width: 140 }}
                autoFocus
                onPressEnter={() => saveCost(record.id)}
              />
              <Button 
                type="primary" 
                size="small" 
                icon={<SaveOutlined />} 
                onClick={() => saveCost(record.id)}
                loading={saving}
              />
              <Button size="small" onClick={cancelEdit}>Cancel</Button>
            </Space>
          );
        }

        return (
          <Space>
            <Text strong style={{ color: '#0f766e', fontSize: '15px' }}>
              ₹{Number(val || 0).toLocaleString('en-IN')}/hr
            </Text>
            <Button 
              type="text" 
              size="small" 
              icon={<EditOutlined />} 
              onClick={() => startEdit(record)} 
            />
          </Space>
        );
      }
    }
  ];

  return (
    <div>
      <PageHeader 
        title="Employee Cost Per Hour"
        subtitle="Configure hourly internal cost rates for project profit & loss calculations"
      />

      <div style={{ marginBottom: 16 }}>
        <Input 
          prefix={<SearchOutlined />} 
          placeholder="Search users by name, email or role..." 
          style={{ width: 300 }} 
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      <Table 
        dataSource={users.filter(user => {
          const term = searchText.toLowerCase();
          const name = (user.name || user.fullName || '').toLowerCase();
          const email = (user.email || '').toLowerCase();
          const role = (user.role || '').toLowerCase();
          return name.includes(term) || email.includes(term) || role.includes(term);
        })} 
        columns={columns} 
        rowKey="id" 
        pagination={{ pageSize: 10 }} 
      />
    </div>
  );
};

export default CostPerHourPage;
