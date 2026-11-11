import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './views/Login';

// Staff Views
import StaffOrders from './views/staff/StaffOrders';
import StaffReturns from './views/staff/StaffReturns';
import StaffMyRecords from './views/staff/StaffMyRecords';

// Manager Views
import ProductManagement from './views/manager/ProductManagement';
import StaffManagement from './views/manager/StaffManagement';
import ManagerOrders from './views/manager/ManagerOrders';
import IncentiveRecords from './views/manager/IncentiveRecords';
import SalesReports from './views/manager/SalesReports';

function MainApp() {
  const { user, loading } = useAuth();
  const isManager = user?.role === 'brand_manager';
  const [currentView, setCurrentView] = useState(isManager ? 'reports' : 'my-records');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Keep view synchronized with active role
  useEffect(() => {
    if (user) {
      if (user.role === 'brand_manager') {
        if (!['reports', 'incentives', 'products', 'staff'].includes(currentView)) {
          setCurrentView('reports');
        }
      } else {
        if (!['my-records'].includes(currentView)) {
          setCurrentView('my-records');
        }
      }
    }
  }, [user?.role]);

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
    'reports': 'Sales Reports & Dynamic Sheet',
    'incentives': 'Incentive Records & Audit',
    'products': 'Product Management & Incentives',
    'staff': 'Sales Staff Management',
    'my-records': 'My Sales Report & Sheet'
  };

  function renderView() {
    if (isManager) {
      switch (currentView) {
        case 'reports':
          return <SalesReports />;
        case 'incentives':
          return <IncentiveRecords />;
        case 'products':
          return <ProductManagement />;
        case 'staff':
          return <StaffManagement />;
        default:
          return <SalesReports />;
      }
    } else {
      // Sales Staff
      switch (currentView) {
        case 'my-records':
          return <StaffMyRecords />;
        default:
          return <StaffMyRecords />;
      }
    }
  }

  return (
    <div className="app-container">
      <Sidebar
        currentView={currentView}
        setCurrentView={(view) => {
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
