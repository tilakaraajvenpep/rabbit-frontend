import React from 'react';
import { Breadcrumb, Typography, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';

const { Title, Text } = Typography;

const PageHeader = ({ title, subTitle, breadcrumbs, extra }) => {
  const navigate = useNavigate();

  return (
    <div style={{ marginBottom: 24 }}>
      {breadcrumbs && (
        <Breadcrumb style={{ marginBottom: 8 }}>
          {breadcrumbs.map((item, index) => (
            <Breadcrumb.Item
              key={index}
              onClick={() => item.path && navigate(item.path)}
              style={{ cursor: item.path ? 'pointer' : 'default' }}
            >
              {item.label}
            </Breadcrumb.Item>
          ))}
        </Breadcrumb>
      )}
      <div className="page-header-row">
        <div>
          <Title level={3} style={{ margin: 0 }}>{title}</Title>
          {subTitle && (
            <Text type="secondary" style={{ fontSize: 13, marginTop: 2, display: 'block' }}>
              {subTitle}
            </Text>
          )}
        </div>
        {extra && <Space wrap>{extra}</Space>}
      </div>
    </div>
  );
};

PageHeader.propTypes = {
  title: PropTypes.string.isRequired,
  subTitle: PropTypes.string,
  breadcrumbs: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    path: PropTypes.string
  })),
  extra: PropTypes.node
};

export default PageHeader;
