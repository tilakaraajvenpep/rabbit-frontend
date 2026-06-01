import React, { useState, useEffect } from 'react';
import { Card, InputNumber, Button, Space, Typography, notification, Spin, Divider } from 'antd';
import { SaveOutlined, DollarOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { adminService } from '../../services/adminService';
import PageHeader from '../../components/common/PageHeader';

const { Title, Text, Paragraph } = Typography;

const StandardCostPage = () => {
  const [standardCost, setStandardCost] = useState(500);
  const [tempCost, setTempCost] = useState(500);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchStandardCost();
  }, []);

  const fetchStandardCost = async () => {
    setLoading(true);
    try {
      const res = await adminService.getStandardCost();
      const cost = Number(res.data?.standardCost) || 500;
      setStandardCost(cost);
      setTempCost(cost);
    } catch (err) {
      notification.error({
        message: 'Error',
        description: 'Failed to retrieve the standard cost setting.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (tempCost === null || tempCost <= 0) {
      notification.warning({
        message: 'Validation Warning',
        description: 'Please enter a valid standard cost greater than zero.',
      });
      return;
    }

    setSaving(true);
    try {
      await adminService.updateStandardCost(tempCost);
      setStandardCost(tempCost);
      notification.success({
        message: 'Standard Cost Saved',
        description: `Standard cost updated to ₹${tempCost.toLocaleString('en-IN')}/hr successfully.`,
      });
    } catch (err) {
      notification.error({
        message: 'Save Failed',
        description: 'Failed to update the standard cost setting.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" tip="Loading settings..." />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>
      <PageHeader 
        title="Standard Cost Settings"
        subtitle="Manage the base standard hourly rate used for financial estimations and fallback resource calculations."
      />

      <Card
        style={{
          borderRadius: '16px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: '1px solid #f1f5f9',
          padding: '12px'
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
              width: '54px',
              height: '54px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
            }}>
              <DollarOutlined style={{ fontSize: '26px', color: '#ffffff' }} />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: '14px', textTransform: 'uppercase', tracking: '0.05em' }}>Current Setting</Text>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <Title level={2} style={{ margin: 0, color: '#1e293b', fontWeight: 700 }}>
                  ₹{standardCost.toLocaleString('en-IN')}
                </Title>
                <Text type="secondary" style={{ fontSize: '16px' }}>/ hour</Text>
              </div>
            </div>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          <div>
            <Title level={4} style={{ marginBottom: '8px', color: '#334155' }}>Update Standard Cost</Title>
            <Paragraph type="secondary" style={{ marginBottom: '16px' }}>
              Modify the standard internal cost per hour. Changes will immediately reflect in projects that do not have custom developer costs or default hourly estimates.
            </Paragraph>
            
            <Space size="middle" align="center">
              <InputNumber
                value={tempCost}
                onChange={setTempCost}
                min={1}
                formatter={value => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={value => value.replace(/\₹\s?|(,*)/g, '')}
                style={{ 
                  width: '200px', 
                  height: '42px', 
                  display: 'flex', 
                  alignItems: 'center',
                  fontSize: '16px',
                  borderRadius: '8px'
                }}
              />
              <Button 
                type="primary" 
                icon={<SaveOutlined />} 
                onClick={handleSave} 
                loading={saving}
                style={{ 
                  height: '42px', 
                  borderRadius: '8px',
                  padding: '0 24px',
                  background: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)',
                  border: 'none',
                  boxShadow: '0 4px 10px rgba(15, 118, 110, 0.2)'
                }}
              >
                Save Changes
              </Button>
            </Space>
          </div>

          <div style={{ 
            background: '#eff6ff', 
            border: '1px solid #bfdbfe', 
            borderRadius: '12px', 
            padding: '16px', 
            display: 'flex', 
            gap: '12px',
            marginTop: '8px'
          }}>
            <InfoCircleOutlined style={{ color: '#1d4ed8', fontSize: '18px', marginTop: '2px' }} />
            <div>
              <Text strong style={{ color: '#1e3a8a', display: 'block', marginBottom: '4px' }}>Where is standard cost used?</Text>
              <Paragraph style={{ color: '#1e40af', margin: 0, fontSize: '13px' }}>
                1. <strong>Project Budgets:</strong> When importing or creating a project where total hours are not defined, the system automatically derives the hours using: <code>Total Hours = Total Budget / (Standard Cost * 1.10)</code> (incorporating the 10% buffer).<br />
                2. <strong>Financial Forecasts:</strong> Calculates standard P&L cost and margins based on logged hours times this configured standard cost value.
              </Paragraph>
            </div>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default StandardCostPage;
