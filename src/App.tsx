import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Calendar, LogOut, ShieldCheck, ClipboardCheck, Lock, ChevronRight, Menu, X, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Components
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AttendanceSheet from './components/AttendanceSheet';
import ShiftScheduler from './components/ShiftScheduler';
import LeaveManagement from './components/LeaveManagement';
import UserAccounts from './components/UserAccounts';
import ChangePasswordModal from './components/ChangePasswordModal';
import ExcelSyncCenter from './components/ExcelSyncCenter';

interface LoggedInUser {
  empCode: string;
  name: string;
  role: 'user' | 'admin';
}

export default function App() {
  const [user, setUser] = useState<LoggedInUser | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  // Check if session exists in localStorage
  useEffect(() => {
    const stored = localStorage.getItem('shift_attendance_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {
        localStorage.removeItem('shift_attendance_user');
      }
    }
  }, []);

  const handleLoginSuccess = (loggedInUser: LoggedInUser) => {
    setUser(loggedInUser);
    localStorage.setItem('shift_attendance_user', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('shift_attendance_user');
    setActiveTab('dashboard');
  };

  // If not logged in, render the login page
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const navigationItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, roles: ['user', 'admin'] },
    { id: 'attendance', name: 'Daily Attendance', icon: ClipboardCheck, roles: ['user', 'admin'] },
    { id: 'schedule', name: 'Shift Schedule', icon: Calendar, roles: ['user', 'admin'] },
    { id: 'leaves', name: 'Leave Requests', icon: ShieldCheck, roles: ['user', 'admin'] },
    { id: 'users', name: 'User Credentials', icon: Lock, roles: ['admin'] },
    { id: 'sync', name: 'Excel Sync & Backup', icon: Database, roles: ['admin'] },
  ];

  const allowedNav = navigationItems.filter(item => item.roles.includes(user.role));

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard 
            userRole={user.role} 
            selectedMonth={selectedMonth} 
            onNavigateToTab={(tab) => setActiveTab(tab)} 
          />
        );
      case 'attendance':
        return (
          <AttendanceSheet 
            userRole={user.role} 
            selectedMonth={selectedMonth} 
            onNavigateToTab={(tab) => setActiveTab(tab)} 
          />
        );
      case 'schedule':
        return (
          <ShiftScheduler 
            userRole={user.role} 
            selectedMonth={selectedMonth} 
            onMonthChange={(month) => setSelectedMonth(month)} 
          />
        );
      case 'leaves':
        return (
          <LeaveManagement 
            userRole={user.role} 
            currentUserCode={user.empCode} 
            currentUserName={user.name} 
          />
        );
      case 'users':
        if (user.role !== 'admin') return null;
        return <UserAccounts />;
      case 'sync':
        if (user.role !== 'admin') return null;
        return <ExcelSyncCenter />;
      default:
        return <div className="text-slate-500">Feature under construction</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-white border-r border-slate-150 z-30">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-md shadow-indigo-100">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <span className="font-bold text-slate-900 text-sm tracking-tight font-sans leading-none">
              Shift Portal
            </span>
          </div>
        </div>

        {/* Navigation Menu Links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {allowedNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all group cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
                  <span>{item.name}</span>
                </div>
                {isActive && <ChevronRight className="h-4 w-4 text-white" />}
              </button>
            );
          })}
        </nav>

        {/* User Info & Log out */}
        <div className="p-4 border-t border-slate-100 space-y-2.5 bg-slate-50/40">
          <div className="px-2 mb-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Signed In As</p>
            <p className="text-sm font-bold text-slate-800 truncate mt-0.5">{user.name}</p>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wider mt-1">
              {user.role}
            </span>
          </div>
          <button
            onClick={() => setChangePasswordOpen(true)}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 transition-colors cursor-pointer"
          >
            <Lock className="h-4 w-4 text-slate-400" />
            <span>Change Password</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-sm font-semibold text-red-600 hover:text-red-700 hover:bg-red-50/50 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar overlay Drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/60 z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-50 flex flex-col md:hidden"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">Shift Portal</span>
                <button onClick={() => setSidebarOpen(false)} className="text-slate-500 hover:text-slate-800">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 px-4 py-5 space-y-1">
                {allowedNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                        isActive ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="h-4.5 w-4.5" />
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <div className="px-2 pb-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">User</p>
                  <p className="text-xs font-bold text-slate-800 truncate">{user.name}</p>
                </div>
                <button
                  onClick={() => {
                    setChangePasswordOpen(true);
                    setSidebarOpen(false);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100/50 mb-1 cursor-pointer"
                >
                  <Lock className="h-4 w-4 text-slate-400" />
                  <span>Change Password</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50/50 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-slate-600 hover:text-slate-900 focus:outline-none"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-bold text-slate-900 text-sm">Shift Portal</span>
          <div className="w-8"></div> {/* Spacer to center the logo text */}
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {renderActiveTabContent()}
          </div>
        </main>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal 
        isOpen={changePasswordOpen} 
        onClose={() => setChangePasswordOpen(false)} 
        empCode={user.empCode} 
      />
    </div>
  );
}
