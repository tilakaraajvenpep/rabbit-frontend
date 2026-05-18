import React, { useState, useEffect } from 'react';
import { 
  Card, Row, Col, Select, Button, Typography, Space, notification, Spin, Descriptions, Table
} from 'antd';
import { DownloadOutlined, ReloadOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { projectService } from '../../services/projectService';
import { analyticsService } from '../../services/analyticsService';
import PageHeader from '../../components/common/PageHeader';
import { downloadCSV } from '../../utils/exportUtils';

const { Title, Text } = Typography;

const OverallReportsPage = () => {
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  
  // Compiled report data
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await projectService.getProjects();
      setProjects(res.data);
    } catch (error) {
      notification.error({ message: 'Failed to load projects' });
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = async (projectId) => {
    setSelectedProjectId(projectId);
    if (!projectId) {
      setReportData(null);
      return;
    }

    setDataLoading(true);
    try {
      const [costRes, analyticsRes, projectRes] = await Promise.all([
        projectService.getCostAnalysis(projectId).catch(() => ({ data: null })),
        analyticsService.getProjectAnalytics(projectId).catch(() => ({ data: null })),
        projectService.getProjectById(projectId).catch(() => ({ data: null }))
      ]);

      const costData = costRes.data || {};
      const analyticsData = analyticsRes.data || {};
      const projectDetails = projectRes.data || {};

      // Calculate total budget used from burnRate
      const totalBudgetUsed = analyticsData.burnRate?.reduce((sum, item) => sum + item.cost, 0) || 0;
      
      // Calculate total resources/hours used from employeeWork
      const totalHoursUsed = analyticsData.employeeWork?.reduce((sum, emp) => sum + emp.actual, 0) || 0;

      setReportData({
        projectName: projectDetails?.title || projectDetails?.code || 'Unknown Project',
        projectCode: projectDetails?.code || 'N/A',
        overallBudget: costData?.totalBudget || 0,
        budgetUsed: totalBudgetUsed,
        estimatedHours: costData?.estimatedHours || 0,
        resourcesUsed: totalHoursUsed,
        employeeContributions: analyticsData.employeeWork || []
      });
      
    } catch (error) {
      notification.error({ message: 'Failed to load project details' });
      setReportData(null);
    } finally {
      setDataLoading(false);
    }
  };

  const handleExport = () => {
    if (!reportData) return;

    // Formatting data for CSV
    // We will create a structured CSV with summary rows first, then employee breakdown
    
    const csvData = [];
    
    // Summary
    csvData.push({ Metric: 'Project Name', Value: reportData.projectName });
    csvData.push({ Metric: 'Project Code', Value: reportData.projectCode });
    csvData.push({ Metric: 'Overall Budget ($)', Value: reportData.overallBudget });
    csvData.push({ Metric: 'Budget Used ($)', Value: reportData.budgetUsed });
    csvData.push({ Metric: 'Budget Remaining ($)', Value: reportData.overallBudget - reportData.budgetUsed });
    csvData.push({ Metric: 'Estimated Hours', Value: reportData.estimatedHours });
    csvData.push({ Metric: 'Total Hours Used', Value: reportData.resourcesUsed });
    csvData.push({ Metric: '', Value: '' }); // Empty row separator
    
    // Employee Contribution Headers
    csvData.push({ Metric: 'Employee Name', Value: 'Planned Hours', Extra: 'Actual Hours' });
    
    // Employee Details
    reportData.employeeContributions.forEach(emp => {
      csvData.push({
        Metric: emp.name,
        Value: emp.planned,
        Extra: emp.actual
      });
    });

    const filename = `Overall_Report_${reportData.projectCode}_${dayjs().format('YYYYMMDD')}`;
    downloadCSV(csvData, filename);
    notification.success({ message: 'Report Downloaded Successfully' });
  };

  const employeeColumns = [
    { title: 'Employee Name', dataIndex: 'name', key: 'name' },
    { title: 'Planned Hours', dataIndex: 'planned', key: 'planned', align: 'right' },
    { title: 'Actual Hours', dataIndex: 'actual', key: 'actual', align: 'right' },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 40 }}>
      <PageHeader title="Overall Project Reports" />

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} md={16}>
            <Text strong>Select Project</Text>
            <Select
              showSearch
              placeholder="Select a project to generate report"
              style={{ width: '100%', marginTop: 8 }}
              loading={loading}
              allowClear
              onChange={handleProjectSelect}
              optionFilterProp="children"
            >
              {projects.map(p => (
                <Select.Option key={p.id} value={p.id}>{p.code} - {p.title || p.name}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} md={8}>
            <Button 
              type="primary" 
              icon={<DownloadOutlined />} 
              onClick={handleExport}
              disabled={!reportData || dataLoading}
              block
            >
              Download Overall Report (CSV)
            </Button>
          </Col>
        </Row>
      </Card>

      {dataLoading ? (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" tip="Compiling report data..." />
        </div>
      ) : reportData ? (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card title="Report Summary Preview">
            <Descriptions bordered column={{ xxl: 3, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }}>
              <Descriptions.Item label="Project Name">{reportData.projectName}</Descriptions.Item>
              <Descriptions.Item label="Project Code">{reportData.projectCode}</Descriptions.Item>
              <Descriptions.Item label="Overall Budget">${reportData.overallBudget.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Budget Used">
                <Text type={reportData.budgetUsed > reportData.overallBudget ? 'danger' : 'success'}>
                  ${reportData.budgetUsed.toLocaleString()}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Estimated Hours">{reportData.estimatedHours} hrs</Descriptions.Item>
              <Descriptions.Item label="Resources Used (Hours)">{reportData.resourcesUsed} hrs</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="Employee Contributions Preview">
            <Table 
              dataSource={reportData.employeeContributions} 
              columns={employeeColumns} 
              rowKey="name"
              pagination={false}
              size="small"
            />
          </Card>
        </Space>
      ) : (
        <Card>
          <div style={{ textAlign: 'center', color: '#888', padding: '40px 0' }}>
            <FileTextOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
            <br />
            <Text>Please select a project to view and download the overall report.</Text>
          </div>
        </Card>
      )}
    </div>
  );
};

export default OverallReportsPage;
