import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import AppShell from './components/layout/AppShell';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoadingScreen from './components/common/LoadingScreen';
import EmployeeReportsPage from './features/employee/EmployeeReportsPage';
import { useThemeStore } from './store/themeStore';


// Lazy load features
const LoginPage = React.lazy(() => import('./features/auth/LoginPage'));
const TenantNotFound = React.lazy(() => import('./features/auth/TenantNotFound'));
const ForbiddenPage = React.lazy(() => import('./features/auth/ForbiddenPage'));

// SuperAdmin
const TenantListPage = React.lazy(() => import('./features/superadmin/TenantListPage'));
const TenantDetailPage = React.lazy(() => import('./features/superadmin/TenantDetailPage'));

// TenantAdmin
const UserManagementPage = React.lazy(() => import('./features/tenantadmin/UserManagementPage'));
const SubscriptionPage = React.lazy(() => import('./features/tenantadmin/SubscriptionPage'));

// Sales
const ProjectListPage = React.lazy(() => import('./features/sales/ProjectListPage'));
const CreateProjectPage = React.lazy(() => import('./features/sales/CreateProjectPage'));
const ScopeUploadPage = React.lazy(() => import('./features/sales/ScopeUploadPage'));

// Accounts
const PendingReviewPage = React.lazy(() => import('./features/accounts/PendingReviewPage'));
const CostAnalysisPage = React.lazy(() => import('./features/accounts/CostAnalysisPage'));

// Team Lead
const TeamLeadDashboardPage = React.lazy(() => import('./features/teamlead/TeamLeadDashboardPage'));
const ProjectDetailPage = React.lazy(() => import('./features/teamlead/ProjectDetailPage'));
const KanbanBoard = React.lazy(() => import('./features/teamlead/KanbanBoard'));

// Employee
const MyTicketsPage = React.lazy(() => import('./features/employee/MyTicketsPage'));
const EODReportPage = React.lazy(() => import('./features/employee/EODReportPage'));

// PM & Shared
const PMDashboardPage = React.lazy(() => import('./features/pm/PMDashboardPage'));
const AnalyticsPage = React.lazy(() => import('./features/pm/AnalyticsPage'));
const AlertsFeedPage = React.lazy(() => import('./features/pm/AlertsFeedPage'));
const ProjectOverviewPage = React.lazy(() => import('./features/shared/ProjectOverviewPage'));
const OverallReportsPage = React.lazy(() => import('./features/shared/OverallReportsPage'));

// Chatbot
const ChatbotPage = React.lazy(() => import('./features/chatbot/ChatbotPage'));

// Placeholder components for routes (to be implemented in later stages)
const Placeholder = ({ title }) => <div><h1>{title}</h1><p>Stage 1 complete. This feature will be built in the next stage.</p></div>;

const App = () => {
  const { isDarkMode } = useThemeStore();

  return (
    <ConfigProvider theme={{
      algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: {
        colorPrimary: '#1890ff',
        borderRadius: 6,
      },
    }}>
      <BrowserRouter>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/tenant-not-found" element={<TenantNotFound />} />
            <Route path="/forbidden" element={<ForbiddenPage />} />

            {/* Private Routes */}
            <Route element={<AppShell />}>
              <Route path="/" element={<Navigate to="/login" replace />} />

              {/* SuperAdmin Routes */}
              <Route element={<ProtectedRoute allowedRoles={['SuperAdmin']} />}>
                <Route path="/superadmin/tenants" element={<TenantListPage />} />
                <Route path="/superadmin/tenants/:id" element={<TenantDetailPage />} />
                <Route path="/superadmin/settings" element={<Placeholder title="Platform Settings" />} />
              </Route>

              {/* TenantAdmin Routes */}
              <Route element={<ProtectedRoute allowedRoles={['TenantAdmin']} />}>
                <Route path="/admin/users" element={<UserManagementPage />} />
                <Route path="/admin/subscription" element={<SubscriptionPage />} />
              </Route>

              {/* Sales Routes */}
              <Route element={<ProtectedRoute allowedRoles={['Sales']} />}>
                <Route path="/sales/projects" element={<ProjectListPage />} />
                <Route path="/sales/projects/create" element={<CreateProjectPage />} />
                <Route path="/sales/projects/:id/scope" element={<ScopeUploadPage />} />
              </Route>

              {/* Accounts Routes */}
              <Route element={<ProtectedRoute allowedRoles={['Accounts']} />}>
                <Route path="/accounts/pending" element={<PendingReviewPage />} />
                <Route path="/accounts/projects/:id/cost" element={<CostAnalysisPage />} />
              </Route>

              {/* TeamLead Routes */}
              <Route element={<ProtectedRoute allowedRoles={['TeamLead']} />}> 
                <Route path="/teamlead/projects" element={<TeamLeadDashboardPage />} />
                <Route path="/teamlead/projects/:id" element={<ProjectDetailPage />} />
                <Route path="/teamlead/projects/:id/kanban" element={<KanbanBoard />} />
                <Route path="/teamlead/board" element={<Navigate to="/teamlead/projects/p1/kanban" replace />} />
                <Route path="/teamlead/employee-reports" element={<EmployeeReportsPage />} />
              </Route>

              {/* Employee Routes */}
              <Route element={<ProtectedRoute allowedRoles={['Employee']} />}> 
                <Route path="/employee/tickets" element={<MyTicketsPage />} />
                <Route path="/employee/report" element={<EODReportPage />} />
                <Route path="/employee/reports" element={<EmployeeReportsPage />} />
              </Route>

              {/* ProjectManager Routes */}
              <Route element={<ProtectedRoute allowedRoles={['ProjectManager']} />}> 
                <Route path="/pm/dashboard" element={<PMDashboardPage />} />
                <Route path="/pm/projects/:id" element={<ProjectOverviewPage />} />
                <Route path="/pm/projects/:id/kanban" element={<KanbanBoard />} />
                <Route path="/pm/analytics" element={<AnalyticsPage />} />
                <Route path="/pm/analytics/:id" element={<AnalyticsPage />} />
                <Route path="/pm/alerts" element={<AlertsFeedPage />} />
                <Route path="/pm/employee-reports" element={<EmployeeReportsPage />} />
              </Route>

              {/* Shared Project Overview (Accessible to all authenticated) */}
              <Route path="/projects/:id/overview" element={<ProjectOverviewPage />} />

              {/* Shared Reports for Managers */}
              <Route element={<ProtectedRoute allowedRoles={['Accounts', 'Sales', 'ProjectManager']} />}>
                <Route path="/shared/reports" element={<OverallReportsPage />} />
              </Route>

              {/* All Auth Roles */}
              <Route path="/chatbot" element={<ChatbotPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
