import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Switch, notification, Space, Typography, Tag, Skeleton, Popconfirm, InputNumber, Card } from 'antd';
import { UserAddOutlined, SearchOutlined, SaveOutlined, EditOutlined, FileExcelOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { adminService } from '../../services/adminService';
import { projectService } from '../../services/projectService';
import PageHeader from '../../components/common/PageHeader';
import ExcelUserUploadModal from '../../components/common/ExcelUserUploadModal';
import { getFeaturesForRoles } from '../../utils/permissionUtils';

const { Text } = Typography;

const AccountsUserManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editingCostKey, setEditingCostKey] = useState('');
  const [tempCost, setTempCost] = useState(null);
  const [savingKeys, setSavingKeys] = useState({});
  const [isDesignationModalOpen, setIsDesignationModalOpen] = useState(false);
  const [selectedUserForDesignation, setSelectedUserForDesignation] = useState(null);
  const [designationForm] = Form.useForm();

  // Permission states
  const [permissionForm] = Form.useForm();
  const [permissionUser, setPermissionUser] = useState(null);
  const [permissionModalFeatures, setPermissionModalFeatures] = useState([]);
  const [addModalFeatures, setAddModalFeatures] = useState([]);

  const handleUpdateDesignation = async (values) => {
    try {
      await adminService.updateUserDesignation(selectedUserForDesignation.id, values.designation);
      notification.success({ 
        message: 'Designation Updated', 
        description: `Successfully updated designation to "${values.designation}".` 
      });
      setIsDesignationModalOpen(false);
      setSelectedUserForDesignation(null);
      designationForm.resetFields();
      fetchUsers();
    } catch (error) {
      notification.error({ 
        message: 'Update Failed', 
        description: error.response?.data?.message || 'Failed to update designation.' 
      });
    }
  };

  const [form] = Form.useForm();
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [resetForm] = Form.useForm();

  const handleResetPassword = async (values) => {
    try {
      await adminService.resetUserPassword(resetPasswordUser.id, values.newPassword);
      notification.success({ 
        message: 'Password Reset', 
        description: `Successfully reset password for ${resetPasswordUser.name || resetPasswordUser.fullName || 'user'}.` 
      });
      setResetPasswordUser(null);
      resetForm.resetFields();
    } catch (error) {
      notification.error({ 
        message: 'Reset Failed', 
        description: error.response?.data?.message || 'Failed to reset password.' 
      });
    }
  };

  const handleSavePermissions = async (values) => {
    try {
      await Promise.all([
        adminService.updateUserRole(permissionUser.id, values.role),
        adminService.updateUserPermissions(permissionUser.id, values.permissions)
      ]);
      
      notification.success({
        message: 'Permissions Updated',
        description: `Successfully updated role and permissions for ${permissionUser.name || permissionUser.fullName}.`
      });
      
      setPermissionUser(null);
      permissionForm.resetFields();
      setPermissionModalFeatures([]);
      fetchUsers();
    } catch (error) {
      notification.error({
        message: 'Update Failed',
        description: error.response?.data?.message || 'Failed to update user permissions.'
      });
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, projectsRes] = await Promise.all([
        adminService.getUsers(),
        projectService.getProjects()
      ]);
      setUsers(usersRes.data || []);
      setProjects(projectsRes.data || []);
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load user management data.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = () => fetchData();

  const handleInvite = async (values) => {
    try {
      await adminService.inviteUser(values);
      notification.success({ 
        message: 'User Created', 
        description: `Successfully created user ${values.fullName} (${values.email}).` 
      });
      setIsModalOpen(false);
      form.resetFields();
      setAddModalFeatures([]);
      fetchUsers();
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to create user.' });
    }
  };

  const handleRoleChange = async (userId, role) => {
    try {
      await adminService.updateUserRole(userId, role);
      notification.success({ message: 'Role Updated' });
      fetchUsers();
    } catch (error) {
      notification.error({ message: 'Update Failed' });
    }
  };

  const handleTeamLeadChange = async (userId, teamLeadId) => {
    try {
      await adminService.updateUserTeamLead(userId, teamLeadId || null);
      notification.success({ message: 'Team Lead Updated' });
      fetchUsers();
    } catch (error) {
      notification.error({ message: 'Update Failed' });
    }
  };

  const handleStatusToggle = async (userId) => {
    try {
      await adminService.toggleUserStatus(userId);
      notification.success({ message: 'Status Updated' });
      fetchUsers();
    } catch (error) {
      notification.error({ message: 'Update Failed' });
    }
  };

  const handleProjectManagerChange = async (userId, projectManagerId) => {
    try {
      await adminService.updateUserProjectManager(userId, projectManagerId || null);
      notification.success({ message: 'Project Manager Updated' });
      fetchUsers();
    } catch (error) {
      notification.error({ message: 'Update Failed' });
    }
  };

  const isEditingCost = (record) => record.id === editingCostKey;

  const startEditCost = (record) => {
    setEditingCostKey(record.id);
    setTempCost(Number(record.costPerHour) || 0);
  };

  const cancelEditCost = () => {
    setEditingCostKey('');
    setTempCost(null);
  };

  const saveCostPerHour = async (userId) => {
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
      setEditingCostKey('');
      setTempCost(null);
      fetchUsers();
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
      width: 240,
      render: (text, record) => {
        const nameVal = text || record.fullName || '-';
        const initials = nameVal.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: 13,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              flexShrink: 0
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <Text strong style={{ display: 'block', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {nameVal}
              </Text>
              <Text type="secondary" style={{ fontSize: '11px' }}>ID: #{record.id}</Text>
            </div>
          </div>
        );
      }
    },
    {
      title: 'Email Address',
      dataIndex: 'email',
      key: 'email',
      width: 220,
      render: (text) => <Text style={{ fontSize: '13px', wordBreak: 'break-all', color: '#4b5563' }}>{text}</Text>
    },
    {
      title: 'Designation',
      dataIndex: 'designation',
      key: 'designation',
      width: 180,
      render: (text, record) => (
        <Space>
          <span style={{ fontSize: '13px', color: '#4b5563' }}>{text || <span style={{ color: '#aaa', fontStyle: 'italic' }}>Not Set</span>}</span>
          <Button 
            type="text" 
            size="small" 
            icon={<EditOutlined style={{ color: '#8b5cf6' }} />} 
            onClick={() => {
              setSelectedUserForDesignation(record);
              designationForm.setFieldsValue({ designation: record.designation || '' });
              setIsDesignationModalOpen(true);
            }} 
          />
        </Space>
      )
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 200,
      render: (role, record) => {
        const rolesArray = typeof role === 'string' 
          ? role.split(',').map(r => r.trim()).filter(Boolean) 
          : (Array.isArray(role) ? role : []);
        return (
          <Select 
            mode="multiple"
            value={rolesArray} 
            style={{ width: '100%', minWidth: 160 }} 
            onChange={(newRole) => handleRoleChange(record.id, newRole)}
            maxTagCount="responsive"
            placeholder="Select roles"
          >
            <Select.Option value="Sales">Sales</Select.Option>
            <Select.Option value="Accounts">Accounts</Select.Option>
            <Select.Option value="TeamLead">Team Lead</Select.Option>
            <Select.Option value="Employee">Employee</Select.Option>
            <Select.Option value="ProjectManager">PM</Select.Option>
            <Select.Option value="HR">HR</Select.Option>
          </Select>
        );
      }
    },
    {
      title: 'Reporting TL',
      dataIndex: 'teamLeadId',
      key: 'teamLead',
      width: 180,
      render: (tlId, record) => {
        if (record.role !== 'Employee') return <Tag color="default" style={{ margin: 0 }}>N/A</Tag>;
        return (
          <Select
            value={tlId || undefined}
            placeholder="No Team Lead"
            style={{ width: '100%' }}
            allowClear
            onChange={(newTlId) => handleTeamLeadChange(record.id, newTlId)}
          >
            {users.filter(u => u.role === 'TeamLead').map(tl => (
              <Select.Option key={tl.id} value={tl.id}>
                {tl.name}
              </Select.Option>
            ))}
          </Select>
        );
      }
    },
    {
      title: 'Reporting PM',
      dataIndex: 'projectManagerId',
      key: 'projectManager',
      width: 180,
      render: (pmId, record) => {
        if (record.role !== 'Employee' && record.role !== 'TeamLead') return <Tag color="default" style={{ margin: 0 }}>N/A</Tag>;
        return (
          <Select
            value={pmId || undefined}
            placeholder="No PM"
            style={{ width: '100%' }}
            allowClear
            onChange={(newPmId) => handleProjectManagerChange(record.id, newPmId)}
          >
            {users.filter(u => u.role === 'ProjectManager' || u.role === 'TenantAdmin').map(pm => (
              <Select.Option key={pm.id} value={pm.id}>
                {pm.name}
              </Select.Option>
            ))}
          </Select>
        );
      }
    },
    {
      title: 'Cost/Hour',
      dataIndex: 'costPerHour',
      key: 'costPerHour',
      width: 180,
      render: (val, record) => {
        const editable = isEditingCost(record);
        const saving = savingKeys[record.id];

        if (editable) {
          return (
            <Space size="small">
              <InputNumber
                value={tempCost}
                min={0}
                formatter={value => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={value => value.replace(/\₹\s?|(,*)/g, '')}
                onChange={setTempCost}
                style={{ width: 85 }}
                autoFocus
                onPressEnter={() => saveCostPerHour(record.id)}
              />
              <Button 
                type="primary" 
                size="small" 
                icon={<SaveOutlined />} 
                onClick={() => saveCostPerHour(record.id)}
                loading={saving}
                style={{ background: '#10b981', borderColor: '#10b981' }}
              />
              <Button size="small" onClick={cancelEditCost}>Cancel</Button>
            </Space>
          );
        }

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tag color="cyan" style={{ fontSize: '13px', fontWeight: 600, padding: '2px 8px', borderRadius: 4, margin: 0 }}>
              ₹{Number(val || 0).toLocaleString('en-IN')}/hr
            </Tag>
            <Button 
              type="text" 
              size="small" 
              icon={<EditOutlined style={{ color: '#8b5cf6' }} />} 
              onClick={() => startEditCost(record)} 
            />
          </div>
        );
      }
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      width: 110,
      render: (isActive, record) => (
        <Switch 
          checked={isActive !== false} 
          onChange={() => handleStatusToggle(record.id)} 
          checkedChildren="Active" 
          unCheckedChildren="Inactive"
        />
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="default"
            size="small"
            icon={<SafetyCertificateOutlined style={{ color: '#10b981' }} />}
            onClick={() => {
              setPermissionUser(record);
              const rolesArray = typeof record.role === 'string' 
                ? record.role.split(',').map(r => r.trim()).filter(Boolean) 
                : (Array.isArray(record.role) ? record.role : []);
              
              const features = getFeaturesForRoles(rolesArray);
              setPermissionModalFeatures(features);

              const dbPermissions = record.permissions || {};
              const formPermissions = {};
              features.forEach(f => {
                formPermissions[f.key] = dbPermissions[f.key] !== false;
              });

              permissionForm.setFieldsValue({
                role: rolesArray,
                permissions: formPermissions
              });
            }}
            title="Manage Permissions"
            style={{ borderRadius: 6 }}
          />
          <Button 
            type="default"
            size="small"
            icon={<LockOutlined style={{ color: '#8b5cf6' }} />}
            onClick={() => setResetPasswordUser(record)}
            title="Reset Password"
            style={{ borderRadius: 6 }}
          />
        </Space>
      )
    }
  ];

  return (
    <div style={{ paddingBottom: 40 }}>
      <PageHeader 
        title="User Management (Accounts)"
        subtitle="Manage platform users, roles, cost rates and reporting relationships"
        extra={
          <Space>
            <Button 
              type="default" 
              icon={<FileExcelOutlined />} 
              onClick={() => setIsExcelModalOpen(true)}
              style={{
                borderRadius: 8,
                fontWeight: 600,
              }}
              size="large"
            >
              Import Excel
            </Button>
            <Button 
              type="primary" 
              icon={<UserAddOutlined />} 
              onClick={() => setIsModalOpen(true)}
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
                borderColor: '#7c3aed',
                borderRadius: 8,
                fontWeight: 600,
                boxShadow: '0 4px 6px -1px rgba(124, 58, 237, 0.2)'
              }}
              size="large"
            >
              Add User
            </Button>
          </Space>
        }
      />

      <Card 
        style={{
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          border: '1px solid #f3e8ff'
        }}
      >
        <div style={{ marginBottom: 20, display: 'flex', gap: 16, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 12, flex: 1, minWidth: 280 }}>
            <Input 
              prefix={<SearchOutlined style={{ color: '#8b5cf6' }} />} 
              placeholder="Search users by name, email or role..." 
              style={{ width: 320, borderRadius: 8 }} 
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <Select 
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 160 }}
              options={[
                { label: 'All Statuses', value: 'All' },
                { label: 'Active Only', value: 'Active' },
                { label: 'Inactive Only', value: 'Inactive' },
              ]}
            />
          </div>
        </div>

        <Table 
          dataSource={users.filter(user => {
            if (statusFilter === 'Active' && user.isActive === false) return false;
            if (statusFilter === 'Inactive' && user.isActive !== false) return false;

            const term = searchText.toLowerCase();
            const name = (user.name || user.fullName || '').toLowerCase();
            const email = (user.email || '').toLowerCase();
            const role = (user.role || '').toLowerCase();
            return name.includes(term) || email.includes(term) || role.includes(term);
          })} 
          columns={columns} 
          rowKey="id" 
          pagination={{ pageSize: 10 }}
          style={{ overflowX: 'auto' }}
        />
      </Card>

      <Modal
        title="Add New User"
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
          setAddModalFeatures([]);
        }}
        onOk={() => form.submit()}
        okText="Create User"
      >
        <Form 
          form={form} 
          layout="vertical" 
          onFinish={handleInvite}
          onValuesChange={(changedValues, allValues) => {
            if (changedValues.role) {
              const features = getFeaturesForRoles(changedValues.role);
              setAddModalFeatures(features);
              // pre-initialize permissions to true
              const newPerms = {};
              features.forEach(f => {
                newPerms[f.key] = true;
              });
              form.setFieldsValue({ permissions: newPerms });
            }
          }}
        >
          <Form.Item name="fullName" label="Full Name" rules={[{ required: true }]}>
            <Input placeholder="Enter full name" />
          </Form.Item>
          <Form.Item name="email" label="Email Address (Login ID)" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="Enter email address" />
          </Form.Item>
          <Form.Item name="password" label="Initial Password" rules={[{ required: true, min: 6 }]}>
            <Input.Password placeholder="Set initial password" />
          </Form.Item>
          <Form.Item name="role" label="Assigned Role(s)" rules={[{ required: true, message: 'Please select at least one role' }]}>
            <Select mode="multiple" placeholder="Select roles" allowClear>
              <Select.Option value="Sales">Sales</Select.Option>
              <Select.Option value="Accounts">Accounts</Select.Option>
              <Select.Option value="TeamLead">Team Lead</Select.Option>
              <Select.Option value="Employee">Employee</Select.Option>
              <Select.Option value="ProjectManager">PM</Select.Option>
              <Select.Option value="HR">HR</Select.Option>
            </Select>
          </Form.Item>

          {addModalFeatures.length > 0 && (
            <div style={{ marginTop: 16, marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 12 }}>Feature Access (ON / OFF)</Text>
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, padding: 12, background: '#fafafa' }}>
                {addModalFeatures.map(f => (
                  <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
                    <div>
                      <Text style={{ display: 'block', fontWeight: 500, fontSize: '13px' }}>{f.label}</Text>
                      <Text type="secondary" style={{ fontSize: '11px' }}>{f.key}</Text>
                    </div>
                    <Form.Item name={['permissions', f.key]} valuePropName="checked" initialValue={true} style={{ margin: 0 }}>
                      <Switch checkedChildren="ON" unCheckedChildren="OFF" />
                    </Form.Item>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Form.Item name="designation" label="Designation">
            <Input placeholder="Enter designation (e.g. Software Engineer)" />
          </Form.Item>

          <Form.Item name="costPerHour" label="Cost Per Hour (₹)">
            <InputNumber style={{ width: '100%' }} min={0} placeholder="Enter hourly cost rate (e.g. 500)" />
          </Form.Item>

          <Form.Item name="teamLeadId" label="Reporting Team Lead">
            <Select placeholder="Select Team Lead" allowClear>
              {users.filter(u => u.role === 'TeamLead').map(tl => (
                <Select.Option key={tl.id} value={tl.id}>
                  {tl.name} ({tl.email})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="projectManagerId" label="Reporting Project Manager">
            <Select placeholder="Select Project Manager" allowClear>
              {users.filter(u => u.role === 'ProjectManager' || u.role === 'TenantAdmin').map(pm => (
                <Select.Option key={pm.id} value={pm.id}>
                  {pm.name} ({pm.email})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="projectId" label="Assign to Project (Optional)">
            <Select placeholder="Select a project" allowClear>
              {projects.map(p => (
                <Select.Option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <ExcelUserUploadModal
        open={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onSuccess={fetchUsers}
        existingUsers={users}
      />

      <Modal
        title={
          <Space>
            <LockOutlined style={{ color: '#8b5cf6' }} />
            <span style={{ fontWeight: 700 }}>Reset Password</span>
          </Space>
        }
        open={!!resetPasswordUser}
        onCancel={() => {
          setResetPasswordUser(null);
          resetForm.resetFields();
        }}
        onOk={() => resetForm.submit()}
        okText="Reset Password"
        okButtonProps={{ style: { background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', borderColor: '#7c3aed' } }}
      >
        <Form form={resetForm} layout="vertical" onFinish={handleResetPassword}>
          <div style={{ marginBottom: 16 }}>
            Resetting password for: <Text strong>{resetPasswordUser?.name || resetPasswordUser?.fullName}</Text> (<Text type="secondary">{resetPasswordUser?.email}</Text>)
          </div>
          <Form.Item
            name="newPassword"
            label="New Password"
            rules={[
              { required: true, message: 'Please enter new password' },
              { min: 6, message: 'Password must be at least 6 characters long' }
            ]}
          >
            <Input.Password placeholder="Enter new password" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <EditOutlined style={{ color: '#8b5cf6' }} />
            <span style={{ fontWeight: 700 }}>Edit Designation</span>
          </Space>
        }
        open={isDesignationModalOpen}
        onCancel={() => {
          setIsDesignationModalOpen(false);
          setSelectedUserForDesignation(null);
          designationForm.resetFields();
        }}
        onOk={() => designationForm.submit()}
        okText="Save"
        okButtonProps={{ style: { background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', borderColor: '#7c3aed' } }}
      >
        <Form form={designationForm} layout="vertical" onFinish={handleUpdateDesignation}>
          <div style={{ marginBottom: 16 }}>
            Updating designation for: <Text strong>{selectedUserForDesignation?.name || selectedUserForDesignation?.fullName}</Text> (<Text type="secondary">{selectedUserForDesignation?.email}</Text>)
          </div>
          <Form.Item
            name="designation"
            label="Designation"
            rules={[{ required: true, message: 'Please enter a designation' }]}
          >
            <Input placeholder="Enter designation (e.g. Lead Designer)" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <SafetyCertificateOutlined style={{ color: '#10b981' }} />
            <span style={{ fontWeight: 700 }}>Manage User Permissions</span>
          </Space>
        }
        open={!!permissionUser}
        onCancel={() => {
          setPermissionUser(null);
          permissionForm.resetFields();
          setPermissionModalFeatures([]);
        }}
        onOk={() => permissionForm.submit()}
        okText="Save Permissions"
        okButtonProps={{ style: { background: 'linear-gradient(135deg, #10b981, #059669)', borderColor: '#10b981' } }}
      >
        <Form
          form={permissionForm}
          layout="vertical"
          onFinish={handleSavePermissions}
          onValuesChange={(changedValues, allValues) => {
            if (changedValues.role) {
              const newFeatures = getFeaturesForRoles(changedValues.role);
              setPermissionModalFeatures(newFeatures);
              // Keep existing toggle states, and default new ones to true
              const currentPerms = allValues.permissions || {};
              const updatedPerms = {};
              newFeatures.forEach(f => {
                updatedPerms[f.key] = currentPerms[f.key] !== false;
              });
              permissionForm.setFieldsValue({ permissions: updatedPerms });
            }
          }}
        >
          <div style={{ marginBottom: 16 }}>
            Managing permissions for: <Text strong>{permissionUser?.name || permissionUser?.fullName}</Text> (<Text type="secondary">{permissionUser?.email}</Text>)
          </div>
          
          <Form.Item name="role" label="Assigned Role(s)" rules={[{ required: true, message: 'Please select at least one role' }]}>
            <Select mode="multiple" placeholder="Select roles" allowClear>
              <Select.Option value="Sales">Sales</Select.Option>
              <Select.Option value="Accounts">Accounts</Select.Option>
              <Select.Option value="TeamLead">Team Lead</Select.Option>
              <Select.Option value="Employee">Employee</Select.Option>
              <Select.Option value="ProjectManager">PM</Select.Option>
              <Select.Option value="HR">HR</Select.Option>
            </Select>
          </Form.Item>

          {permissionModalFeatures.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 12 }}>Feature Access (ON / OFF)</Text>
              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, padding: 12, background: '#fafafa' }}>
                {permissionModalFeatures.map(f => (
                  <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
                    <div>
                      <Text style={{ display: 'block', fontWeight: 500, fontSize: '13px' }}>{f.label}</Text>
                      <Text type="secondary" style={{ fontSize: '11px' }}>{f.key}</Text>
                    </div>
                    <Form.Item name={['permissions', f.key]} valuePropName="checked" style={{ margin: 0 }}>
                      <Switch checkedChildren="ON" unCheckedChildren="OFF" />
                    </Form.Item>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default AccountsUserManagementPage;
