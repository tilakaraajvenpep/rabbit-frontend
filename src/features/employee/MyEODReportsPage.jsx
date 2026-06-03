import React, { useState, useEffect } from 'react';
import { 
  Card, Row, Col, DatePicker, Button, Table, 
  Typography, notification, Tag, Form, Input, Modal, InputNumber
} from 'antd';
import { SearchOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService } from '../../services/reportService';
import { ticketService } from '../../services/ticketService';
import { projectService } from '../../services/projectService';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import PageHeader from '../../components/common/PageHeader';

const { RangePicker } = DatePicker;
const { Text } = Typography;
const { TextArea } = Input;

const MyEODReportsPage = () => {
  const { currentUser } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  
  const t1 = isDarkMode ? '#f3f4f6' : '#1f2937';
  const t2 = isDarkMode ? '#9ca3af' : '#4b5563';
  const card = isDarkMode ? '#1f2937' : '#ffffff';
  const border = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  
  // Date Range filter
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm] = Form.useForm();
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [ticketRes, projectRes] = await Promise.all([
        ticketService.getTickets(),
        projectService.getProjects()
      ]);
      setTickets(ticketRes.data || []);
      setProjects(projectRes.data || []);
    } catch (error) {
      notification.error({ message: 'Failed to load metadata' });
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
      
      const res = await reportService.getReportsByRange(currentUser.id || currentUser.userId, start, end);
      const reportsData = res?.data || [];
      const list = [];

      reportsData.forEach(report => {
        if (!report || !report.items) return;

        report.items.forEach(item => {
          const ticketInfo = tickets.find(t => Number(t.id) === Number(item.ticketId));
          const projectInfo = projects.find(p => Number(p.id) === Number(ticketInfo?.projectId || item.projectId));
          
          list.push({
            userId: report.userId,
            date: report.date || report.reportDate,
            projectId: ticketInfo?.projectId || item.projectId || 'N/A',
            projectName: projectInfo?.name || projectInfo?.projectName || 'N/A',
            ticketId: item.ticketId,
            ticketCode: ticketInfo?.code || 'N/A',
            ticketTitle: ticketInfo?.title || 'Unknown',
            hours: Number(item.hours || item.hoursSpent || 0),
            workDone: item.workDone || '',
            key: `${report.userId}-${report.date || report.reportDate}-${item.ticketId || Math.random()}`
          });
        });
      });

      const sorted = list.sort((a, b) => dayjs(b.date).unix() - dayjs(a.date).unix());
      setReportData(sorted);
      setHasGenerated(true);
    } catch (error) {
      console.error('My Report Search Error:', error);
      notification.error({ 
        message: 'Search Failed', 
        description: error.response?.data?.message || error.message || 'Unknown error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditModal = (record) => {
    setEditingRecord(record);
    const decimalHours = record.hours;
    const h = Math.floor(decimalHours);
    const m = Math.round((decimalHours - h) * 60);

    editForm.setFieldsValue({
      date: dayjs(record.date),
      hours: h,
      minutes: m,
      workDone: record.workDone
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (values) => {
    setUpdating(true);
    try {
      const originalDate = editingRecord.date;
      const targetDate = values.date.format('YYYY-MM-DD');
      
      const newHoursSpent = Number(values.hours) + (Number(values.minutes) / 60);
      if (newHoursSpent <= 0) {
        throw new Error("Total hours must be greater than 0");
      }

      if (originalDate === targetDate) {
        // Date is same: update description & time
        const reportRes = await reportService.getReportByDate(editingRecord.userId, originalDate);
        const report = reportRes.data;
        if (!report) {
          throw new Error("EOD report not found for this date.");
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

        await reportService.submitDailyReport({
          reportDate: originalDate,
          items: updatedItems
        });
      } else {
        // Date changed: move item to new date
        const origRes = await reportService.getReportByDate(editingRecord.userId, originalDate);
        const origReport = origRes.data;
        if (!origReport) {
          throw new Error("EOD report not found for original date.");
        }

        // Get the item that is being moved
        const itemToMove = origReport.items.find(item => Number(item.ticketId) === Number(editingRecord.ticketId));
        if (!itemToMove) {
          throw new Error("Item not found in original report.");
        }

        // Filter it out of original report
        const remainingItems = origReport.items
          .filter(item => Number(item.ticketId) !== Number(editingRecord.ticketId))
          .map(item => ({
            ...item,
            hoursSpent: Number(item.hoursSpent || item.hours)
          }));

        // Fetch target report
        const targetRes = await reportService.getReportByDate(editingRecord.userId, targetDate);
        const targetReport = targetRes.data;
        let targetItems = [];

        if (targetReport && targetReport.items) {
          // If already exists on target date, check if this ticket is there
          const existingItemIndex = targetReport.items.findIndex(item => Number(item.ticketId) === Number(editingRecord.ticketId));
          if (existingItemIndex > -1) {
            targetItems = targetReport.items.map((item, idx) => {
              if (idx === existingItemIndex) {
                return {
                  ...item,
                  hoursSpent: (Number(item.hoursSpent || item.hours) || 0) + newHoursSpent,
                  workDone: `${item.workDone}\n${values.workDone}`
                };
              }
              return {
                ...item,
                hoursSpent: Number(item.hoursSpent || item.hours)
              };
            });
          } else {
            targetItems = [
              ...targetReport.items.map(item => ({ ...item, hoursSpent: Number(item.hoursSpent || item.hours) })),
              {
                ticketId: Number(editingRecord.ticketId),
                hoursSpent: newHoursSpent,
                workDone: values.workDone
              }
            ];
          }
        } else {
          // No report on target date, create one
          targetItems = [{
            ticketId: Number(editingRecord.ticketId),
            hoursSpent: newHoursSpent,
            workDone: values.workDone
          }];
        }

        // Submit both daily reports (Backend transaction handles them sequentially)
        await reportService.submitDailyReport({
          reportDate: originalDate,
          items: remainingItems
        });

        await reportService.submitDailyReport({
          reportDate: targetDate,
          items: targetItems
        });
      }

      notification.success({
        message: 'Report Updated',
        description: 'EOD report successfully updated and synced.'
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
      title: 'Date', dataIndex: 'date', key: 'date', width: 120,
      render: (date) => dayjs(date).format('DD MMM YYYY')
    },
    { 
      title: 'Project Name', 
      dataIndex: 'projectName', 
      key: 'projectName', 
      width: 200,
      render: (name) => <span style={{ fontWeight: 600, color: t1 }}>{name}</span>
    },
    { 
      title: 'Ticket Code', dataIndex: 'ticketCode', key: 'ticketCode', width: 120,
      render: (code) => (
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
      )
    },
    { 
      title: 'Ticket Name / Task', dataIndex: 'ticketTitle', key: 'ticketTitle',
      render: (title) => <span style={{ fontWeight: 600, color: t1 }}>{title}</span>
    },
    { 
      title: 'Hours & Minutes', 
      dataIndex: 'hours', 
      key: 'hours', 
      width: 140,
      render: (h) => {
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
      title: 'Description', dataIndex: 'workDone', key: 'workDone',
      render: (text) => <span style={{ color: t2, whiteSpace: 'pre-wrap' }}>{text}</span>
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Button 
          type="link" 
          icon={<EditOutlined />} 
          onClick={() => handleOpenEditModal(record)}
          style={{ padding: 0, fontWeight: 600 }}
        >
          Edit
        </Button>
      )
    }
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 8px' }}>
      <PageHeader title="My EOD Reports" />

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
          <Table 
            dataSource={reportData} 
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
                  <Table.Summary.Cell index={0} colSpan={4}>
                    <Text strong style={{ color: t1 }}>Total Hours in Current View</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="left">
                    <Text strong style={{ color: '#10b981' }}>{total.toFixed(1)} hrs</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} colSpan={2} />
                </Table.Summary.Row>
              );
            }}
          />
        </Card>
      )}

      {/* Edit Modal */}
      <Modal
        title={<span style={{ fontSize: 16, fontWeight: 700, color: t1 }}>Edit EOD Entry</span>}
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
              <Form.Item
                name="date"
                label={<span style={{ fontWeight: 600, color: t2, fontSize: 12 }}>REPORT DATE</span>}
                rules={[{ required: true, message: 'Please select a date' }]}
              >
                <DatePicker style={{ width: '100%', borderRadius: 8 }} format="YYYY-MM-DD" />
              </Form.Item>

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

export default MyEODReportsPage;
