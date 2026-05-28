import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Space, Button, Modal, Timeline, Tag, Statistic, Row, Col, Alert, Tooltip, Skeleton } from 'antd';
import { DollarOutlined, ClockCircleOutlined, HistoryOutlined, ProjectOutlined, ArrowLeftOutlined, EyeOutlined, SyncOutlined } from '@ant-design/icons';
import { projectService } from '../../services/projectService';
import PageHeader from '../../components/common/PageHeader';
import { useThemeStore } from '../../store/themeStore';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

const CostHistoryPage = () => {
  const { isDarkMode } = useThemeStore();
  const [projects, setProjects] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projRes, auditRes] = await Promise.all([
        projectService.getProjects(),
        projectService.getAuditLog()
      ]);
      setProjects(projRes.data || []);
      setAuditLogs(auditRes.data || []);
    } catch (err) {
      console.error('Failed to load cost history data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Process data to calculate statistics for each project
  const processedData = projects.map(project => {
    const projIdStr = String(project.id);
    
    // Filter audit logs for this project
    const projectAudits = auditLogs.filter(log => String(log.entityId) === projIdStr && log.entityType === 'project');

    // 1. Analyzed Count (How many times budget has been created/updated/submitted)
    const analyzedLogs = projectAudits.filter(log => {
      if (log.action === 'CREATE_COST_ANALYSIS' || log.action === 'UPDATE_COST_ANALYSIS') {
        return true;
      }
      if (log.action === 'UPDATE_PROJECT_STATUS') {
        const status = log.newData?.status || log.status;
        return status === 'PendingPMApproval';
      }
      return false;
    });
    const analyzedCount = analyzedLogs.length;

    // 2. Returned Count (How many times project was returned for revision)
    const returnedLogs = projectAudits.filter(log => {
      if (log.action === 'UPDATE_PROJECT_STATUS') {
        const status = log.newData?.status || log.status;
        return status === 'ReturnedForRevision' || status === 'ReturnedToAccounts';
      }
      return false;
    });
    const returnedCount = returnedLogs.length;

    // 3. Revision Count (How many times budget has been revised/updated)
    const revisionLogs = projectAudits.filter(log => log.action === 'UPDATE_COST_ANALYSIS');
    const revisionCount = revisionLogs.length;

    // 4. Final approved budget: fallback to budgetTable sum if approvedBudget is 0 or null
    let finalBudget = Number(project.approvedBudget || 0);
    if (finalBudget === 0 && Array.isArray(project.budgetTable)) {
      finalBudget = project.budgetTable.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
    }

    // 5. Initial budget: extract from CREATE_COST_ANALYSIS if it exists
    const createLog = projectAudits.find(log => log.action === 'CREATE_COST_ANALYSIS');
    let initialBudget = 0;
    if (createLog && createLog.newData?.totalBudget) {
      initialBudget = Number(createLog.newData.totalBudget);
    } else if (createLog && Array.isArray(createLog.newData?.budgetTable)) {
      initialBudget = createLog.newData.budgetTable.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
    } else {
      initialBudget = finalBudget;
    }

    return {
      ...project,
      analyzedCount,
      returnedCount,
      revisionCount,
      initialBudget: String(initialBudget),
      finalBudget: String(finalBudget),
      audits: projectAudits
    };
  });

  const columns = [
    {
      title: 'Project Info',
      key: 'projectInfo',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: '15px' }}>{record.name}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>{record.code}</Text>
        </Space>
      )
    },
    {
      title: 'Client',
      dataIndex: 'client',
      key: 'client',
    },
    {
      title: 'Initial Budget',
      dataIndex: 'initialBudget',
      key: 'initialBudget',
      sorter: (a, b) => Number(a.initialBudget) - Number(b.initialBudget),
      render: (val) => (
        <Text style={{ color: isDarkMode ? '#d1d5db' : '#4b5563', fontSize: '14.5px' }}>
          ₹{Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      )
    },
    {
      title: 'Final Budget',
      dataIndex: 'finalBudget',
      key: 'finalBudget',
      sorter: (a, b) => Number(a.finalBudget) - Number(b.finalBudget),
      render: (val) => (
        <Text strong style={{ color: '#059669', fontSize: '15.5px' }}>
          ₹{Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      )
    },
    {
      title: 'Times Revised',
      dataIndex: 'revisionCount',
      key: 'revisionCount',
      sorter: (a, b) => a.revisionCount - b.revisionCount,
      render: (count) => (
        <Tag color={count > 0 ? 'purple' : 'default'} style={{ borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>
          {count} {count === 1 ? 'revision' : 'revisions'}
        </Tag>
      )
    },
    {
      title: 'Times Returned',
      dataIndex: 'returnedCount',
      key: 'returnedCount',
      sorter: (a, b) => a.returnedCount - b.returnedCount,
      render: (count) => (
        <Tag color={count > 0 ? 'volcano' : 'green'} style={{ borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>
          {count} {count === 1 ? 'time' : 'times'}
        </Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button 
          type="primary"
          ghost
          icon={<HistoryOutlined />}
          onClick={() => {
            setSelectedProject(record);
            setIsModalOpen(true);
          }}
          style={{ borderRadius: 8 }}
        >
          View Log
        </Button>
      )
    }
  ];

  const getTimelineColor = (action, status) => {
    if (action === 'CREATE_COST_ANALYSIS') return 'blue';
    if (action === 'UPDATE_COST_ANALYSIS') return 'cyan';
    if (action === 'UPDATE_PROJECT_STATUS') {
      if (status === 'Approved') return 'green';
      if (status === 'PendingPMApproval') return 'blue';
      if (status === 'ReturnedForRevision' || status === 'ReturnedToAccounts') return 'red';
      return 'orange';
    }
    return 'gray';
  };

  const getTimelineLabel = (action, status) => {
    if (action === 'CREATE_COST_ANALYSIS') return 'Initial Budget Analyzed';
    if (action === 'UPDATE_COST_ANALYSIS') return 'Budget Re-analyzed';
    if (action === 'UPDATE_PROJECT_STATUS') {
      if (status === 'Approved') return 'Project Approved';
      if (status === 'PendingPMApproval') return 'Budget Submitted for Approval';
      if (status === 'ReturnedForRevision') return 'Returned for Revision (PM)';
      if (status === 'ReturnedToAccounts') return 'Returned to Accounts';
      return `Status Updated: ${status}`;
    }
    if (action === 'CREATE_PROJECT') return 'Project Created';
    return action;
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
      <PageHeader 
        title="Cost Analysis History" 
        extra={
          <Button icon={<SyncOutlined />} onClick={fetchData} loading={loading}>
            Refresh
          </Button>
        }
      />

      {loading ? (
        <Card style={{ borderRadius: 16 }}>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      ) : (
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          {/* Top Analytics Banner */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <Statistic 
                  title="Total Analyzed Projects" 
                  value={processedData.length} 
                  prefix={<ProjectOutlined style={{ color: '#4f46e5' }} />} 
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <Statistic 
                  title="Total Budget Revisions" 
                  value={processedData.reduce((acc, curr) => acc + curr.revisionCount, 0)} 
                  prefix={<DollarOutlined style={{ color: '#8b5cf6' }} />} 
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <Statistic 
                  title="Revision Returns" 
                  value={processedData.reduce((acc, curr) => acc + curr.returnedCount, 0)} 
                  prefix={<HistoryOutlined style={{ color: '#dc2626' }} />} 
                />
              </Card>
            </Col>
          </Row>

          <Card 
            title="Projects Budget History Logs" 
            style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}
          >
            <Table 
              columns={columns}
              dataSource={processedData}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: 'No project history found.' }}
            />
          </Card>
        </Space>
      )}

      {/* Audit Log Details Modal */}
      <Modal
        title={
          <Space>
            <HistoryOutlined style={{ color: '#4f46e5' }} />
            <span>Audit History: {selectedProject?.name}</span>
          </Space>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setIsModalOpen(false)} style={{ borderRadius: 8 }}>
            Close
          </Button>
        ]}
        width={650}
        bodyStyle={{ maxHeight: '70vh', overflowY: 'auto', paddingTop: '20px' }}
      >
        {selectedProject && (
          <div style={{ marginBottom: 24, padding: '16px 20px', background: isDarkMode ? '#1f2937' : '#f8fafc', borderRadius: 12, border: isDarkMode ? '1px solid #374151' : '1px solid #e2e8f0' }}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Text style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Project Code</Text><br />
                <Text strong style={{ fontSize: '15px', color: isDarkMode ? '#f3f4f6' : '#1f2937' }}>{selectedProject.code}</Text>
              </Col>
              <Col span={12}>
                <Text style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Client</Text><br />
                <Text strong style={{ fontSize: '15px', color: isDarkMode ? '#f3f4f6' : '#1f2937' }}>{selectedProject.client || '—'}</Text>
              </Col>
              <Col span={12}>
                <Text style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Initial Budget</Text><br />
                <Text strong style={{ fontSize: '15px', color: isDarkMode ? '#d1d5db' : '#4b5563' }}>
                  ₹{Number(selectedProject.initialBudget).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </Col>
              <Col span={12}>
                <Text style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Final Budget</Text><br />
                <Text strong style={{ fontSize: '16px', color: '#10b981' }}>
                  ₹{Number(selectedProject.finalBudget).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </Col>
              <Col span={12}>
                <Text style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Times Revised</Text><br />
                <Tag color="purple" style={{ fontWeight: 600, borderRadius: 4 }}>
                  {selectedProject.revisionCount} {selectedProject.revisionCount === 1 ? 'revision' : 'revisions'}
                </Tag>
              </Col>
              <Col span={12}>
                <Text style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Times Returned</Text><br />
                <Tag color={selectedProject.returnedCount > 0 ? 'volcano' : 'green'} style={{ fontWeight: 600, borderRadius: 4 }}>
                  {selectedProject.returnedCount} {selectedProject.returnedCount === 1 ? 'time' : 'times'}
                </Tag>
              </Col>
            </Row>
          </div>
        )}

        {selectedProject?.audits && selectedProject.audits.length === 0 ? (
          <Alert message="No historical cost logs found for this project." type="info" showIcon />
        ) : (
          <Timeline mode="left">
            {selectedProject?.audits
              ?.sort((a, b) => dayjs(b.createdAt || b.timestamp).unix() - dayjs(a.createdAt || a.timestamp).unix())
              .map((audit, idx) => {
                const statusVal = audit.newData?.status || audit.status;
                
                // Smart extraction of budget & hours
                let budgetValue = null;
                if (audit.newData?.approvedBudget) budgetValue = Number(audit.newData.approvedBudget);
                else if (audit.newData?.totalBudget) budgetValue = Number(audit.newData.totalBudget);
                else if (Array.isArray(audit.newData?.budgetTable)) {
                  budgetValue = audit.newData.budgetTable.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
                }

                let hoursValue = null;
                if (audit.newData?.approvedHours) hoursValue = audit.newData.approvedHours;
                else if (audit.newData?.totalEstimatedHours) hoursValue = audit.newData.totalEstimatedHours;
                else if (audit.newData?.totalHours) hoursValue = audit.newData.totalHours;

                return (
                  <Timeline.Item 
                    key={audit.id || idx} 
                    color={getTimelineColor(audit.action, statusVal)}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <Space>
                        <Text strong style={{ fontSize: '14px' }}>
                          {getTimelineLabel(audit.action, statusVal)}
                        </Text>
                        <Tag color={getTimelineColor(audit.action, statusVal)}>
                          {audit.action}
                        </Tag>
                      </Space>
                      
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        <ClockCircleOutlined /> {dayjs(audit.createdAt || audit.timestamp).format('DD MMM YYYY, hh:mm A')}
                      </Text>
                      
                      {budgetValue !== null && (
                        <div style={{ background: isDarkMode ? '#111827' : '#f8fafc', padding: '8px 12px', borderRadius: 8, marginTop: 4, border: isDarkMode ? '1px solid #1f2937' : '1px solid #f1f5f9' }}>
                          <Row gutter={8}>
                            <Col span={12}>
                              <Text style={{ fontSize: 11, color: isDarkMode ? '#9ca3af' : '#4b5563' }}>Budget Amount:</Text><br/>
                              <Text strong style={{ color: '#10b981' }}>
                                ₹{budgetValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </Text>
                            </Col>
                            {hoursValue !== null && (
                              <Col span={12}>
                                <Text style={{ fontSize: 11, color: isDarkMode ? '#9ca3af' : '#4b5563' }}>Allocated Hours:</Text><br/>
                                <Text strong style={{ color: isDarkMode ? '#f3f4f6' : '#1f2937' }}>{hoursValue} hrs</Text>
                              </Col>
                            )}
                          </Row>
                        </div>
                      )}

                      {audit.newData?.comments && (
                        <Text style={{ fontSize: '13px', fontStyle: 'italic', color: isDarkMode ? '#d1d5db' : '#475569', marginTop: 4 }}>
                          "{audit.newData.comments}"
                        </Text>
                      )}
                    </div>
                  </Timeline.Item>
                );
              })}
          </Timeline>
        )}
      </Modal>
    </div>
  );
};

export default CostHistoryPage;
