import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Space, Button, Modal, Timeline, Tag, Statistic, Row, Col, Alert, Tooltip, Skeleton } from 'antd';
import { DollarOutlined, ClockCircleOutlined, HistoryOutlined, ProjectOutlined, ArrowLeftOutlined, EyeOutlined, SyncOutlined } from '@ant-design/icons';
import { projectService } from '../../services/projectService';
import PageHeader from '../../components/common/PageHeader';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

const CostHistoryPage = () => {
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

    // 3. Final approved budget: fallback to budgetTable sum if approvedBudget is 0 or null
    let finalBudget = Number(project.approvedBudget || 0);
    if (finalBudget === 0 && Array.isArray(project.budgetTable)) {
      finalBudget = project.budgetTable.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
    }

    return {
      ...project,
      analyzedCount,
      returnedCount,
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
      title: 'Budget Analyzed',
      dataIndex: 'analyzedCount',
      key: 'analyzedCount',
      sorter: (a, b) => a.analyzedCount - b.analyzedCount,
      render: (count) => (
        <Tag color={count > 0 ? 'blue' : 'default'} style={{ borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>
          {count} {count === 1 ? 'time' : 'times'}
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
      title: 'Final Budget',
      dataIndex: 'finalBudget',
      key: 'finalBudget',
      sorter: (a, b) => Number(a.finalBudget) - Number(b.finalBudget),
      render: (val) => (
        <Text strong style={{ color: '#059669', fontSize: '15px' }}>
          ₹{Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
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
                  title="Total Budget Actions" 
                  value={auditLogs.filter(l => l.action?.includes('COST') || (l.action === 'UPDATE_PROJECT_STATUS' && (l.newData?.status === 'PendingPMApproval' || l.newData?.status === 'Approved'))).length} 
                  prefix={<DollarOutlined style={{ color: '#2563eb' }} />} 
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <Statistic 
                  title="Revision Returns" 
                  value={auditLogs.filter(l => {
                    const status = l.newData?.status || l.status;
                    return l.action === 'UPDATE_PROJECT_STATUS' && (status === 'ReturnedForRevision' || status === 'ReturnedToAccounts');
                  }).length} 
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
        {selectedProject?.audits && selectedProject.audits.length === 0 ? (
          <Alert message="No historical cost logs found for this project." type="info" showIcon />
        ) : (
          <Timeline mode="left">
            {selectedProject?.audits
              .sort((a, b) => dayjs(b.createdAt || b.timestamp).unix() - dayjs(a.createdAt || a.timestamp).unix())
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
                        <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 8, marginTop: 4, border: '1px solid #f1f5f9' }}>
                          <Row gutter={8}>
                            <Col span={12}>
                              <Text type="secondary" style={{ fontSize: 11 }}>Budget Amount:</Text><br/>
                              <Text strong style={{ color: '#059669' }}>
                                ₹{budgetValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </Text>
                            </Col>
                            {hoursValue !== null && (
                              <Col span={12}>
                                <Text type="secondary" style={{ fontSize: 11 }}>Allocated Hours:</Text><br/>
                                <Text strong>{hoursValue} hrs</Text>
                              </Col>
                            )}
                          </Row>
                        </div>
                      )}

                      {audit.newData?.comments && (
                        <Text style={{ fontSize: '13px', fontStyle: 'italic', color: '#475569', marginTop: 4 }}>
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
