import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './views/Login';

// Brand Manager Views
import ManagerDashboard from './views/manager/ManagerDashboard';
import EmployeeManagement from './views/manager/EmployeeManagement';
import ImportExcel from './views/manager/ImportExcel';
import EmployeeReports from './views/manager/EmployeeReports';
import ImportHistory from './views/manager/ImportHistory';

// Sales Staff Views
import StaffSalesReport from './views/staff/StaffSalesReport';

function MainApp() {
  const { user, loading } = useAuth();
  const isManager = user?.role === 'brand_manager';
  const [currentView, setCurrentView] = useState(isManager ? 'dashboard' : 'my-sales-report');
  const [navParams, setNavParams] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Keep view synchronized with active role
  useEffect(() => {
    if (user) {
      if (user.role === 'brand_manager') {
        if (!['dashboard', 'employee-management', 'import-excel', 'employee-reports', 'import-history'].includes(currentView)) {
          setCurrentView('dashboard');
          setNavParams({});
        }
      } else {
        if (currentView !== 'my-sales-report') {
          setCurrentView('my-sales-report');
          setNavParams({});
        }
      }
    }
  }, [user?.role]);

  function handleNavigate(viewId, params = {}) {
    setNavParams(params || {});
    setCurrentView(viewId);
    setSidebarOpen(false);
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary-600)' }}>SalesPulse</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Loading workspace...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const viewTitles = {
    'dashboard': 'Dashboard & Sales Summary',
    'employee-management': 'Employee Management',
    'import-excel': 'Import Monthly Excel Report',
    'employee-reports': 'Employee Sales Reports',
    'import-history': 'Excel Import History',
    'my-sales-report': 'Sales Report'
  };

  function renderView() {
    if (isManager) {
      switch (currentView) {
        case 'dashboard':
          return <ManagerDashboard onNavigate={handleNavigate} />;
        case 'employee-management':
          return <EmployeeManagement navParams={navParams} onNavigate={handleNavigate} />;
        case 'import-excel':
          return <ImportExcel onNavigate={handleNavigate} />;
        case 'employee-reports':
          return <EmployeeReports initialMonth={navParams?.month} onNavigate={handleNavigate} />;
        case 'import-history':
          return <ImportHistory onNavigate={handleNavigate} />;
        default:
          return <ManagerDashboard onNavigate={handleNavigate} />;
      }
    } else {
      // Sales Staff - Direct to Sales Report
      return <StaffSalesReport initialMonth={navParams?.month} />;
    }
  }

  return (
    <div className="app-container">
      <Sidebar
        currentView={currentView}
        setCurrentView={(view) => {
          setNavParams({});
          setCurrentView(view);
          setSidebarOpen(false);
        }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="main-content">
        <Navbar
          currentViewTitle={viewTitles[currentView] || 'SalesPulse'}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        />
        <ErrorBoundary key={`${currentView}_${user?.id || 'anon'}`}>
          {renderView()}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
