import React, { useState, useEffect } from 'react';
import { UserMinus, Calendar, ArrowRight, ShieldAlert, CheckCircle, Clock, Search, AlertCircle, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { DashboardAbsentee } from '../types';

interface DashboardProps {
  userRole: 'user' | 'admin';
  selectedMonth: string;
  onNavigateToTab: (tab: string) => void;
}

export default function Dashboard({ userRole, selectedMonth, onNavigateToTab }: DashboardProps) {
  const [absentees, setAbsentees] = useState<DashboardAbsentee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/dashboard/stats?date=${selectedDate}`);
      const data = await response.json();
      if (response.ok) {
        setAbsentees(data.absentees || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [selectedDate]);

  const filteredAbsentees = absentees.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.empCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group by consecutive day counts
  const threePlusDays = filteredAbsentees.filter(item => item.consecutiveDays >= 3);
  const twoDays = filteredAbsentees.filter(item => item.consecutiveDays === 2);
  const oneDay = filteredAbsentees.filter(item => item.consecutiveDays === 1);

  const getFirstName = (fullName: string) => {
    return fullName.split(' ')[0] || fullName;
  };

  return (
    <div className="space-y-8" id="dashboard-tab">
      {/* Header section with Date selection */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">System Dashboard</h2>
          <p className="text-slate-500 text-sm">Actionable attendance insights & tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-slate-700">Reference Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <button
            onClick={fetchStats}
            title="Refresh stats"
            className="p-2 border border-slate-200 rounded-xl bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <UserMinus className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Critical Absentees (3+ days)</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
              {absentees.filter(a => a.consecutiveDays >= 3).length}
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Warning Absentees (2 days)</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
              {absentees.filter(a => a.consecutiveDays === 2).length}
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-xl">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Approved Leave Today</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
              {absentees.filter(a => a.leaveStatus === 'Approved').length}
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Pending Leave Today</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
              {absentees.filter(a => a.leaveStatus === 'Pending').length}
            </h3>
          </div>
        </div>
      </div>

      {/* Actionable Absentee Tracker */}
      <div className="bg-white border border-slate-100 shadow-sm rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Consecutive Absentee action list</h3>
            <p className="text-slate-500 text-sm mt-0.5">Identify employees who haven't come. Take action or verify excused leave approvals.</p>
          </div>
          <div className="relative max-w-sm w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search by ID or Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-4"></div>
            <p className="text-sm">Recalculating consecutive absentee schedules...</p>
          </div>
        ) : filteredAbsentees.length === 0 ? (
          <div className="p-12 text-center text-slate-500 max-w-md mx-auto">
            <CheckCircle className="h-12 w-12 text-indigo-500 mx-auto mb-4" />
            <h4 className="font-bold text-slate-900">Perfect Attendance Record!</h4>
            <p className="text-sm text-slate-500 mt-1">There are no consecutive absent employees found for the reference date.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Employee</th>
                  <th className="p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Absence Severity</th>
                  <th className="p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Leave Status</th>
                  <th className="p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Leave Info / Reason</th>
                  <th className="p-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAbsentees
                  .sort((a, b) => b.consecutiveDays - a.consecutiveDays)
                  .map((item) => {
                    let severityBadge = '';
                    if (item.consecutiveDays >= 3) {
                      severityBadge = 'bg-red-50 text-red-700 border-red-100 font-bold';
                    } else if (item.consecutiveDays === 2) {
                      severityBadge = 'bg-amber-50 text-amber-700 border-amber-100 font-bold';
                    } else {
                      severityBadge = 'bg-slate-50 text-slate-600 border-slate-100';
                    }

                    return (
                      <tr key={item.empCode} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center space-x-3">
                            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-xs">
                              {getFirstName(item.name).substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-900 block text-sm">{item.name}</span>
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">ID: {item.empCode}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs border ${severityBadge}`}>
                            {item.consecutiveDays} {item.consecutiveDays === 1 ? 'Day' : 'Days'} Consecutive
                          </span>
                        </td>
                        <td className="p-4">
                          {item.leaveStatus === 'Approved' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-100 px-2.5 py-1 rounded-lg">
                              <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                              <span>Excused (Approved)</span>
                            </span>
                          ) : item.leaveStatus === 'Pending' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg">
                              <Clock className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
                              <span>Pending Approval</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-100 px-2.5 py-1 rounded-lg">
                              <ShieldAlert className="h-3.5 w-3.5 text-red-500 animate-pulse" />
                              <span>Unexcused Absence</span>
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          {item.leaveInfo ? (
                            <div className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-100/50 px-2.5 py-1.5 rounded-lg max-w-xs">
                              <Calendar className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                              <span className="truncate" title={item.leaveInfo}>{item.leaveInfo}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 font-mono">—</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {item.leaveStatus === 'Pending' && userRole === 'admin' ? (
                            <button
                              onClick={() => onNavigateToTab('leaves')}
                              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-3 py-1.5 rounded-xl cursor-pointer transition-colors"
                            >
                              <span>Review Leave</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => onNavigateToTab('leaves')}
                              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-150 hover:border-indigo-100 px-3 py-1.5 rounded-xl cursor-pointer transition-colors"
                            >
                              <span>View Leaves</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
