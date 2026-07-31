import React, { useState, useEffect } from 'react';
import { 
  Card, Row, Col, Avatar, Badge, Spin, Typography, Space, 
  notification, Input, Statistic, Button, Form, Modal, 
  Select, InputNumber, Switch, Tag, Drawer, Divider, Empty, Skeleton
} from 'antd';
import { 
  UserOutlined, TeamOutlined, MailOutlined, 
  SearchOutlined, UserAddOutlined, DeleteOutlined, KeyOutlined, 
  DollarOutlined, EditOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ProjectOutlined, CrownOutlined, SafetyCertificateOutlined, LockOutlined
} from '@ant-design/icons';
import { adminService } from '../../services/adminService';
import { projectService } from '../../services/projectService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';
import { getFeaturesForRoles } from '../../utils/permissionUtils';

const { Title, Text } = Typography;

const ROLE_CONFIG = {
  Employee:       { color: '#3b82f6', bg: '#eff6ff', label: 'Employee',         icon: <UserOutlined /> },
  TeamLead:       { color: '#10b981', bg: '#ecfdf5', label: 'Team Lead',        icon: <TeamOutlined /> },
  ProjectManager: { color: '#f59e0b', bg: '#fffbeb', label: 'Project Manager',  icon: <CrownOutlined /> },
  HR:             { color: '#ec4899', bg: '#fdf2f8', label: 'HR',               icon: <SafetyCertificateOutlined /> },
  Accounts:       { color: '#8b5cf6', bg: '#f5f3ff', label: 'Accounts',         icon: <DollarOutlined /> },
  Sales:          { color: '#06b6d4', bg: '#ecfeff', label: 'Sales',            icon: <ProjectOutlined /> },
};

const getRoleConfig = (role) => ROLE_CONFIG[role] || { color: '#6b7280', bg: '#f9fafb', label: role, icon: <UserOutlined /> };

const HRTeamPage = () => {
  const [users, setUsers]               = useState([]);
  const [projects, setProjects]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [searchText, setSearchText]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter]     = useState('all');

  // Create user modal
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [form] = Form.useForm();

  // Edit drawer
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [editingUser, setEditingUser]   = useState(null);
  const [editForm] = Form.useForm();
  const [savingEdit, setSavingEdit]     = useState(false);

  // Permission states
  const [permissionForm] = Form.useForm();
  const [permissionUser, setPermissionUser] = useState(null);
  const [permissionModalFeatures, setPermissionModalFeatures] = useState([]);
  const [addModalFeatures, setAddModalFeatures] = useState([]);

  // Reset password states
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [resetForm] = Form.useForm();

  const { isDarkMode } = useThemeStore();

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [usersRes, projectsRes] = await Promise.all([
        adminService.getUsers(),
        projectService.getProjects()
      ]);
      const filtered = (usersRes.data || []).filter(u => u.role !== 'SuperAdmin');
      setUsers(filtered);
      setProjects(projectsRes.data || []);
    } catch {
      notification.error({ message: 'Error', description: 'Failed to load team details.' });
    } finally {
      setLoading(false);
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

  /* ── Create user ── */
  const handleInvite = async (values) => {
    try {
      await adminService.inviteUser(values);
      notification.success({ message: 'User Created', description: `Created ${values.fullName} successfully.` });
      setIsModalOpen(false);
      form.resetFields();
      setAddModalFeatures([]);
      fetchUsers();
    } catch (error) {
      notification.error({ message: 'Error', description: error.response?.data?.message || 'Failed to create user.' });
    }
  };

  /* ── Toggle active ── */
  const handleToggleStatus = async (userId, currentIsActive) => {
    try {
      await adminService.toggleUserStatus(userId);
      notification.success({ message: 'Status Updated' });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: currentIsActive === false } : u));
    } catch {
      notification.error({ message: 'Error', description: 'Failed to toggle user status.' });
    }
  };

  /* ── Open edit drawer ── */
  const openEdit = (record) => {
    setEditingUser(record);
    const rolesArray = typeof record.role === 'string' 
      ? record.role.split(',').map(r => r.trim()).filter(Boolean) 
      : (Array.isArray(record.role) ? record.role : []);
    editForm.setFieldsValue({
      role:             rolesArray,
      teamLeadId:       record.teamLeadId || undefined,
      projectManagerId: record.projectManagerId || undefined,
    });
    setDrawerOpen(true);
  };

  /* ── Save edit ── */
  const handleSaveEdit = async () => {
    try {
      const values = await editForm.validateFields();
      setSavingEdit(true);
      await adminService.updateUserRole(editingUser.id, values.role);
      await adminService.updateUserTeamLead(editingUser.id, values.teamLeadId || null);
      await adminService.updateUserProjectManager(editingUser.id, values.projectManagerId || null);
      notification.success({ message: 'User Updated' });
      setDrawerOpen(false);
      fetchUsers();
    } catch (err) {
      if (!err?.errorFields) notification.error({ message: 'Failed to save changes.' });
    } finally {
      setSavingEdit(false);
    }
  };

  /* ── Delete ── */
  const handleDeleteUser = (record) => {
    Modal.confirm({
      title: 'Delete User',
      content: `Delete ${record.name || record.fullName}? This cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await adminService.deleteUser(record.id);
          notification.success({ message: 'User Deleted' });
          fetchUsers();
        } catch (error) {
          notification.error({ message: 'Error', description: error.response?.data?.message || 'Failed to delete user.' });
        }
      }
    });
  };

  const filteredUsers = users.filter(u => {
    const nameStr  = (u.name || u.fullName || '').toLowerCase();
    const emailStr = (u.email || '').toLowerCase();
    const roleStr  = (u.role || '').toLowerCase();
    const query    = searchText.toLowerCase();
    const matchesSearch  = nameStr.includes(query) || emailStr.includes(query);
    const matchesStatus  = statusFilter === 'all' ||
                           (statusFilter === 'active'   && u.isActive !== false) ||
                           (statusFilter === 'inactive' && u.isActive === false);
    const matchesRole    = roleFilter === 'all' || roleStr.includes(roleFilter.toLowerCase());
    return matchesSearch && matchesStatus && matchesRole;
  });

  const totalTL  = users.filter(u => (u.role || '').includes('TeamLead')).length;
  const totalEmp = users.filter(u => (u.role || '').includes('Employee')).length;
  const totalPM  = users.filter(u => (u.role || '').includes('ProjectManager')).length;
  const totalAll = users.length;

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active avatar paragraph={{ rows: 4 }} />
        <Skeleton active avatar paragraph={{ rows: 4 }} style={{ marginTop: 24 }} />
      </div>
    );
  }

  const cardBg    = isDarkMode ? '#1f2937' : '#ffffff';
  const cardBorder = isDarkMode ? '1px solid #3f3f46' : '1px solid #e5e7eb';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Header ── */}
      <PageHeader
        title="Team Directory"
        subTitle={`${totalAll} members · Manage roles, reporting lines & status`}
        extra={
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={() => setIsModalOpen(true)}
            style={{ borderRadius: 8, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}
          >
            Add User
          </Button>
        }
      />

      {/* ── Stat cards ── */}
      <Row gutter={[16, 16]}>
        {[
          { label: 'Total Members',    value: totalAll,  color: '#6366f1', icon: <UserOutlined />,    bg: '#eef2ff' },
          { label: 'Team Leads',       value: totalTL,   color: '#10b981', icon: <TeamOutlined />,    bg: '#ecfdf5' },
          { label: 'Employees',        value: totalEmp,  color: '#3b82f6', icon: <UserOutlined />,    bg: '#eff6ff' },
          { label: 'Project Managers', value: totalPM,   color: '#f59e0b', icon: <CrownOutlined />,   bg: '#fffbeb' },
        ].map(({ label, value, color, icon, bg }) => (
          <Col xs={12} sm={12} md={6} key={label}>
            <Card
              style={{ borderRadius: 16, border: cardBorder, background: cardBg, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
              bodyStyle={{ padding: '16px 20px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color }}>
                  {icon}
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>{label}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── Filters ── */}
      <Card
        style={{ borderRadius: 16, border: cardBorder, background: cardBg, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
        bodyStyle={{ padding: '14px 20px' }}
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text strong style={{ fontSize: 15 }}>
            {filteredUsers.length} member{filteredUsers.length !== 1 ? 's' : ''} found
          </Text>
          <Space wrap size={10}>
            <Select
              value={roleFilter}
              onChange={setRoleFilter}
              style={{ width: 150 }}
              options={[
                { label: 'All Roles', value: 'all' },
                { label: 'Employee', value: 'Employee' },
                { label: 'Team Lead', value: 'TeamLead' },
                { label: 'Project Manager', value: 'ProjectManager' },
                { label: 'Accounts', value: 'Accounts' },
                { label: 'Sales', value: 'Sales' },
                { label: 'HR', value: 'HR' },
              ]}
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 140 }}
              options={[
                { label: 'All Statuses', value: 'all' },
                { label: 'Active', value: 'active' },
                { label: 'Inactive', value: 'inactive' },
              ]}
            />
            <Input
              placeholder="Search name or email…"
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 240, borderRadius: 8 }}
              allowClear
            />
          </Space>
        </div>
      </Card>

      {/* ── Member cards list ── */}
      {filteredUsers.length === 0 ? (
        <Empty description="No matching team members found." style={{ padding: 48 }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredUsers.map(user => {
            const isActive = user.isActive !== false;
            const tl      = users.find(u => String(u.id) === String(user.teamLeadId));
            const pm      = users.find(u => String(u.id) === String(user.projectManagerId));

            return (
              <Card
                key={user.id}
                style={{
                  borderRadius: 14,
                  border: isDarkMode ? '1px solid #3f3f46' : '1px solid #f0f0f0',
                  background: cardBg,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  transition: 'box-shadow 0.2s',
                }}
                bodyStyle={{ padding: '14px 20px' }}
                hoverable
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  {/* Avatar + name */}
                  <Avatar
                    size={44}
                    icon={<UserOutlined />}
                    style={{ background: getRoleConfig(user.role?.split(',')[0]).color, flexShrink: 0, fontSize: 18, boxShadow: `0 2px 8px ${getRoleConfig(user.role?.split(',')[0]).color}40` }}
                  />
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <Text strong style={{ fontSize: 14, display: 'block' }}>{user.name || user.fullName}</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <MailOutlined style={{ fontSize: 11, color: '#8c8c8c' }} />
                      <Text type="secondary" style={{ fontSize: 12 }}>{user.email}</Text>
                    </div>
                    {user.designation && (
                      <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: 2, fontStyle: 'italic' }}>
                        {user.designation}
                      </Text>
                    )}
                  </div>

                  {/* Role tags */}
                  <Space wrap size={4}>
                    {(typeof user.role === 'string' ? user.role.split(',').map(r => r.trim()).filter(Boolean) : (Array.isArray(user.role) ? user.role : [user.role])).map(roleVal => {
                      const rc = getRoleConfig(roleVal);
                      return (
                        <Tag
                          key={roleVal}
                          style={{
                            background: rc.bg,
                            color: rc.color,
                            border: `1px solid ${rc.color}40`,
                            borderRadius: 20,
                            padding: '2px 12px',
                            fontWeight: 600,
                            fontSize: 12,
                          }}
                        >
                          {rc.icon} &nbsp;{rc.label}
                        </Tag>
                      );
                    })}
                  </Space>

                  {/* Reporting chain */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1, justifyContent: 'center' }}>
                    {tl && (
                      <Tag icon={<TeamOutlined />} color="green" style={{ borderRadius: 20, fontSize: 11 }}>
                        TL: {tl.name || tl.fullName}
                      </Tag>
                    )}
                    {pm && (
                      <Tag icon={<CrownOutlined />} color="gold" style={{ borderRadius: 20, fontSize: 11 }}>
                        PM: {pm.name || pm.fullName}
                      </Tag>
                    )}
                    {!tl && !pm && (user.role || '').includes('Employee') && (
                      <Tag color="default" style={{ borderRadius: 20, fontSize: 11 }}>No reporting line</Tag>
                    )}
                  </div>

                  {/* Status toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <Switch
                      size="small"
                      checked={isActive}
                      onChange={() => handleToggleStatus(user.id, user.isActive)}
                      checkedChildren={<CheckCircleOutlined />}
                      unCheckedChildren={<CloseCircleOutlined />}
                    />
                    <Tag
                      color={isActive ? 'success' : 'error'}
                      style={{ borderRadius: 20, fontSize: 11, minWidth: 58, textAlign: 'center' }}
                    >
                      {isActive ? 'Active' : 'Inactive'}
                    </Tag>
                  </div>

                  {/* Actions */}
                  <Space size={6} style={{ flexShrink: 0 }}>
                    <Button 
                      type="default"
                      size="small"
                      icon={<SafetyCertificateOutlined style={{ color: '#10b981' }} />}
                      onClick={() => {
                        setPermissionUser(user);
                        const rolesArray = typeof user.role === 'string' 
                          ? user.role.split(',').map(r => r.trim()).filter(Boolean) 
                          : (Array.isArray(user.role) ? user.role : []);
                        
                        const features = getFeaturesForRoles(rolesArray);
                        setPermissionModalFeatures(features);

                        const dbPermissions = user.permissions || {};
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
                      style={{ borderRadius: 8 }}
                    />
                    <Button 
                      type="default"
                      size="small"
                      icon={<LockOutlined style={{ color: '#8b5cf6' }} />}
                      onClick={() => setResetPasswordUser(user)}
                      title="Reset Password"
                      style={{ borderRadius: 8 }}
                    />
                    <Button
                      type="default"
                      icon={<EditOutlined />}
                      size="small"
                      onClick={() => openEdit(user)}
                      style={{ borderRadius: 8 }}
                    >
                      Edit
                    </Button>
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                      onClick={() => handleDeleteUser(user)}
                      style={{ borderRadius: 8 }}
                    />
                  </Space>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Edit Drawer ── */}
      <Drawer
        title={
          <Space>
            <Avatar
              size={32}
              icon={<UserOutlined />}
              style={{ background: getRoleConfig(editingUser?.role?.split(',')[0]).color }}
            />
            <span style={{ fontWeight: 700 }}>{editingUser?.name || editingUser?.fullName}</span>
          </Space>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={400}
        extra={
          <Button type="primary" loading={savingEdit} onClick={handleSaveEdit} style={{ borderRadius: 8 }}>
            Save Changes
          </Button>
        }
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="role" label="Role" rules={[{ required: true, message: 'Select at least one role' }]}>
            <Select mode="multiple" placeholder="Select roles">
              <Select.Option value="Sales">Sales</Select.Option>
              <Select.Option value="Accounts">Accounts</Select.Option>
              <Select.Option value="TeamLead">Team Lead</Select.Option>
              <Select.Option value="Employee">Employee</Select.Option>
              <Select.Option value="ProjectManager">Project Manager</Select.Option>
              <Select.Option value="HR">HR</Select.Option>
            </Select>
          </Form.Item>

          <Divider style={{ margin: '8px 0 16px' }}>Reporting Structure</Divider>

          <Form.Item name="teamLeadId" label="Reporting Team Lead">
            <Select placeholder="Select Team Lead" allowClear>
              {users.filter(u => (u.role || '').includes('TeamLead') && String(u.id) !== String(editingUser?.id)).map(tl => (
                <Select.Option key={tl.id} value={tl.id}>{tl.name || tl.fullName}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="projectManagerId" label="Reporting Project Manager">
            <Select placeholder="Select PM" allowClear>
              {users.filter(u => ((u.role || '').includes('ProjectManager') || (u.role || '').includes('TenantAdmin')) && String(u.id) !== String(editingUser?.id)).map(pm => (
                <Select.Option key={pm.id} value={pm.id}>{pm.name || pm.fullName}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Drawer>

      {/* ── Add User Modal ── */}
      <Modal
        title={
          <Space>
            <UserAddOutlined style={{ color: '#4f46e5', fontSize: 18 }} />
            <span style={{ fontWeight: 700 }}>Add New User</span>
          </Space>
        }
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
          setAddModalFeatures([]);
        }}
        onOk={() => form.submit()}
        okText="Create User"
        okButtonProps={{ style: { background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none', borderRadius: 8 } }}
        width={520}
        style={{ top: 60 }}
      >
        <Form 
          form={form} 
          layout="vertical" 
          onFinish={handleInvite} 
          style={{ marginTop: 12 }}
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
          <Form.Item name="fullName" label="Full Name" rules={[{ required: true, message: 'Please enter a name' }]}>
            <Input placeholder="Enter full name" prefix={<UserOutlined style={{ color: '#bfbfbf' }} />} />
          </Form.Item>

          <Form.Item name="email" label="Email Address" rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}>
            <Input placeholder="Enter email address" prefix={<MailOutlined style={{ color: '#bfbfbf' }} />} />
          </Form.Item>

          <Form.Item name="password" label="Initial Password" rules={[{ required: true, min: 6, message: 'Minimum 6 characters' }]}>
            <Input.Password placeholder="Set initial password" prefix={<KeyOutlined style={{ color: '#bfbfbf' }} />} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
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
            </Col>
            <Col span={12}>
              <Form.Item name="costPerHour" label="Cost / Hour (₹)">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 500" prefix={<DollarOutlined />} />
              </Form.Item>
            </Col>
          </Row>

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
            <Input placeholder="Enter designation (e.g. Software Engineer)" prefix={<UserOutlined style={{ color: '#bfbfbf' }} />} />
          </Form.Item>

          <Form.Item name="teamLeadId" label="Reporting Team Lead">
            <Select placeholder="Select Team Lead" allowClear>
              {users.filter(u => (u.role || '').includes('TeamLead')).map(tl => (
                <Select.Option key={tl.id} value={tl.id}>{tl.name || tl.fullName} ({tl.email})</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="projectManagerId" label="Reporting Project Manager">
            <Select placeholder="Select PM" allowClear>
              {users.filter(u => (u.role || '').includes('ProjectManager') || (u.role || '').includes('TenantAdmin')).map(pm => (
                <Select.Option key={pm.id} value={pm.id}>{pm.name || pm.fullName} ({pm.email})</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="projectId" label="Assign to Project (Optional)">
            <Select placeholder="Select a project" allowClear>
              {projects.map(p => (
                <Select.Option key={p.id} value={p.id}>{p.projectCode || p.code} - {p.projectName || p.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Reset Password Modal ── */}
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

      {/* ── Manage Permissions Modal ── */}
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

export default HRTeamPage;
