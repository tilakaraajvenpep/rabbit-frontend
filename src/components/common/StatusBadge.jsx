import React from 'react';
import { Tag } from 'antd';
import PropTypes from 'prop-types';

const statusColorMap = {
  PendingReview: 'orange',
  Approved: 'green',
  InProgress: 'blue',
  OnHold: 'red',
  Deployed: 'purple',
  Cancelled: 'default',
  ReturnedForRevision: 'volcano',
  Done: 'success',
  ToDo: 'processing',
  InReview: 'warning'
};

const StatusBadge = ({ status }) => {
  return (
    <Tag color={statusColorMap[status] || 'default'}>
      {status.replace(/([A-Z])/g, ' $1').trim()}
    </Tag>
  );
};

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired
};

export default StatusBadge;
