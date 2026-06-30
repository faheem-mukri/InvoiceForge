'use client';

import DashboardSidebar from '@/components/layout/DashboardSidebar';
import Topbar from '@/components/ui/Topbar';
import WelcomeTour from '@/components/onboarding/WelcomeTour';

export default function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <DashboardSidebar />

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar />

        <main className="flex-1 overflow-y-auto px-6 py-8">
          {children}
        </main>
      </div>

      {/* First-run product tour (auto-shows once for new accounts) */}
      <WelcomeTour />
    </div>
  );
}