// src/App.jsx
import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Login from './views/Login';

import StaffDashboard from './views/staff/StaffDashboard';
import StaffOrders from './views/staff/StaffOrders';
import StaffReturns from './views/staff/StaffReturns';
import StaffMyPerformance from './views/staff/StaffMyPerformance';

// Manager Views
import ManagerDashboard from './views/manager/ManagerDashboard';
import ProductManagement from './views/manager/ProductManagement';
import StaffManagement from './views/manager/StaffManagement';
import StaffPerformanceAnalysis from './views/manager/StaffPerformanceAnalysis';
import ManagerOrders from './views/manager/ManagerOrders';

function MainApp() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [drilldownStaffId, setDrilldownStaffId] = useState(null);

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

  const isManager = user.role === 'brand_manager';

  const viewTitles = {
    'dashboard': isManager ? 'Brand Manager Dashboard' : 'Sales Staff Dashboard',
    'products': 'Product Management & Incentives',
    'staff': 'Sales Staff Management',
    'orders': isManager ? 'All Staff Orders' : 'My Orders',
    'returns': isManager ? 'All Returns Audit' : 'Order Returns',
    'my-performance': 'Personal Performance & Incentive Audit',
    'staff-performance': 'Staff Performance Analysis'
  };

  function renderView() {
    if (isManager) {
      switch (currentView) {
        case 'dashboard':
          return (
            <ManagerDashboard
              onNavigateToStaffPerformance={() => setCurrentView('staff-performance')}
            />
          );
        case 'products':
          return <ProductManagement />;
        case 'staff':
          return (
            <StaffManagement
              onSelectStaffForPerformance={(sId) => {
                setDrilldownStaffId(sId);
                setCurrentView('staff-performance');
              }}
            />
          );
        case 'orders':
          return <ManagerOrders />;
        case 'returns':
          return <StaffReturns />;
        case 'staff-performance':
          return <StaffPerformanceAnalysis initialStaffId={drilldownStaffId} />;
        default:
          return <ManagerDashboard />;
      }
    } else {
      // Sales Staff
      switch (currentView) {
        case 'dashboard':
          return <StaffDashboard />;
        case 'orders':
          return <StaffOrders />;
        case 'returns':
          return <StaffReturns />;
        case 'my-performance':
          return <StaffMyPerformance />;
        default:
          return <StaffDashboard />;
      }
    }
  }

  return (
    <div className="app-container">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      <main className="main-content">
        <Navbar currentViewTitle={viewTitles[currentView] || 'SalesPulse'} />
        {renderView()}
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
