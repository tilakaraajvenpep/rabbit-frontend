import React from 'react';
import { Spin, Typography } from 'antd';

const { Text } = Typography;

const LoadingScreen = () => {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      gap: 16
    }}>
      <Spin size="large" />
      <Text strong style={{ color: '#1890ff', fontSize: '18px' }}>Rabbit 4.0</Text>
    </div>
  );
};

export default LoadingScreen;
