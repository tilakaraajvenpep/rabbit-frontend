import React, { useState, useEffect } from 'react';
import { 
  Card, Row, Col, DatePicker, Select, Button, Table, 
  Typography, Space, notification, Tag, Alert
} from 'antd';
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService } from '../../services/reportService';
import { ticketService } from '../../services/ticketService';
import { projectService } from '../../services/projectService';
import { useAuthStore } from '../../store/authStore';
import { adminService } from '../../services/adminService';
import PageHeader from '../../components/common/PageHeader';
import { downloadCSV } from '../../utils/exportUtils';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const EmployeeReportsPage = () => {
  const { currentUser, role } = useAuthStore();
  const isManager = ['TeamLead', 'ProjectManager', 'TenantAdmin'].includes(role);
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  
  // Filters
  const [selectedProject, setSelectedProject] = useState(null);
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(isManager ? null : currentUser.id);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [projectRes, ticketRes, userRes] = await Promise.all([
        projectService.getProjects(),
        ticketService.getTickets(),
        isManager ? adminService.getUsers() : Promise.resolve({ data: [] })
      ]);

      const loadedProjects = projectRes.data || [];
      const loadedTickets = ticketRes.data || [];
      const pmId = currentUser?.userId || currentUser?.id;
      const loadedEmployees = isManager 
        ? userRes.data.filter(u => {
            if (u.role !== 'Employee' && u.role !== 'TeamLead') return false;
            if (role === 'ProjectManager') {
              if (u.role === 'TeamLead') {
                return String(u.projectManagerId) === String(pmId);
              }
              if (u.role === 'Employee') {
                if (String(u.projectManagerId) === String(pmId)) return true;
                if (u.teamLeadId) {
                  const tl = userRes.data.find(tlUser => String(tlUser.id) === String(u.teamLeadId));
                  if (tl && String(tl.projectManagerId) === String(pmId)) return true;
                }
                return false;
              }
            } else if (role === 'TeamLead') {
              if (u.role === 'TeamLead') {
                return String(u.id || u.userId) === String(pmId);
              }
              if (u.role === 'Employee') {
                return String(u.teamLeadId) === String(pmId);
              }
            }
            return true;
          }) 
        : [];

      setProjects(loadedProjects);
      setTickets(loadedTickets);
      if (isManager) {
        setEmployees(loadedEmployees);
      }
    } catch (error) {
      notification.error({ message: 'Failed to load initial data' });
    }
  };

  const triggerSearch = async (currentTickets = tickets, currentEmployees = employees) => {
    if (!selectedProject) {
      notification.warning({ message: 'Project Required', description: 'Please select a project to generate reports.' });
      return;
    }
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
      
      let res;
      if (isManager) {
        res = await reportService.getAllReportsByRange(start, end);
      } else {
        res = await reportService.getReportsByRange(currentUser.id, start, end);
      }
      
      if (!res || !res.data) {
        setFilteredData([]);
        return;
      }

      // Filter tickets belonging to selected project
      const projectTickets = (currentTickets || []).filter(t => String(t.projectId) === String(selectedProject));
      const projectTicketIds = projectTickets.map(t => t.id);

      let reports = [];
      res.data.forEach(report => {
        if (!report || !report.items) return;

        if (isManager && selectedEmployee && Number(report.userId) !== Number(selectedEmployee)) return;

        const employeeName = isManager 
          ? (report.user?.fullName || currentEmployees.find(u => Number(u.id) === Number(report.userId))?.name || 'Unknown')
          : currentUser.name;

        report.items.forEach(item => {
          // Project filter constraint
          if (!projectTicketIds.includes(item.ticketId)) return;

          if (selectedTicket && item.ticketId !== selectedTicket) return;
          
          const ticketInfo = projectTickets.find(t => Number(t.id) === Number(item.ticketId));
          reports.push({
            date: report.date || report.reportDate,
            employeeName: employeeName,
            ticketCode: ticketInfo?.code || 'N/A',
            ticketTitle: ticketInfo?.title || 'Unknown',
            hours: Number(item.hours || 0),
            workDone: item.workDone || '',
            blockers: report.blockers || 'None',
            key: `${report.userId}-${report.date || report.reportDate}-${item.ticketId || Math.random()}`
          });
        });
      });

      const sorted = reports.sort((a, b) => dayjs(b.date).unix() - dayjs(a.date).unix());
      setFilteredData(sorted);
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

  const handleSearch = () => triggerSearch(tickets, employees);

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
    ...(isManager ? [{ title: 'Employee', dataIndex: 'employeeName', key: 'employeeName', width: 150 }] : []),
    { title: 'Ticket Code', dataIndex: 'ticketCode', key: 'ticketCode', width: 110 },
    { title: 'Ticket / Task', dataIndex: 'ticketTitle', key: 'ticketTitle' },
    { title: 'Work Done', dataIndex: 'workDone', key: 'workDone' },
    { 
      title: 'Hours', dataIndex: 'hours', key: 'hours', width: 80, align: 'right',
      render: (h) => h?.toFixed(1)
    },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <PageHeader title="Work Reports & Exports" />

      {!selectedProject && (
        <Alert
          message="Project Selection Required"
          description="Please select a project from the dropdown first to unlock date range, ticket, and employee filters."
          type="info"
          showIcon
          style={{ marginBottom: 20, borderRadius: 8 }}
        />
      )}

      <Card style={{ marginBottom: 24, borderRadius: 12 }}>
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} md={24}>
            <Text strong style={{ color: '#4f46e5', fontSize: '14px' }}>Select Project (Compulsory) *</Text>
            <Select
              placeholder="-- Select Compulsory Project --"
              style={{ width: '100%', marginTop: 8 }}
              value={selectedProject}
              onChange={(val) => {
                setSelectedProject(val);
                setSelectedTicket(null); // Reset ticket filter
                setFilteredData([]); // Clear previous data
              }}
              size="large"
            >
              {projects.map(p => (
                <Select.Option key={p.id} value={p.id}>{p.name || p.projectName}</Select.Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} md={8}>
            <Text strong type={!selectedProject ? "secondary" : undefined}>Select Date Range</Text>
            <RangePicker 
              style={{ width: '100%', marginTop: 8 }} 
              value={dateRange}
              onChange={(val) => setDateRange(val)}
              disabled={!selectedProject}
            />
          </Col>
          
          <Col xs={24} md={isManager ? 8 : 16}>
            <Text strong type={!selectedProject ? "secondary" : undefined}>Filter by Ticket</Text>
            <Select
              placeholder={!selectedProject ? "Select project first" : "All Tickets"}
              style={{ width: '100%', marginTop: 8 }}
              allowClear
              value={selectedTicket}
              onChange={setSelectedTicket}
              disabled={!selectedProject}
            >
              {tickets.filter(t => String(t.projectId) === String(selectedProject)).map(t => (
                <Select.Option key={t.id} value={t.id}>{t.code}: {t.title}</Select.Option>
              ))}
            </Select>
          </Col>

          {isManager && (
            <Col xs={24} md={8}>
              <Text strong type={!selectedProject ? "secondary" : undefined}>Filter by Employee Name</Text>
              <Select
                placeholder={!selectedProject ? "Select project first" : "All Employees"}
                style={{ width: '100%', marginTop: 8 }}
                allowClear
                value={selectedEmployee}
                onChange={setSelectedEmployee}
                disabled={!selectedProject}
              >
                {employees.map(u => (
                  <Select.Option key={u.id} value={u.id}>{u.name || u.fullName}</Select.Option>
                ))}
              </Select>
            </Col>
          )}

          <Col xs={24} md={24} style={{ textAlign: 'right', marginTop: 8 }}>
            <Space>
              <Button 
                type="primary" 
                icon={<SearchOutlined />} 
                onClick={handleSearch}
                loading={loading}
                disabled={!selectedProject}
                size="large"
                style={{ borderRadius: 8 }}
              >
                Generate Report
              </Button>
              <Button 
                icon={<DownloadOutlined />} 
                onClick={handleExport}
                disabled={filteredData.length === 0}
                size="large"
                style={{ borderRadius: 8 }}
              >
                Export CSV
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table 
        dataSource={filteredData} 
        columns={columns} 
        loading={loading}
        rowKey="key"
        pagination={{ pageSize: 10 }}
        summary={(pageData) => {
          let total = 0;
          pageData.forEach(({ hours }) => { total += hours; });
          return (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={isManager ? 4 : 3}>Total Hours in Period</Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <Text strong>{total.toFixed(1)}</Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          );
        }}
      />
    </div>
  );
};

export default EmployeeReportsPage;