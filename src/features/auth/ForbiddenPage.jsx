import React from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const ForbiddenPage = () => {
  const navigate = useNavigate();
  const { role } = useAuthStore();

  console.log('Forbidden Page Rendered', { role, path: window.location.pathname });

  const handleGoHome = () => {
    switch (role) {
      case 'SuperAdmin': navigate('/superadmin/tenants'); break;
      case 'TenantAdmin': navigate('/admin/users'); break;
      case 'Sales': navigate('/sales/projects'); break;
      case 'Accounts': navigate('/accounts/pending'); break;
      case 'TeamLead': navigate('/teamlead/projects'); break;
      case 'Employee': navigate('/employee/tickets'); break;
      case 'ProjectManager': navigate('/pm/dashboard'); break;
      default: navigate('/login');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Result
        status="403"
        title="403"
        subTitle={`Sorry, your role (${role}) does not have permission to view this page.`}
        extra={<Button type="primary" onClick={handleGoHome}>Go to My Dashboard</Button>}
      />
    </div>
  );
};

export default ForbiddenPage;
