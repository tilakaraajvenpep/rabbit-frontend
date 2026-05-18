import React from 'react';
import { PageHeader as AntPageHeader } from '@ant-design/pro-layout'; // Using ProLayout for a better PageHeader experience or custom
import { Breadcrumb, Typography, Space, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';

const { Title } = Typography;

const PageHeader = ({ title, breadcrumbs, extra }) => {
  const navigate = useNavigate();

  return (
    <div style={{ marginBottom: 24 }}>
      {breadcrumbs && (
        <Breadcrumb style={{ marginBottom: 8 }}>
          {breadcrumbs.map((item, index) => (
            <Breadcrumb.Item key={index} onClick={() => item.path && navigate(item.path)} style={{ cursor: item.path ? 'pointer' : 'default' }}>
              {item.label}
            </Breadcrumb.Item>
          ))}
        </Breadcrumb>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>{title}</Title>
        <Space>{extra}</Space>
      </div>
    </div>
  );
};

PageHeader.propTypes = {
  title: PropTypes.string.isRequired,
  breadcrumbs: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    path: PropTypes.string
  })),
  extra: PropTypes.node
};

export default PageHeader;
