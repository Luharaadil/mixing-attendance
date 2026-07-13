import React, { useState } from 'react';
import { LogIn, Key, User, ShieldAlert, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onLoginSuccess: (user: { empCode: string; name: string; role: 'user' | 'admin' }) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [empCode, setEmpCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empCode || !password) {
      setError('Please fill in both Employee Code and Password.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empCode: empCode.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed.');
      }

      onLoginSuccess(data);
    } catch (err: any) {
      setError(err.message || 'Server error. Please verify the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="flex justify-center">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-100">
            <LogIn className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-slate-900 font-sans">
          MAXXIS RUBBER INDIA
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          Shift Portal Login & Attendance Hub
        </p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="bg-white py-8 px-4 shadow-xl border border-slate-100 rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg bg-red-50 p-4 border border-red-100 flex items-start space-x-3 text-red-800 text-sm">
                <ShieldAlert className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="empCode" className="block text-sm font-semibold text-slate-700">
                Employee Code / ID
              </label>
              <div className="mt-1.5 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="empCode"
                  name="empCode"
                  type="text"
                  required
                  value={empCode}
                  onChange={(e) => setEmpCode(e.target.value)}
                  placeholder="e.g. 180044"
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                Password
              </label>
              <div className="mt-1.5 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-colors"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-6">
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Default Credentials
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-3.5 w-3.5 text-indigo-500" />
                  <span><strong>Employee login:</strong> Employee Code is default user id & password.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
