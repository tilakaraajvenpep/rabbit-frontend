import React, { useState, useEffect } from 'react';
import { 
  Card, Row, Col, DatePicker, Select, Button, Table, 
  Typography, Space, notification, Tag, Form, Input, InputNumber, Modal
} from 'antd';
import { DownloadOutlined, SearchOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService } from '../../services/reportService';
import { ticketService } from '../../services/ticketService';
import { projectService } from '../../services/projectService';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { adminService } from '../../services/adminService';
import { leaveService } from '../../services/leaveService';
import PageHeader from '../../components/common/PageHeader';
import { downloadCSV } from '../../utils/exportUtils';

const { RangePicker } = DatePicker;
const { Text } = Typography;
const { TextArea } = Input;

const EmployeeReportsPage = () => {
  const { currentUser, role } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  
  const t1 = isDarkMode ? '#f3f4f6' : '#1f2937';
  const t2 = isDarkMode ? '#9ca3af' : '#4b5563';
  const card = isDarkMode ? '#1f2937' : '#ffffff';
  const border = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const isManager = ['TeamLead', 'ProjectManager', 'TenantAdmin', 'HR', 'Accounts'].includes(role);
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [rawReportData, setRawReportData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  
  // Filters
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedTeamLead, setSelectedTeamLead] = useState(null);
  const [selectedPM, setSelectedPM] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [teamLeads, setTeamLeads] = useState([]);
  const [projectManagers, setProjectManagers] = useState([]);
  const [allUsersCache, setAllUsersCache] = useState([]);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm] = Form.useForm();
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Filter effect to update filteredData when filters change or rawReportData updates
  useEffect(() => {
    let data = rawReportData;

    if (selectedEmployee) {
      data = data.filter(r => String(r.userId) === String(selectedEmployee));
    }

    if (selectedTeamLead && ['HR', 'Accounts', 'TenantAdmin'].includes(role)) {
      data = data.filter(r => {
        const u = allUsersCache.find(u => String(u.id || u.userId) === String(r.userId));
        if (!u) return false;
        if (u.role === 'Employee' && String(u.teamLeadId) === String(selectedTeamLead)) return true;
        if (String(u.id || u.userId) === String(selectedTeamLead)) return true;
        return false;
      });
    }

    if (selectedPM && ['HR', 'Accounts', 'TenantAdmin'].includes(role)) {
      data = data.filter(r => {
        const u = allUsersCache.find(u => String(u.id || u.userId) === String(r.userId));
        if (!u) return false;
        if (String(u.projectManagerId) === String(selectedPM)) return true;
        if (String(u.id || u.userId) === String(selectedPM)) return true;
        if (u.role === 'Employee' && u.teamLeadId) {
          const tl = allUsersCache.find(t => String(t.id || t.userId) === String(u.teamLeadId));
          if (tl && String(tl.projectManagerId) === String(selectedPM)) return true;
        }
        return false;
      });
    }

    setFilteredData(data);
  }, [selectedEmployee, selectedTeamLead, selectedPM, rawReportData, allUsersCache]);

  const fetchInitialData = async () => {
    try {
      const [ticketRes, projectRes] = await Promise.all([
        ticketService.getTickets(),
        projectService.getProjects()
      ]);
      setTickets(ticketRes.data || []);
      setProjects(projectRes.data || []);
    } catch (error) {
      notification.error({ message: 'Failed to load initial metadata' });
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      let start, end;
      if (dateRange && dateRange[0] && dateRange[1]) {
        start = dateRange[0].format('YYYY-MM-DD');
        end = dateRange[1].format('YYYY-MM-DD');
      } else {
        start = '2000-01-01';
        end = '2100-12-31';
      }
      
      const [res, leavesRes, usersRes] = await Promise.all([
        isManager 
          ? reportService.getAllReportsByRange(start, end)
          : reportService.getReportsByRange(currentUser.id || currentUser.userId, start, end),
        leaveService.getAllLeaves(),
        adminService.getUsers()
      ]);
      
      const allUsers = usersRes.data || [];
      const leavesData = leavesRes.data || [];
      const reportsData = res?.data || [];

      let reports = [];

      // Process reports
      reportsData.forEach(report => {
        if (!report || !report.items) return;

        const targetUserId = report.userId;
        const userObj = allUsers.find(u => String(u.id || u.userId) === String(targetUserId));
        const employeeName = userObj ? (userObj.fullName || userObj.name) : (Number(targetUserId) === Number(currentUser.id || currentUser.userId) ? (currentUser.name || currentUser.fullName) : `Employee #${targetUserId}`);
        const userRole = userObj ? userObj.role : 'Employee';

        let supervisorName = 'N/A';
        if (userObj) {
          if (userObj.role === 'Employee' && userObj.teamLeadId) {
            const tl = allUsers.find(u => String(u.id || u.userId) === String(userObj.teamLeadId));
            if (tl) supervisorName = tl.fullName || tl.name || 'Unassigned';
          } else if (userObj.role === 'TeamLead' && userObj.projectManagerId) {
            const pm = allUsers.find(u => String(u.id || u.userId) === String(userObj.projectManagerId));
            if (pm) supervisorName = pm.fullName || pm.name || 'Unassigned';
          }
        }

        report.items.forEach(item => {
          const ticketInfo = tickets.find(t => Number(t.id) === Number(item.ticketId));
          const projectInfo = projects.find(p => Number(p.id) === Number(ticketInfo?.projectId || item.projectId));
          reports.push({
            userId: report.userId,
            date: report.date || report.reportDate,
            employeeName: employeeName,
            userRole: userRole,
            supervisorName: supervisorName,
            projectId: ticketInfo?.projectId || item.projectId || 'N/A',
            projectName: projectInfo?.name || projectInfo?.projectName || 'N/A',
            ticketId: item.ticketId,
            ticketCode: ticketInfo?.code || 'N/A',
            ticketTitle: ticketInfo?.title || 'Unknown',
            hours: Number(item.hours || item.hoursSpent || 0),
            workDone: item.workDone || '',
            blockers: report.blockers || 'None',
            isLeave: false,
            key: `${report.userId}-${report.date || report.reportDate}-${item.ticketId || Math.random()}`
          });
        });
      });

      // Filter leaves in range
      const filteredLeaves = leavesData.filter(l => {
        const lDate = dayjs(l.leaveDate || l.date);
        const startDay = dayjs(start).startOf('day');
        const endDay = dayjs(end).endOf('day');
        const inRange = lDate.isAfter(startDay.subtract(1, 'day')) && lDate.isBefore(endDay.add(1, 'day'));
        const isOwn = isManager || String(l.userId || l.user?.id) === String(currentUser.id || currentUser.userId);
        return inRange && l.status === 'Approved' && isOwn;
      });

      // Process leaves
      filteredLeaves.forEach(leave => {
        const targetUserId = leave.userId || leave.user?.id;
        const userObj = allUsers.find(u => String(u.id || u.userId) === String(targetUserId));
        const employeeName = userObj ? (userObj.fullName || userObj.name) : (Number(targetUserId) === Number(currentUser.id || currentUser.userId) ? (currentUser.name || currentUser.fullName) : `Employee #${targetUserId}`);
        const userRole = userObj ? userObj.role : 'Employee';

        let supervisorName = 'N/A';
        if (userObj) {
          if (userObj.role === 'Employee' && userObj.teamLeadId) {
            const tl = allUsers.find(u => String(u.id || u.userId) === String(userObj.teamLeadId));
            if (tl) supervisorName = tl.fullName || tl.name || 'Unassigned';
          } else if (userObj.role === 'TeamLead' && userObj.projectManagerId) {
            const pm = allUsers.find(u => String(u.id || u.userId) === String(userObj.projectManagerId));
            if (pm) supervisorName = pm.fullName || pm.name || 'Unassigned';
          }
        }

        let leaveHours = 0;
        if (leave.type === 'Permission') {
          const duration = leave.permissionDuration || '';
          if (duration.includes('hr')) {
            leaveHours = parseFloat(duration) || 0;
          } else if (duration.includes('min')) {
            leaveHours = (parseFloat(duration) || 0) / 60;
          } else {
            leaveHours = 2;
          }
        }

        const leaveLabel = leave.type === 'Permission' ? 'PERMISSION' : leave.type === 'HalfDay' ? 'HALF DAY LEAVE' : 'FULL DAY LEAVE';

        reports.push({
          userId: targetUserId,
          date: leave.leaveDate || leave.date,
          employeeName: employeeName,
          userRole: userRole,
          supervisorName: supervisorName,
          ticketCode: 'LEAVE',
          ticketTitle: leaveLabel,
          projectName: 'Leave / Time Off',
          hours: leaveHours,
          workDone: `[Leave Reason] ${leave.reason || 'No reason provided'}`,
          blockers: 'None',
          isLeave: true,
          leaveStatus: leave.status,
          key: `leave-${leave.id || Math.random()}`
        });
      });

      const sorted = reports.sort((a, b) => dayjs(b.date).unix() - dayjs(a.date).unix());
      setRawReportData(sorted);

      // Dynamically collect unique employees from generated dataset
      const uniqueEmployeesMap = new Map();
      sorted.forEach(r => {
        uniqueEmployeesMap.set(String(r.userId), r.employeeName);
      });
      const collectedEmployees = Array.from(uniqueEmployeesMap.entries()).map(([id, name]) => ({
        id,
        name
      }));
      setEmployees(collectedEmployees);

      // Cache allUsers for filter effect
      setAllUsersCache(allUsers);

      // Collect unique Team Leads and Project Managers for HR/Accounts/TenantAdmin filters
      if (['HR', 'Accounts', 'TenantAdmin'].includes(role)) {
        const tlMap = new Map();
        const pmMap = new Map();
        allUsers.forEach(u => {
          if (u.role === 'TeamLead') {
            tlMap.set(String(u.id || u.userId), u.fullName || u.name);
          }
          if (u.role === 'ProjectManager') {
            pmMap.set(String(u.id || u.userId), u.fullName || u.name);
          }
        });
        setTeamLeads(Array.from(tlMap.entries()).map(([id, name]) => ({ id, name })));
        setProjectManagers(Array.from(pmMap.entries()).map(([id, name]) => ({ id, name })));
      }

      setHasGenerated(true);
    } catch (error) {
      console.error('Report Search Error:', error);
      notification.error({ 
        message: 'Search Failed', 
        description: error.response?.data?.message || error.message || 'Unknown error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (filteredData.length === 0) {
      return notification.warning({ message: 'No data to export' });
    }
    downloadCSV(filteredData, `Work_Report_${dayjs().format('YYYY-MM-DD')}`);
  };

  const handleOpenEditModal = (record) => {
    setEditingRecord(record);
    const decimalHours = record.hours;
    const h = Math.floor(decimalHours);
    const m = Math.round((decimalHours - h) * 60);

    editForm.setFieldsValue({
      hours: h,
      minutes: m,
      workDone: record.workDone
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (values) => {
    setUpdating(true);
    try {
      const reportRes = await reportService.getReportByDate(editingRecord.userId, editingRecord.date);
      const report = reportRes.data;
      if (!report) {
        throw new Error("EOD report not found for this date.");
      }

      const newHoursSpent = Number(values.hours) + (Number(values.minutes) / 60);
      if (newHoursSpent <= 0) {
        throw new Error("Total hours must be greater than 0");
      }

      const updatedItems = report.items.map(item => {
        if (Number(item.ticketId) === Number(editingRecord.ticketId)) {
          return {
            ...item,
            hoursSpent: newHoursSpent,
            workDone: values.workDone
          };
        }
        return {
          ...item,
          hoursSpent: Number(item.hoursSpent || item.hours)
        };
      });

      const payload = {
        reportDate: editingRecord.date,
        items: updatedItems
      };

      await reportService.submitDailyReport(payload);

      notification.success({
        message: 'Report Updated',
        description: 'Work report entry successfully updated and synced with EOD.'
      });

      setIsEditModalOpen(false);
      handleSearch();
    } catch (err) {
      console.error(err);
      notification.error({
        message: 'Update Failed',
        description: err.message || 'Failed to update report.'
      });
    } finally {
      setUpdating(false);
    }
  };

  const columns = [
    { 
      title: 'Date', dataIndex: 'date', key: 'date', width: 110,
      render: (date) => dayjs(date).format('DD MMM YYYY')
    },
    { title: 'Employee', dataIndex: 'employeeName', key: 'employeeName', width: 140 },
    ['HR', 'Accounts', 'TenantAdmin'].includes(role) && {
      title: 'Role',
      dataIndex: 'userRole',
      key: 'userRole',
      width: 100,
      render: (roleVal) => {
        let color = 'blue';
        if (roleVal === 'TeamLead') color = 'purple';
        if (roleVal === 'ProjectManager') color = 'orange';
        return <Tag color={color} style={{ fontWeight: 600, borderRadius: 4 }}>{roleVal}</Tag>;
      }
    },
    { 
      title: 'Project Name', 
      dataIndex: 'projectName', 
      key: 'projectName', 
      width: 180,
      render: (name) => <span style={{ fontWeight: 600, color: t1 }}>{name}</span>
    },
    { 
      title: 'Ticket Code', dataIndex: 'ticketCode', key: 'ticketCode', width: 110,
      render: (code, record) => {
        if (code === 'LEAVE') {
          return <Tag color="cyan" style={{ fontWeight: 600 }}>LEAVE</Tag>;
        }
        return (
          <span style={{ 
            fontSize: '11px', 
            fontWeight: 700, 
            background: `${isDarkMode ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)'}`, 
            color: '#6366f1', 
            padding: '2px 6px', 
            borderRadius: 4,
            border: '1px solid rgba(99, 102, 241, 0.3)'
          }}>
            {code}
          </span>
        );
      }
    },
    { 
      title: 'Ticket Name / Task', dataIndex: 'ticketTitle', key: 'ticketTitle',
      render: (title, record) => {
        if (record.isLeave) {
          const typeColor = title.includes('PERMISSION') ? 'cyan' : title.includes('HALF') ? 'purple' : 'magenta';
          return <Tag color={typeColor} style={{ fontWeight: 700 }}>{title}</Tag>;
        }
        return <span style={{ fontWeight: 600, color: t1 }}>{title}</span>;
      }
    },
    { 
      title: 'Hours & Minutes', 
      dataIndex: 'hours', 
      key: 'hours', 
      width: 130,
      render: (h, record) => {
        if (record.isLeave) return record.hours > 0 ? `${record.hours}h` : 'N/A';
        const hrs = Math.floor(h);
        const mins = Math.round((h - hrs) * 60);
        return (
          <span style={{ fontWeight: 700, color: '#10b981' }}>
            {hrs}h {mins}m
          </span>
        );
      }
    },
    { 
      title: 'Description (Work Done)', dataIndex: 'workDone', key: 'workDone',
      render: (text, record) => {
        if (record.isLeave) {
          return <span style={{ color: '#8c8c8c', fontStyle: 'italic' }}>{text}</span>;
        }
        return <span style={{ color: t2, whiteSpace: 'pre-wrap' }}>{text}</span>;
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_, record) => {
        const canEdit = String(record.userId) === String(currentUser.id || currentUser.userId) && !record.isLeave;
        if (!canEdit) return null;
        return (
          <Button 
            type="link" 
            icon={<EditOutlined />} 
            onClick={() => handleOpenEditModal(record)}
            style={{ padding: 0, fontWeight: 600 }}
          >
            Edit
          </Button>
        );
      }
    }
  ].filter(Boolean);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 8px' }}>
      <PageHeader title="Work Reports" />

      <Card style={{ marginBottom: 24, borderRadius: 12, border: `1px solid ${border}`, background: card }} bodyStyle={{ padding: '20px' }}>
        <Row gutter={[16, 24]} align="bottom">
          <Col xs={24} sm={16} md={18}>
            <Text strong style={{ fontSize: '13px', display: 'block', marginBottom: 8, color: t1 }}>Select Report Date Range</Text>
            <RangePicker 
              style={{ width: '100%', height: 40, borderRadius: 8 }} 
              value={dateRange}
              onChange={(val) => setDateRange(val)}
            />
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Button 
              type="primary" 
              icon={<SearchOutlined />} 
              onClick={handleSearch}
              loading={loading}
              size="large"
              block
              style={{ borderRadius: 8, height: 40, background: '#4f46e5', borderColor: '#4f46e5', fontWeight: 700 }}
            >
              Generate Report
            </Button>
          </Col>
        </Row>
      </Card>

      {hasGenerated && (
        <Card style={{ borderRadius: 12, border: `1px solid ${border}`, background: card }} bodyStyle={{ padding: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <Text strong style={{ whiteSpace: 'nowrap', minWidth: 120, color: t1 }}>Filter by Employee:</Text>
              <Select
                placeholder="All Employees"
                style={{ minWidth: 200, flex: 1 }}
                allowClear
                value={selectedEmployee}
                onChange={setSelectedEmployee}
                size="large"
                showSearch
                optionFilterProp="children"
              >
                {employees.map(u => (
                  <Select.Option key={u.id} value={u.id}>{u.name || u.fullName}</Select.Option>
                ))}
              </Select>

              {['HR', 'Accounts', 'TenantAdmin'].includes(role) && (
                <>
                  <Text strong style={{ whiteSpace: 'nowrap', minWidth: 100, color: t1 }}>Team Lead:</Text>
                  <Select
                    placeholder="All Team Leads"
                    style={{ minWidth: 180, flex: 1 }}
                    allowClear
                    value={selectedTeamLead}
                    onChange={setSelectedTeamLead}
                    size="large"
                    showSearch
                    optionFilterProp="children"
                  >
                    {teamLeads.map(tl => (
                      <Select.Option key={tl.id} value={tl.id}>{tl.name}</Select.Option>
                    ))}
                  </Select>
 
                  <Text strong style={{ whiteSpace: 'nowrap', minWidth: 60, color: t1 }}>PM:</Text>
                  <Select
                    placeholder="All PMs"
                    style={{ minWidth: 180, flex: 1 }}
                    allowClear
                    value={selectedPM}
                    onChange={setSelectedPM}
                    size="large"
                    showSearch
                    optionFilterProp="children"
                  >
                    {projectManagers.map(pm => (
                      <Select.Option key={pm.id} value={pm.id}>{pm.name}</Select.Option>
                    ))}
                  </Select>
                </>
              )}

              <Button 
                icon={<DownloadOutlined />} 
                onClick={handleExport}
                disabled={filteredData.length === 0}
                size="large"
                style={{ borderRadius: 8, height: 40 }}
              >
                Export CSV
              </Button>
            </div>
          </div>

          <Table 
            dataSource={filteredData} 
            columns={columns} 
            loading={loading}
            rowKey="key"
            pagination={{ pageSize: 10 }}
            style={{ borderRadius: 8, overflow: 'hidden' }}
            summary={(pageData) => {
              let total = 0;
              pageData.forEach(({ hours }) => { total += hours; });
              return (
                <Table.Summary.Row style={{ background: isDarkMode ? '#1e2130' : '#f8fafc' }}>
                  <Table.Summary.Cell index={0} colSpan={['HR', 'Accounts', 'TenantAdmin'].includes(role) ? 5 : 3}>
                    <Text strong style={{ color: t1 }}>Total Hours in Current View</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="left">
                    <Text strong style={{ color: '#10b981' }}>{total.toFixed(1)} hrs</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} colSpan={3} />
                </Table.Summary.Row>
              );
            }}
          />
        </Card>
      )}

      {/* Edit Work Report Modal */}
      <Modal
        title={<span style={{ fontSize: 16, fontWeight: 700, color: t1 }}>Edit Work Report Entry</span>}
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        {editingRecord && (
          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 16, background: isDarkMode ? '#11131c' : '#f8fafc', padding: 12, borderRadius: 8, border: `1px solid ${border}` }}>
              <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 11 }}>PROJECT</Text></div>
              <div style={{ fontWeight: 600, color: t1, marginBottom: 8 }}>{editingRecord.projectName}</div>
              
              <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 11 }}>TICKET</Text></div>
              <div style={{ fontWeight: 600, color: t1 }}>
                <span style={{ 
                  fontSize: '10px', 
                  fontWeight: 700, 
                  background: `${isDarkMode ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)'}`, 
                  color: '#6366f1', 
                  padding: '2px 6px', 
                  borderRadius: 4,
                  marginRight: 6
                }}>
                  {editingRecord.ticketCode}
                </span>
                {editingRecord.ticketTitle}
              </div>
            </div>

            <Form
              form={editForm}
              layout="vertical"
              onFinish={handleEditSubmit}
            >
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    name="hours"
                    label={<span style={{ fontWeight: 600, color: t2, fontSize: 12 }}>HOURS</span>}
                    rules={[{ required: true, message: 'Required' }]}
                  >
                    <InputNumber min={0} style={{ width: '100%', borderRadius: 8 }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="minutes"
                    label={<span style={{ fontWeight: 600, color: t2, fontSize: 12 }}>MINUTES</span>}
                    rules={[{ required: true, message: 'Required' }]}
                  >
                    <InputNumber min={0} max={59} style={{ width: '100%', borderRadius: 8 }} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="workDone"
                label={<span style={{ fontWeight: 600, color: t2, fontSize: 12 }}>WORK DESCRIPTION</span>}
                rules={[{ required: true, message: 'Please enter description' }]}
              >
                <TextArea rows={4} placeholder="Describe the work done..." style={{ borderRadius: 8 }} />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                loading={updating}
                block
                style={{ background: '#4f46e5', borderColor: '#4f46e5', height: 40, borderRadius: 8, fontWeight: 600, marginTop: 12 }}
              >
                Save Changes
              </Button>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default EmployeeReportsPage;