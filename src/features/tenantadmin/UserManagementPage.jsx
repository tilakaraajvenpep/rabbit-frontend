import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Switch, notification, Space, Typography, Tag, Skeleton, Popconfirm, InputNumber } from 'antd';
import { UserAddOutlined, SearchOutlined, DeleteOutlined, LockOutlined, EditOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { adminService } from '../../services/adminService';
import { projectService } from '../../services/projectService';
import PageHeader from '../../components/common/PageHeader';
import { getFeaturesForRoles } from '../../utils/permissionUtils';
import { useAuthStore } from '../../store/authStore';

const { Text } = Typography;

const UserManagementPage = () => {
  const { token, isAuthenticated } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [resetForm] = Form.useForm();
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
    if (!token || !isAuthenticated) return;
    fetchData();
  }, [token, isAuthenticated]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, projectsRes] = await Promise.all([
        adminService.getUsers(),
        projectService.getProjects()
      ]);
      setUsers(usersRes.data);
      setProjects(projectsRes.data);
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load management data.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = () => fetchData(); // Keep for backward compat if needed

  const handleInvite = async (values) => {
    try {
      await adminService.inviteUser(values);
      notification.success({ 
        message: 'User Created', 
        description: `Successfully created ${values.fullName} (${values.email}).` 
      });
      setIsModalOpen(false);
      form.resetFields();
      setAddModalFeatures([]);
      fetchUsers();
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to send invitation.' });
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

  const handleDeleteUser = async (userId) => {
    try {
      await adminService.deleteUser(userId);
      notification.success({ message: 'User Deleted successfully' });
      fetchUsers();
    } catch (error) {
      notification.error({ message: 'Delete Failed', description: 'Failed to delete user.' });
    }
  };

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  const columns = [
    {
      title: 'Full Name',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email'
    },
    {
      title: 'Designation',
      dataIndex: 'designation',
      key: 'designation',
      render: (text, record) => (
        <Space>
          <span>{text || <span style={{ color: '#aaa', fontStyle: 'italic' }}>Not Set</span>}</span>
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
      render: (role, record) => {
        const rolesArray = typeof role === 'string' 
          ? role.split(',').map(r => r.trim()).filter(Boolean) 
          : (Array.isArray(role) ? role : []);
        return (
          <Select 
            mode="multiple"
            value={rolesArray} 
            style={{ minWidth: 160, maxWidth: 280 }} 
            onChange={(val) => handleRoleChange(record.id, val)}
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
      title: 'Status',
      key: 'status',
      render: (_, record) => {
        const isActive = record.isActive !== undefined ? record.isActive : (record.status !== 'Inactive');
        return (
          <Space>
            <Switch 
              size="small" 
              checked={isActive} 
              onChange={() => handleStatusToggle(record.id)} 
            />
            <Tag color={isActive ? 'green' : 'red'}>
              {isActive ? 'Active' : 'Inactive'}
            </Tag>
          </Space>
        );
      }
    },
    {
      title: 'Cost/Hr',
      dataIndex: 'costPerHour',
      key: 'costPerHour',
      render: (rate) => rate ? `₹${Number(rate).toFixed(2)}/hr` : '₹0.00/hr'
    },
    {
      title: 'Team Lead',
      dataIndex: 'teamLeadId',
      key: 'teamLeadId',
      render: (tlId, record) => (
        <Select
          value={tlId ? String(tlId) : undefined}
          style={{ width: 160 }}
          placeholder="None"
          allowClear
          onChange={(val) => handleTeamLeadChange(record.id, val)}
        >
          {users
            .filter(u => {
              const role = (u.role || '').toLowerCase().replace(/\s+/g, '');
              return role.includes('teamlead') && String(u.id) !== String(record.id);
            })
            .map(tl => (
              <Select.Option key={tl.id} value={String(tl.id)}>
                {tl.name || tl.fullName}
              </Select.Option>
            ))}
        </Select>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
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
          <Popconfirm
            title="Are you sure you want to delete this user?"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button 
              danger 
              size="small" 
              icon={<DeleteOutlined />} 
              title="Delete User"
              style={{ borderRadius: 6 }}
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <PageHeader 
        title="User Management" 
        extra={<Button type="primary" icon={<UserAddOutlined />} onClick={() => setIsModalOpen(true)}>Add User</Button>}
      />

      <div style={{ marginBottom: 16 }}>
        <Input 
          prefix={<SearchOutlined />} 
          placeholder="Search users by name or email..." 
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
              {users.filter(u => (u.role || '').includes('TeamLead')).map(tl => (
                <Select.Option key={tl.id} value={tl.id}>
                  {tl.name || tl.fullName} ({tl.email})
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

export default UserManagementPage;
