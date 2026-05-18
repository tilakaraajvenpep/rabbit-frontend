import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Progress, Typography, Skeleton, Table, Tag, Button, Modal, Space } from 'antd';
import { adminService } from '../../services/adminService';
import PageHeader from '../../components/common/PageHeader';

const { Title, Text } = Typography;

const SubscriptionPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await adminService.getSubscription();
      setData(res.data);
    } catch (error) {
      console.error('Failed to load subscription info', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <div>
      <PageHeader title="Subscription & Usage" />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="Current Plan">
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Tag color="gold" style={{ fontSize: '20px', padding: '8px 16px' }}>{data.planName}</Tag>
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">Renews on:</Text> <Text strong>{new Date(data.renewalDate).toLocaleDateString()}</Text>
              </div>
              <Button type="primary" size="large" style={{ marginTop: 24 }} onClick={() => Modal.info({ title: 'Upgrade Plan', content: 'Please contact our sales team to upgrade your plan.' })}>
                Upgrade Plan
              </Button>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card title="Usage Statistics">
            <Row gutter={[24, 24]}>
              <Col span={8} style={{ textAlign: 'center' }}>
                <Progress type="dashboard" percent={(data.activeUsers / data.maxUsers) * 100} format={() => `${data.activeUsers}/${data.maxUsers}`} />
                <div style={{ marginTop: 8 }}><Text strong>Users</Text></div>
              </Col>
              <Col span={8} style={{ textAlign: 'center' }}>
                <Progress type="dashboard" percent={(data.activeProjects / data.maxProjects) * 100} format={() => `${data.activeProjects}/${data.maxProjects}`} />
                <div style={{ marginTop: 8 }}><Text strong>Projects</Text></div>
              </Col>
              <Col span={8} style={{ textAlign: 'center' }}>
                <Progress type="dashboard" percent={(data.storageUsed / data.storageQuota) * 100} format={() => `${data.storageUsed} GB`} />
                <div style={{ marginTop: 8 }}><Text strong>Storage</Text></div>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col span={24}>
          <Card title="Plan Comparison">
            <Table 
              pagination={false}
              dataSource={[
                { key: '1', feature: 'Max Users', free: '5', pro: '50', enterprise: 'Unlimited' },
                { key: '2', feature: 'Max Projects', free: '2', pro: '20', enterprise: 'Unlimited' },
                { key: '3', feature: 'Storage Quota', free: '1 GB', pro: '100 GB', enterprise: '1 TB' },
                { key: '4', feature: 'Role-based Access', free: 'Basic', pro: 'Full', enterprise: 'Custom' },
                { key: '5', feature: 'AI Assistant', free: 'No', pro: 'Yes', enterprise: 'Advanced' }
              ]}
              columns={[
                { title: 'Feature', dataIndex: 'feature', key: 'feature', render: t => <Text strong>{t}</Text> },
                { title: 'Free', dataIndex: 'free', key: 'free' },
                { title: 'Pro (Current)', dataIndex: 'pro', key: 'pro', className: 'highlight-col' },
                { title: 'Enterprise', dataIndex: 'enterprise', key: 'enterprise' }
              ]}
            />
          </Card>
        </Col>
      </Row>

      <style>{`
        .highlight-col {
          background-color: #f0f5ff;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
};

export default SubscriptionPage;
