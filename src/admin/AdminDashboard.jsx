import React from 'react';
import BasicStats from './BasicStats';
import GiftList from './GiftList';
import PoolStatus from './PoolStatus';
import SystemHealth from './SystemHealth';

function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-space-gradient-start via-space-gradient-end to-space-bg text-space-secondary p-8">
      <header className="flex flex-col items-center mb-8">
        <span className="text-3xl font-display font-bold text-space-primary drop-shadow-lg mb-2">
          SendMoon Admin Dashboard
        </span>
        <span className="text-space-secondary text-lg opacity-60">Internal: Manage gifts, pools, and system health</span>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <BasicStats />
          <PoolStatus />
        </div>
        <div>
          <SystemHealth />
        </div>
      </div>
      <div className="mt-10">
        <GiftList />
      </div>
    </div>
  );
}

export default AdminDashboard;
