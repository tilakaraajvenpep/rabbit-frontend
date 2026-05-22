import React, { useState, useEffect } from 'react';
import { 
  List, Avatar, Tag, Button, Modal, Input, notification, 
  Tabs, Card, Space, Typography, Tooltip, Empty 
} from 'antd';
import { 
  WarningOutlined, 
  InfoCircleOutlined, 
  CloseCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { analyticsService } from '../../services/analyticsService';
import { useAlertStore } from '../../store/alertStore';
import PageHeader from '../../components/common/PageHeader';

dayjs.extend(relativeTime);
const { TextArea } = Input;
const { Text, Title } = Typography;

const AlertsFeedPage = () => {
  const { alerts, setAlerts, acknowledgeAlert, markAllRead } = useAlertStore();
  const [loading, setLoading] = useState(true);
  const [ackModal, setAckModal] = useState({ open: false, alertId: null, comment: '' });
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await analyticsService.getAlerts();
      setAlerts(res.data);
    } catch (error) {
      console.error('Failed to fetch alerts', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    try {
      await analyticsService.acknowledgeAlert(ackModal.alertId, ackModal.comment);
      acknowledgeAlert(ackModal.alertId, ackModal.comment);
      notification.success({ message: 'Alert Acknowledged' });
      setAckModal({ open: false, alertId: null, comment: '' });
    } catch (error) {
      notification.error({ message: 'Action Failed' });
    }
  };

  const getAlertIcon = (severity) => {
    switch (severity) {
      case 'Critical': return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: '24px' }} />;
      case 'Warning': return <WarningOutlined style={{ color: '#fa8c16', fontSize: '24px' }} />;
      case 'Info': return <InfoCircleOutlined style={{ color: '#1890ff', fontSize: '24px' }} />;
      default: return <InfoCircleOutlined />;
    }
  };

  const getAlertTagColor = (type) => {
    switch (type) {
      case 'Timeline Risk': return 'volcano';
      case 'Budget Risk': return 'red';
      case 'Missing Report': return 'orange';
      case 'Overdue Ticket': return 'magenta';
      default: return 'blue';
    }
  };

  const filteredAlerts = alerts.filter(a => {
    if (a.type === 'Leave Request Alert') return false;
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !a.acknowledged;
    if (activeTab === 'acknowledged') return a.acknowledged;
    return a.severity === activeTab;
  });

  return (
    <div>
      <PageHeader 
        title="Alerts Feed" 
        extra={<Button onClick={markAllRead}>Mark All Read</Button>}
      />

      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        items={[
          { key: 'all', label: 'All' },
          { key: 'unread', label: 'Unread' },
          { key: 'Critical', label: 'Critical' },
          { key: 'Warning', label: 'Warning' },
          { key: 'acknowledged', label: 'Acknowledged' }
        ]}
      />

      <Card style={{ marginTop: 16 }}>
        <List
          loading={loading}
          itemLayout="horizontal"
          dataSource={filteredAlerts}
          renderItem={(item) => (
            <List.Item
              actions={[
                !item.acknowledged ? (
                  <Button type="primary" size="small" onClick={() => setAckModal({ open: true, alertId: item.id, comment: '' })}>
                    Acknowledge
                  </Button>
                ) : (
                  <Tag icon={<CheckCircleOutlined />} color="success">Acknowledged</Tag>
                )
              ]}
            >
              <List.Item.Meta
                avatar={getAlertIcon(item.severity)}
                title={
                  <Space>
                    <Text strong>{item.message}</Text>
                    <Tag color={getAlertTagColor(item.type)}>{item.type}</Tag>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={0}>
                    <Text type="secondary">
                      Project: <Text strong>{item.projectName || 'General / None'}</Text> {item.employeeName && `| Employee: ${item.employeeName}`}
                    </Text>
                    <Tooltip title={dayjs(item.timestamp).format('DD MMM YYYY HH:mm')}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        <ClockCircleOutlined /> {dayjs(item.timestamp).fromNow()}
                      </Text>
                    </Tooltip>
                    {item.acknowledged && (
                      <div style={{ marginTop: 8, padding: '8px 12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '4px' }}>
                        <Text type="success" style={{ fontSize: '12px' }}>
                          <CheckCircleOutlined /> Acknowledged by PM — {dayjs(item.ackAt).format('DD MMM YYYY')}
                          {item.ackComment && <><br />Comment: {item.ackComment}</>}
                        </Text>
                      </div>
                    )}
                  </Space>
                }
              />
            </List.Item>
          )}
          locale={{ emptyText: <Empty description="No alerts in this category" /> }}
        />
      </Card>

      <Modal
        title="Acknowledge Alert"
        open={ackModal.open}
        onOk={handleAcknowledge}
        onCancel={() => setAckModal({ ...ackModal, open: false })}
        okText="Confirm Acknowledge"
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">Adding a comment helps track the resolution or reason for acknowledgment.</Text>
        </div>
        <TextArea 
          rows={4} 
          placeholder="PM Comment (Optional)" 
          value={ackModal.comment}
          onChange={(e) => setAckModal({ ...ackModal, comment: e.target.value })}
        />
      </Modal>
    </div>
  );
};

export default AlertsFeedPage;
