import React, { useState, useEffect } from 'react';
import { Key, UserCheck, ShieldAlert, Check, Plus, Eye, EyeOff, Search, Shield, User, RefreshCw, UserX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserAccount } from '../types';

export default function UserAccounts() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [empCode, setEmpCode] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      if (response.ok) {
        setUsers(data || []);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleTogglePass = (code: string) => {
    setShowPass(prev => ({ ...prev, [code]: !prev[code] }));
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empCode || !name || !password) {
      setMessage({ type: 'error', text: 'All fields are required.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empCode: empCode.trim(),
          name: name.trim(),
          password,
          role
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: `Account for ${name} successfully saved!` });
        setEmpCode('');
        setName('');
        setPassword('');
        setRole('user');
        setShowAddForm(false);
        fetchUsers();
        setTimeout(() => setMessage(null), 3500);
      } else {
        throw new Error(data.error || 'Failed to create user.');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (targetUser: UserAccount, newRole: 'user' | 'admin') => {
    try {
      const response = await fetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empCode: targetUser.empCode,
          name: targetUser.name,
          role: newRole
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: `Role for ${targetUser.name} updated to ${newRole}.` });
        fetchUsers();
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.empCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6" id="user-accounts-tab">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">User Credentials Manager</h2>
          <p className="text-slate-500 text-sm">View or configure login codes, passwords, and access authorization roles</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchUsers}
            className="p-2 border border-slate-200 rounded-xl bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm flex items-center space-x-1.5 shadow-md shadow-indigo-100 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Authorized User</span>
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
            {message.type === 'success' ? <Check className="h-5 w-5 text-green-500 flex-shrink-0" /> : <ShieldAlert className="h-5 w-5 text-red-500 flex-shrink-0" />}
            <span>{message.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add User form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden p-6"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-4">Create Authorized User</h3>
            <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Employee Code / Username
                </label>
                <input
                  type="text"
                  required
                  value={empCode}
                  onChange={(e) => setEmpCode(e.target.value)}
                  placeholder="e.g. 180101"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Employee Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Bhavik Patel"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Secure Password
                </label>
                <input
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create password"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Authorization Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="user">User (Fill Attendance & Apply Leave)</option>
                  <option value="admin">Admin (Manage Shifts, Approvals & Downloads)</option>
                </select>
              </div>

              <div className="md:col-span-2 flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Saving...' : 'Authorize Account'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Users table */}
      <div className="bg-white border border-slate-100 shadow-sm rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Registered Accounts</h3>
            <p className="text-slate-500 text-sm mt-0.5">List of personnel who can login and interact with the platform</p>
          </div>
          <div className="relative max-w-xs w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search by ID or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {loading && users.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-4"></div>
            <p className="text-sm">Loading authorized users...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-600">
                  <th className="p-4">Name</th>
                  <th className="p-4">Employee ID</th>
                  <th className="p-4">Role</th>
                  <th className="p-4 text-right">Access Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.empCode} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${user.role === 'admin' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                          {user.role === 'admin' ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
                        </div>
                        <span className="font-semibold text-slate-900 text-sm">{user.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm font-mono text-slate-600">
                      {user.empCode}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                        user.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-100 text-slate-700'
                       }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {user.empCode === '180044' ? (
                        <span className="text-xs text-slate-400 font-medium italic">Immutable System Account</span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user, e.target.value as any)}
                            className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 bg-white focus:outline-none"
                          >
                            <option value="user">Operator/Leader</option>
                            <option value="admin">System Admin</option>
                          </select>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
