import React from 'react';
import { Empty, Button } from 'antd';
import PropTypes from 'prop-types';

const EmptyState = ({ message, actionText, onAction }) => {
  return (
    <Empty
      description={message}
      style={{ margin: '40px 0' }}
    >
      {actionText && onAction && (
        <Button type="primary" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </Empty>
  );
};

EmptyState.propTypes = {
  message: PropTypes.string.isRequired,
  actionText: PropTypes.string,
  onAction: PropTypes.func
};

export default EmptyState;
