import React from 'react';
import { 
  DashboardOutlined, 
  ProjectOutlined, 
  TeamOutlined, 
  CheckSquareOutlined, 
  FileTextOutlined, 
  BarChartOutlined, 
  BellOutlined, 
  MessageOutlined,
  SettingOutlined,
  GlobalOutlined,
  DollarOutlined,
  CalendarOutlined,
  SwapOutlined,
  ClockCircleOutlined,
  UserDeleteOutlined,
  NodeIndexOutlined
} from '@ant-design/icons';

export const ROLE_FEATURES = {
  SuperAdmin: [
    { key: '/superadmin/tenants', label: 'Tenants' },
    { key: '/superadmin/settings', label: 'Platform Settings' }
  ],
  TenantAdmin: [
    { key: '/admin/users', label: 'Users' },
    { key: '/admin/hours', label: 'Hour Allocation' },
    { key: '/admin/subscription', label: 'Subscription' },
    // Also include ProjectManager features for TenantAdmin
    { key: '/pm/dashboard', label: 'Dashboard' },
    { key: '/pm/board', label: 'Project Board' },
    { key: '/pm/kanban', label: 'My Kanban' },
    { key: '/pm/tickets', label: 'My Tickets' },
    { key: '/pm/backlogs', label: 'Ticket Backlogs' },
    { key: '/pm/report', label: 'Daily Report' },
    { key: '/pm/my-reports', label: 'My EOD Reports' },
    { key: '/pm/analytics', label: 'Scrum Master' },
    { key: '/pm/alerts', label: 'Alerts Feed' },
    { key: '/shared/reports', label: 'Overall Reports' },
    { key: '/pm/employee-reports', label: 'Employee Reports' },
    { key: '/pm/report-access-approvals', label: 'Report Access Approvals' },
    { key: '/pm/leaves', label: 'Leave Approvals' },
    { key: '/pm/timer-requests', label: 'Additional Hours Requests' },
    { key: '/pm/team', label: 'TL & Employees' },
    { key: '/pm/cross-team', label: 'Cross-Team Status' },
    { key: '/pm/org-chart', label: 'Organization Chart' }
  ],
  ProjectManager: [
    { key: '/pm/dashboard', label: 'Dashboard' },
    { key: '/pm/board', label: 'Project Board' },
    { key: '/pm/kanban', label: 'My Kanban' },
    { key: '/pm/tickets', label: 'My Tickets' },
    { key: '/pm/backlogs', label: 'Ticket Backlogs' },
    { key: '/pm/report', label: 'Daily Report' },
    { key: '/pm/my-reports', label: 'My EOD Reports' },
    { key: '/pm/analytics', label: 'Scrum Master' },
    { key: '/pm/alerts', label: 'Alerts Feed' },
    { key: '/shared/reports', label: 'Overall Reports' },
    { key: '/pm/employee-reports', label: 'Employee Reports' },
    { key: '/pm/report-access-approvals', label: 'Report Access Approvals' },
    { key: '/pm/leaves', label: 'Leave Approvals' },
    { key: '/pm/timer-requests', label: 'Additional Hours Requests' },
    { key: '/pm/team', label: 'TL & Employees' },
    { key: '/pm/cross-team', label: 'Cross-Team Status' },
    { key: '/pm/org-chart', label: 'Organization Chart' }
  ],
  Sales: [
    { key: '/sales/projects', label: 'Projects' },
    { key: '/sales/projects/create', label: 'Create Project' },
    { key: '/shared/reports', label: 'Overall Reports' }
  ],
  Accounts: [
    { key: '/accounts/pending', label: 'Pending Review' },
    { key: '/accounts/leaves', label: 'Leave Approvals' },
    { key: '/accounts/cost-history', label: 'Cost Analysis History' },
    { key: '/accounts/profit-loss', label: 'Project Profit & Loss' },
    { key: '/accounts/users', label: 'User Management' },
    { key: '/accounts/org-chart', label: 'Organization Chart' },
    { key: '/accounts/standard-cost', label: 'Standard Cost' },
    { key: '/accounts/hours-approval', label: 'Additional Hours Approval' },
    { key: '/accounts/reports', label: 'Work Reports' },
    { key: '/shared/reports', label: 'Overall Reports' }
  ],
  TeamLead: [
    { key: '/teamlead/projects', label: 'My Projects' },
    { key: '/teamlead/team', label: 'My Team' },
    { key: '/teamlead/board', label: 'Project Board' },
    { key: '/teamlead/kanban', label: 'My Kanban' },
    { key: '/teamlead/tickets', label: 'My Tickets' },
    { key: '/teamlead/backlogs', label: 'Ticket Backlogs' },
    { key: '/teamlead/report', label: 'Daily Report' },
    { key: '/teamlead/my-reports', label: 'My EOD Reports' },
    { key: '/teamlead/scrum-master', label: 'Scrum Master' },
    { key: '/teamlead/employee-reports', label: 'Employee Reports' },
    { key: '/teamlead/leaves', label: 'Leave Approvals' },
    { key: '/teamlead/report-access-approvals', label: 'Report Access Approvals' },
    { key: '/teamlead/timer-requests', label: 'Additional Hours Requests' },
    { key: '/teamlead/cross-share', label: 'Cross-Team Share' },
    { key: '/teamlead/org-chart', label: 'Organization Chart' }
  ],
  Employee: [
    { key: '/employee/tickets', label: 'My Tickets' },
    { key: '/employee/kanban', label: 'Kanban Board' },
    { key: '/employee/backlogs', label: 'Ticket Backlogs' },
    { key: '/employee/report', label: 'Daily Report' },
    { key: '/employee/my-reports', label: 'My EOD Reports' },
    { key: '/employee/reports', label: 'Work Reports' },
    { key: '/employee/scrum-master', label: 'Scrum Master' }
  ],
  HR: [
    { key: '/hr/board', label: 'Project Board' },
    { key: '/hr/team', label: 'Team Details' },
    { key: '/hr/approve-leaves', label: 'Approve Leaves & Perms' },
    { key: '/hr/view-leaves', label: 'View Leaves & Perms' },
    { key: '/hr/report-access-approvals', label: 'Report Access Approvals' },
    { key: '/hr/projects', label: 'Project Allocations' },
    { key: '/missing-tasks', label: 'Missing Tasks' },
    { key: '/hr/reports', label: 'Work Reports' },
    { key: '/hr/org-chart', label: 'Organization Chart' },
    { key: '/hr/offboarding', label: 'Offboarding' }
  ]
};

export const COMMON_FEATURES = [
  { key: '/chatbot', label: 'Rabbit Assistant' }
];

export const FEATURE_ICONS = {
  '/superadmin/tenants': <GlobalOutlined />,
  '/superadmin/settings': <SettingOutlined />,
  '/admin/users': <TeamOutlined />,
  '/admin/hours': <DollarOutlined />,
  '/admin/subscription': <SettingOutlined />,
  '/pm/dashboard': <DashboardOutlined />,
  '/pm/board': <CheckSquareOutlined />,
  '/pm/kanban': <DashboardOutlined />,
  '/pm/tickets': <CheckSquareOutlined />,
  '/pm/backlogs': <ClockCircleOutlined />,
  '/pm/report': <FileTextOutlined />,
  '/pm/my-reports': <FileTextOutlined />,
  '/pm/analytics': <TeamOutlined />,
  '/pm/alerts': <BellOutlined />,
  '/shared/reports': <FileTextOutlined />,
  '/pm/employee-reports': <BarChartOutlined />,
  '/pm/report-access-approvals': <CalendarOutlined />,
  '/pm/leaves': <CalendarOutlined />,
  '/pm/timer-requests': <ClockCircleOutlined />,
  '/pm/team': <TeamOutlined />,
  '/pm/cross-team': <SwapOutlined />,
  '/pm/org-chart': <NodeIndexOutlined />,
  '/sales/projects': <ProjectOutlined />,
  '/sales/projects/create': <FileTextOutlined />,
  '/accounts/pending': <CheckSquareOutlined />,
  '/accounts/leaves': <CalendarOutlined />,
  '/accounts/cost-history': <DollarOutlined />,
  '/accounts/profit-loss': <BarChartOutlined />,
  '/accounts/users': <TeamOutlined />,
  '/accounts/org-chart': <NodeIndexOutlined />,
  '/accounts/standard-cost': <DollarOutlined />,
  '/accounts/hours-approval': <ClockCircleOutlined />,
  '/accounts/reports': <BarChartOutlined />,
  '/teamlead/projects': <ProjectOutlined />,
  '/teamlead/team': <TeamOutlined />,
  '/teamlead/board': <DashboardOutlined />,
  '/teamlead/kanban': <DashboardOutlined />,
  '/teamlead/tickets': <CheckSquareOutlined />,
  '/teamlead/backlogs': <ClockCircleOutlined />,
  '/teamlead/report': <FileTextOutlined />,
  '/teamlead/my-reports': <FileTextOutlined />,
  '/teamlead/scrum-master': <TeamOutlined />,
  '/teamlead/employee-reports': <BarChartOutlined />,
  '/teamlead/leaves': <CalendarOutlined />,
  '/teamlead/report-access-approvals': <CalendarOutlined />,
  '/teamlead/timer-requests': <ClockCircleOutlined />,
  '/teamlead/cross-share': <SwapOutlined />,
  '/teamlead/org-chart': <NodeIndexOutlined />,
  '/employee/tickets': <CheckSquareOutlined />,
  '/employee/kanban': <DashboardOutlined />,
  '/employee/backlogs': <ClockCircleOutlined />,
  '/employee/report': <FileTextOutlined />,
  '/employee/my-reports': <FileTextOutlined />,
  '/employee/reports': <BarChartOutlined />,
  '/employee/scrum-master': <TeamOutlined />,
  '/hr/board': <CheckSquareOutlined />,
  '/hr/team': <TeamOutlined />,
  '/hr/approve-leaves': <CalendarOutlined />,
  '/hr/view-leaves': <CalendarOutlined />,
  '/hr/report-access-approvals': <CalendarOutlined />,
  '/hr/projects': <ProjectOutlined />,
  '/missing-tasks': <ClockCircleOutlined />,
  '/hr/reports': <BarChartOutlined />,
  '/hr/org-chart': <NodeIndexOutlined />,
  '/hr/offboarding': <UserDeleteOutlined />,
  '/chatbot': <MessageOutlined />
};

export function getFeaturesForRoles(roles) {
  const rolesArray = typeof roles === 'string'
    ? roles.split(',').map(r => r.trim()).filter(Boolean)
    : (Array.isArray(roles) ? roles : [roles]);

  const features = [];
  rolesArray.forEach(role => {
    if (ROLE_FEATURES[role]) {
      features.push(...ROLE_FEATURES[role]);
    }
  });
  features.push(...COMMON_FEATURES);

  // Deduplicate by key
  const seen = new Set();
  return features.filter(f => {
    if (seen.has(f.key)) return false;
    seen.add(f.key);
    return true;
  });
}
