import React from 'react';
import { Tag } from 'antd';
import { 
  AlertOutlined, 
  ArrowUpOutlined, 
  ArrowRightOutlined, 
  ArrowDownOutlined 
} from '@ant-design/icons';
import PropTypes from 'prop-types';

const priorityConfig = {
  Critical: { color: 'red', icon: <AlertOutlined /> },
  High: { color: 'volcano', icon: <ArrowUpOutlined /> },
  Medium: { color: 'blue', icon: <ArrowRightOutlined /> },
  Low: { color: 'green', icon: <ArrowDownOutlined /> }
};

const PriorityBadge = ({ priority }) => {
  const config = priorityConfig[priority] || priorityConfig.Medium;
  
  return (
    <Tag color={config.color} icon={config.icon}>
      {priority}
    </Tag>
  );
};

PriorityBadge.propTypes = {
  priority: PropTypes.string.isRequired
};

export default PriorityBadge;
