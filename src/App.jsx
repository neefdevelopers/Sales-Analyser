// src/App.jsx
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
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

function MainApp() {
  const { user, loading } = useAuth();
  const isManager = user?.role === 'brand_manager';
  const [currentView, setCurrentView] = useState(isManager ? 'products' : 'orders');

  // Keep view synchronized with active role
  useEffect(() => {
    if (user) {
      if (user.role === 'brand_manager') {
        if (!['products', 'staff', 'orders', 'returns', 'incentives'].includes(currentView)) {
          setCurrentView('products');
        }
      } else {
        if (!['orders', 'returns', 'my-records'].includes(currentView)) {
          setCurrentView('orders');
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
    'products': 'Product Management & Incentives',
    'staff': 'Sales Staff Management',
    'orders': isManager ? 'All Staff Orders' : 'My Orders',
    'returns': isManager ? 'All Returns Audit' : 'Order Returns',
    'incentives': 'Incentive Records & Audit',
    'my-records': 'My Records'
  };

  function renderView() {
    if (isManager) {
      switch (currentView) {
        case 'products':
          return <ProductManagement />;
        case 'staff':
          return <StaffManagement />;
        case 'orders':
          return <ManagerOrders />;
        case 'returns':
          return <StaffReturns />;
        case 'incentives':
          return <IncentiveRecords />;
        default:
          return <ProductManagement />;
      }
    } else {
      // Sales Staff
      switch (currentView) {
        case 'orders':
          return <StaffOrders />;
        case 'returns':
          return <StaffReturns />;
        case 'my-records':
          return <StaffMyRecords />;
        default:
          return <StaffOrders />;
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
