import React, { useState, useEffect } from 'react';
import { 
  Card, Row, Col, DatePicker, Select, Button, Table, 
  Typography, Space, notification, Tag
} from 'antd';
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService } from '../../services/reportService';
import { ticketService } from '../../services/ticketService';
import { useAuthStore } from '../../store/authStore';
import { adminService } from '../../services/adminService';
import { leaveService } from '../../services/leaveService';
import PageHeader from '../../components/common/PageHeader';
import { downloadCSV } from '../../utils/exportUtils';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const EmployeeReportsPage = () => {
  const { currentUser, role } = useAuthStore();
  const isManager = ['TeamLead', 'ProjectManager', 'TenantAdmin', 'HR'].includes(role);
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState([]);
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

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Filter effect to update filteredData when filters change or rawReportData updates
  useEffect(() => {
    let data = rawReportData;

    if (selectedEmployee) {
      data = data.filter(r => String(r.userId) === String(selectedEmployee));
    }

    if (selectedTeamLead && role === 'HR') {
      data = data.filter(r => {
        const u = allUsersCache.find(u => String(u.id || u.userId) === String(r.userId));
        if (!u) return false;
        // Employee under this TL
        if (u.role === 'Employee' && String(u.teamLeadId) === String(selectedTeamLead)) return true;
        // The TL themselves
        if (String(u.id || u.userId) === String(selectedTeamLead)) return true;
        return false;
      });
    }

    if (selectedPM && role === 'HR') {
      data = data.filter(r => {
        const u = allUsersCache.find(u => String(u.id || u.userId) === String(r.userId));
        if (!u) return false;
        // Direct PM
        if (String(u.projectManagerId) === String(selectedPM)) return true;
        // PM themselves
        if (String(u.id || u.userId) === String(selectedPM)) return true;
        // Employee whose TL reports to this PM
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
      const ticketRes = await ticketService.getTickets();
      setTickets(ticketRes.data || []);
    } catch (error) {
      notification.error({ message: 'Failed to load tickets list' });
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
          reports.push({
            userId: report.userId,
            date: report.date || report.reportDate,
            employeeName: employeeName,
            userRole: userRole,
            supervisorName: supervisorName,
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
        
        // If they are not manager, only show their own leaves
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

      // Collect unique Team Leads and Project Managers for HR filters
      if (role === 'HR') {
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

  const columns = [
    { 
      title: 'Date', dataIndex: 'date', key: 'date', width: 120,
      render: (date) => dayjs(date).format('DD MMM YYYY')
    },
    { title: 'Employee', dataIndex: 'employeeName', key: 'employeeName', width: 150 },
    role === 'HR' && {
      title: 'Role',
      dataIndex: 'userRole',
      key: 'userRole',
      width: 120,
      render: (roleVal) => {
        let color = 'blue';
        if (roleVal === 'TeamLead') color = 'purple';
        if (roleVal === 'ProjectManager') color = 'orange';
        return <Tag color={color} style={{ fontWeight: 600, borderRadius: 4 }}>{roleVal}</Tag>;
      }
    },
    role === 'HR' && {
      title: 'Supervisor / Lead',
      dataIndex: 'supervisorName',
      key: 'supervisorName',
      width: 150,
      render: (supName) => <Text style={{ fontWeight: 600 }}>{supName}</Text>
    },
    { 
      title: 'Ticket Code', dataIndex: 'ticketCode', key: 'ticketCode', width: 130,
      render: (code) => {
        if (code === 'LEAVE') {
          return <Tag color="cyan" style={{ fontWeight: 600 }}>LEAVE</Tag>;
        }
        return code;
      }
    },
    { 
      title: 'Ticket / Task', dataIndex: 'ticketTitle', key: 'ticketTitle',
      render: (title, record) => {
        if (record.isLeave) {
          const typeColor = title.includes('PERMISSION') ? 'cyan' : title.includes('HALF') ? 'purple' : 'magenta';
          return <Tag color={typeColor} style={{ fontWeight: 700 }}>{title}</Tag>;
        }
        return title;
      }
    },
    { 
      title: 'Work Done', dataIndex: 'workDone', key: 'workDone',
      render: (text, record) => {
        if (record.isLeave) {
          return <span style={{ color: '#8c8c8c', fontStyle: 'italic' }}>{text}</span>;
        }
        return text;
      }
    },
    { 
      title: 'Hours', dataIndex: 'hours', key: 'hours', width: 80, align: 'right',
      render: (h) => h?.toFixed(1)
    },
  ].filter(Boolean);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <PageHeader title="Work Reports & Exports" />

      {/* Date Range picker and Generate button ONLY */}
      <Card style={{ marginBottom: 24, borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }} bodyStyle={{ padding: '24px' }}>
        <Row gutter={[16, 24]} align="bottom">
          <Col xs={24} sm={16} md={18}>
            <Text strong style={{ fontSize: '13px', display: 'block', marginBottom: 8 }}>Select Report Date Range</Text>
            <RangePicker 
              style={{ width: '100%', height: 44, borderRadius: 8 }} 
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
              style={{ borderRadius: 8, height: 44, background: '#4f46e5', borderColor: '#4f46e5', fontWeight: 700 }}
            >
              Generate Report
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Display all work reports once generated */}
      {hasGenerated && (
        <Card style={{ borderRadius: 12, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }} bodyStyle={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <Text strong style={{ whiteSpace: 'nowrap', minWidth: 120 }}>Filter by Employee:</Text>
              <Select
                placeholder="All Employees"
                style={{ minWidth: 220, flex: 1 }}
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

              {role === 'HR' && (
                <>
                  <Text strong style={{ whiteSpace: 'nowrap', minWidth: 100 }}>Team Lead:</Text>
                  <Select
                    placeholder="All Team Leads"
                    style={{ minWidth: 200, flex: 1 }}
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

                  <Text strong style={{ whiteSpace: 'nowrap', minWidth: 60 }}>PM:</Text>
                  <Select
                    placeholder="All PMs"
                    style={{ minWidth: 200, flex: 1 }}
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
                style={{ borderRadius: 8, height: 44 }}
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
                <Table.Summary.Row style={{ background: '#f8fafc' }}>
                  <Table.Summary.Cell index={0} colSpan={4}>
                    <Text strong>Total Hours in Current View</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <Text strong style={{ color: '#4f46e5' }}>{total.toFixed(1)} hrs</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              );
            }}
          />
        </Card>
      )}
    </div>
  );
};

export default EmployeeReportsPage;