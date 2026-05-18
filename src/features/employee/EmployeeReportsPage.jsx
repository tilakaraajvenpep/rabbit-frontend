import React, { useState, useEffect } from 'react';
import { 
  Card, Row, Col, DatePicker, Select, Button, Table, 
  Typography, Space, notification, Divider 
} from 'antd';
import { DownloadOutlined, SearchOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService } from '../../services/reportService';
import { ticketService } from '../../services/ticketService';
import { useAuthStore } from '../../store/authStore';
import { adminService } from '../../services/adminService';
import PageHeader from '../../components/common/PageHeader';
import { downloadCSV } from '../../utils/exportUtils';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const EmployeeReportsPage = () => {
  const { currentUser, role } = useAuthStore();
  const isManager = ['TeamLead', 'ProjectManager'].includes(role);
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  
  // Filters
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(isManager ? null : currentUser.id);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [ticketRes, userRes] = await Promise.all([
        ticketService.getTickets(),
        isManager ? adminService.getUsers() : Promise.resolve({ data: [] })
      ]);

      setTickets(ticketRes.data);
      if (isManager) {
        setEmployees(userRes.data.filter(u => u.role === 'Employee'));
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
        // Broad range to catch everything if no date is selected
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

      // Flattening the data for the table and export
      let reports = [];
      res.data.forEach(report => {
        if (!report || !report.items) return;

        if (isManager && selectedEmployee && Number(report.userId) !== Number(selectedEmployee)) return;

        const employeeName = isManager 
          ? (report.user?.fullName || employees.find(u => Number(u.id) === Number(report.userId))?.name || 'Unknown')
          : currentUser.name;

        report.items.forEach(item => {
          // If a specific ticket is selected, filter here
          if (selectedTicket && item.ticketId !== selectedTicket) return;
          
          const ticketInfo = (tickets || []).find(t => Number(t.id) === Number(item.ticketId));
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

      setFilteredData(reports);
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
    { title: 'Date', dataIndex: 'date', key: 'date', width: 120 },
    ...(isManager ? [{ title: 'Employee', dataIndex: 'employeeName', key: 'employeeName', width: 150 }] : []),
    { title: 'Ticket', dataIndex: 'ticketCode', key: 'ticketCode', width: 100 },
    { title: 'Work Description', dataIndex: 'workDone', key: 'workDone' },
    { title: 'Hours', dataIndex: 'hours', key: 'hours', width: 80, align: 'right' },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <PageHeader title="Work Reports & Exports" />

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} md={8}>
            <Text strong>Select Date Range</Text>
            <RangePicker 
              style={{ width: '100%', marginTop: 8 }} 
              value={dateRange}
              onChange={(val) => setDateRange(val)}
            />
          </Col>
          <Col xs={24} md={isManager ? 6 : 8}>
            <Text strong>Filter by Ticket</Text>
            <Select
              placeholder="All Tickets"
              style={{ width: '100%', marginTop: 8 }}
              allowClear
              onChange={setSelectedTicket}
            >
              {tickets.map(t => (
                <Select.Option key={t.id} value={t.id}>{t.code}: {t.title}</Select.Option>
              ))}
            </Select>
          </Col>
          {isManager && (
            <Col xs={24} md={6}>
              <Text strong>Filter by Employee</Text>
              <Select
                placeholder="All Employees"
                style={{ width: '100%', marginTop: 8 }}
                allowClear
                onChange={setSelectedEmployee}
              >
                {employees.map(u => (
                  <Select.Option key={u.id} value={u.id}>{u.name}</Select.Option>
                ))}
              </Select>
            </Col>
          )}
          <Col xs={24} md={isManager ? 6 : 8}>
            <Space>
              <Button 
                type="primary" 
                icon={<SearchOutlined />} 
                onClick={handleSearch}
                loading={loading}
              >
                Generate
              </Button>
              <Button 
                icon={<DownloadOutlined />} 
                onClick={handleExport}
                disabled={filteredData.length === 0}
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