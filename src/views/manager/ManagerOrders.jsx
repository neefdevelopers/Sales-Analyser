// src/views/manager/ManagerOrders.jsx
import React from 'react';
import StaffOrders from '../staff/StaffOrders';

/**
 * ManagerOrders delegates to the unified, simplified Orders module,
 * where Brand Managers can view all staff orders, filter by staff/product/method/dates,
 * and click orders to audit complete information and snapshotted incentives.
 */
export default function ManagerOrders() {
  return <StaffOrders />;
}
