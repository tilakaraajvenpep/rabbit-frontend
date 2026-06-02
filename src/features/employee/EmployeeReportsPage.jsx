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
import PageHeader from '../../components/common/PageHeader';
import { downloadCSV } from '../../utils/exportUtils';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const EmployeeReportsPage = () => {
  const { currentUser, role } = useAuthStore();
  const isManager = ['TeamLead', 'ProjectManager', 'TenantAdmin'].includes(role);
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [rawReportData, setRawReportData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  
  // Filters
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Filter effect to update filteredData when selectedEmployee changes or rawReportData updates
  useEffect(() => {
    if (isManager && selectedEmployee) {
      setFilteredData(rawReportData.filter(r => String(r.userId) === String(selectedEmployee)));
    } else {
      setFilteredData(rawReportData);
    }
  }, [selectedEmployee, rawReportData, isManager]);

  const fetchInitialData = async () => {
    try {
      const [ticketRes, userRes] = await Promise.all([
        ticketService.getTickets(),
        isManager ? adminService.getUsers() : Promise.resolve({ data: [] })
      ]);

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

      setTickets(loadedTickets);
      if (isManager) {
        setEmployees(loadedEmployees);
      }
    } catch (error) {
      notification.error({ message: 'Failed to load initial data' });
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
      
      let res;
      if (isManager) {
        res = await reportService.getAllReportsByRange(start, end);
      } else {
        res = await reportService.getReportsByRange(currentUser.id || currentUser.userId, start, end);
      }
      
      if (!res || !res.data) {
        setRawReportData([]);
        setFilteredData([]);
        setHasGenerated(true);
        return;
      }

      let reports = [];
      res.data.forEach(report => {
        if (!report || !report.items) return;

        const employeeName = isManager 
          ? (report.user?.fullName || report.user?.name || employees.find(u => Number(u.id) === Number(report.userId))?.name || 'Unknown')
          : (currentUser.name || currentUser.fullName);

        report.items.forEach(item => {
          const ticketInfo = tickets.find(t => Number(t.id) === Number(item.ticketId));
          reports.push({
            userId: report.userId,
            date: report.date || report.reportDate,
            employeeName: employeeName,
            ticketCode: ticketInfo?.code || 'N/A',
            ticketTitle: ticketInfo?.title || 'Unknown',
            hours: Number(item.hours || item.hoursSpent || 0),
            workDone: item.workDone || '',
            blockers: report.blockers || 'None',
            key: `${report.userId}-${report.date || report.reportDate}-${item.ticketId || Math.random()}`
          });
        });
      });

      const sorted = reports.sort((a, b) => dayjs(b.date).unix() - dayjs(a.date).unix());
      setRawReportData(sorted);
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

      {/* Date Range picker and Generate button ONLY - as requested */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 280 }}>
              {isManager && (
                <>
                  <Text strong style={{ whiteSpace: 'nowrap' }}>Filter by Employee:</Text>
                  <Select
                    placeholder="All Employees"
                    style={{ minWidth: 200, flex: 1 }}
                    allowClear
                    value={selectedEmployee}
                    onChange={setSelectedEmployee}
                    size="large"
                  >
                    {employees.map(u => (
                      <Select.Option key={u.id} value={u.id}>{u.name || u.fullName}</Select.Option>
                    ))}
                  </Select>
                </>
              )}
            </div>

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
                  <Table.Summary.Cell index={0} colSpan={isManager ? 4 : 3}>
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