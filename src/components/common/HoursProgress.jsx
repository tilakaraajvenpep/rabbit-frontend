import React from 'react';
import { Progress, Typography, Space } from 'antd';
import PropTypes from 'prop-types';

const { Text } = Typography;

const HoursProgress = ({ consumed, total, unit = 'hrs' }) => {
  const percent = Math.min(Math.round((consumed / total) * 100), 100);
  
  let status = 'normal';
  if (percent >= 90) status = 'exception';
  else if (percent >= 75) status = 'active';

  return (
    <div style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>Progress</Text>
        <Text strong style={{ fontSize: '12px' }}>{consumed} / {total} {unit}</Text>
      </Space>
      <Progress 
        percent={percent} 
        size="small" 
        status={status}
        strokeColor={percent > 100 ? '#f5222d' : undefined}
      />
    </div>
  );
};

HoursProgress.propTypes = {
  consumed: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
  unit: PropTypes.string
};

export default HoursProgress;
