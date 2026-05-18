import React from 'react';
import { Result, Button } from 'antd';
import { resolveTenant } from '../../utils/tenantResolver';

const TenantNotFound = () => {
  const attemptedTenant = resolveTenant();

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Result
        status="404"
        title="Workspace Not Found"
        subTitle={`The workspace "${attemptedTenant}" does not exist or is inactive.`}
        extra={
          <Button type="primary" onClick={() => window.location.href = 'https://rabbit40.com'}>
            Go to Marketing Site
          </Button>
        }
      />
    </div>
  );
};

export default TenantNotFound;
