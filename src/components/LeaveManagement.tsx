import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Check, X, AlertCircle, Clock, ShieldCheck, UserCheck, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LeaveApplication } from '../types';

interface LeaveManagementProps {
  userRole: 'user' | 'admin';
  currentUserCode: string;
  currentUserName: string;
}

export default function LeaveManagement({ userRole, currentUserCode, currentUserName }: LeaveManagementProps) {
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  
  // Apply Leave form states
  const [empCode, setEmpCode] = useState(currentUserCode || '');
  const [empName, setEmpName] = useState(currentUserName || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [approverId, setApproverId] = useState('admin');

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showApplyForm, setShowApplyForm] = useState(false);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/leaves');
      const data = await response.json();
      if (response.ok) {
        // Sort leaves: pending first, then newest
        const sorted = data.sort((a: LeaveApplication, b: LeaveApplication) => {
          if (a.status === 'Pending' && b.status !== 'Pending') return -1;
          if (a.status !== 'Pending' && b.status === 'Pending') return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setLeaves(sorted);
      }
    } catch (err) {
      console.error('Error fetching leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empCode || !empName || !startDate || !endDate || !reason) {
      setMessage({ type: 'error', text: 'All fields are required.' });
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setMessage({ type: 'error', text: 'Start date cannot be after end date.' });
      return;
    }

    setApplying(true);
    setMessage(null);

    try {
      const response = await fetch('/api/leaves/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empCode: empCode.trim(),
          empName: empName.trim(),
          startDate,
          endDate,
          reason: reason.trim(),
          approverId
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Leave request submitted successfully. Awaiting admin approval.' });
        // Reset form
        if (userRole === 'user') {
          // Keep credentials if regular user
          setStartDate('');
          setEndDate('');
          setReason('');
        } else {
          setEmpCode('');
          setEmpName('');
          setStartDate('');
          setEndDate('');
          setReason('');
        }
        setShowApplyForm(false);
        fetchLeaves();
        setTimeout(() => setMessage(null), 4000);
      } else {
        throw new Error(data.error || 'Failed to apply leave.');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setApplying(false);
    }
  };

  const handleActionLeave = async (id: string, action: 'Approved' | 'Rejected') => {
    setMessage(null);
    try {
      const response = await fetch('/api/leaves/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: action,
          approvedBy: currentUserCode
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: `Leave application was successfully ${action.toLowerCase()}.` });
        fetchLeaves();
        setTimeout(() => setMessage(null), 3500);
      } else {
        throw new Error(data.error || 'Failed to update leave request.');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-6" id="leave-management-tab">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Leave Planner & Approvals</h2>
          <p className="text-slate-500 text-sm">Submit leave requests and view administrative actions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLeaves}
            className="p-2 border border-slate-200 rounded-xl bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowApplyForm(!showApplyForm)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm flex items-center space-x-1.5 shadow-md shadow-indigo-100 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Apply Leave</span>
          </button>
        </div>
      </div>

      {/* Message feedback */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`p-4 rounded-xl border flex items-start space-x-2 text-sm ${
              message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {message.type === 'success' ? <Check className="h-5 w-5 text-green-500 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />}
            <span>{message.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Apply Leave Dialog / Drawer */}
      <AnimatePresence>
        {showApplyForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden p-6"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-4">New Leave Application</h3>
            <form onSubmit={handleApplyLeave} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Employee Code / ID
                </label>
                <input
                  type="text"
                  required
                  disabled={userRole === 'user'}
                  value={empCode}
                  onChange={(e) => setEmpCode(e.target.value)}
                  placeholder="e.g. 180044"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Employee Full Name
                </label>
                <input
                  type="text"
                  required
                  disabled={userRole === 'user'}
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  placeholder="e.g. Aadilhusain Luhar"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  End Date (Inclusive)
                </label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Reason for Leave
                </label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="State the reason clearly..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="md:col-span-2 flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApplyForm(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={applying}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {applying ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leaves Log */}
      <div className="bg-white border border-slate-100 shadow-sm rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">Leaves Audit Log</h3>
          <p className="text-slate-500 text-sm mt-0.5">Track active and pending leave records for operators and leaders</p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-4"></div>
            <p className="text-sm">Fetching leave logs...</p>
          </div>
        ) : leaves.length === 0 ? (
          <div className="p-12 text-center text-slate-400 max-w-sm mx-auto space-y-3">
            <Calendar className="h-12 w-12 text-slate-300 mx-auto" />
            <h4 className="font-bold text-slate-900">No Leave Entries</h4>
            <p className="text-sm text-slate-500">There are no leave applications recorded in the system.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-600">
                  <th className="p-4">Employee</th>
                  <th className="p-4">Duration</th>
                  <th className="p-4">Reason</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaves.map((leave) => {
                  let statusBadge = 'bg-amber-50 text-amber-800 border-amber-100';
                  if (leave.status === 'Approved') statusBadge = 'bg-green-50 text-green-800 border-green-100';
                  else if (leave.status === 'Rejected') statusBadge = 'bg-red-50 text-red-800 border-red-100';

                  return (
                    <tr key={leave.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-slate-900 text-sm">{leave.empName}</div>
                        <div className="text-xs text-slate-500 font-mono">ID: {leave.empCode}</div>
                      </td>
                      <td className="p-4 text-sm text-slate-700">
                        <div className="font-medium">{leave.startDate} to {leave.endDate}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          <span>Applied {new Date(leave.createdAt).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-slate-600 max-w-xs truncate" title={leave.reason}>
                        {leave.reason}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadge}`}>
                          {leave.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {leave.status === 'Pending' ? (
                          userRole === 'admin' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleActionLeave(leave.id, 'Approved')}
                                className="p-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg cursor-pointer transition-colors"
                                title="Approve Request"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleActionLeave(leave.id, 'Rejected')}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg cursor-pointer transition-colors"
                                title="Reject Request"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">Awaiting Admin Action</span>
                          )
                        ) : (
                          <div className="text-xs text-slate-400">
                            {leave.status === 'Approved' ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <div className="flex items-center gap-1 text-green-600 font-semibold">
                                  <ShieldCheck className="h-4 w-4" />
                                  <span>Approved</span>
                                </div>
                                {leave.approvedBy && (
                                  <span className="text-[10px] text-slate-500 font-mono">By ID: {leave.approvedBy}</span>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-red-500 font-semibold">Rejected</span>
                                {leave.approvedBy && (
                                  <span className="text-[10px] text-slate-500 font-mono">By ID: {leave.approvedBy}</span>
                                )}
                              </div>
                            )}
                          </div>
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
