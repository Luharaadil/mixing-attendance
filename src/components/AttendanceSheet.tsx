import React, { useState, useEffect } from 'react';
import { Calendar, CheckSquare, Square, Save, Download, FileSpreadsheet, Check, AlertCircle, RefreshCw, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

interface EmployeeAttendance {
  empCode: string;
  name: string;
  scheduledShift: string;
  status: 'Present' | 'Absent' | 'Leave';
  saved: boolean;
}

interface AttendanceSheetProps {
  userRole: 'user' | 'admin';
  selectedMonth: string;
  onNavigateToTab: (tab: string) => void;
}

export default function AttendanceSheet({ userRole, selectedMonth, onNavigateToTab }: AttendanceSheetProps) {
  const [activeTab, setActiveTab] = useState<'daily' | 'muster'>('daily');
  const [date, setDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [shift, setShift] = useState('A1');
  const [employees, setEmployees] = useState<EmployeeAttendance[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Download states
  const [downloadMonth, setDownloadMonth] = useState(selectedMonth || new Date().toISOString().substring(0, 7));
  const [downloading, setDownloading] = useState(false);

  // Muster states
  const [musterMonth, setMusterMonth] = useState(selectedMonth || new Date().toISOString().substring(0, 7));
  const [musterData, setMusterData] = useState<any>(null);
  const [musterLoading, setMusterLoading] = useState(false);
  const [musterSearch, setMusterSearch] = useState('');

  const fetchAttendance = async () => {
    if (!date || !shift) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/attendance?date=${date}&shift=${shift}`);
      const data = await response.json();
      if (response.ok) {
        setEmployees(data.employees || []);
      } else {
        throw new Error(data.error || 'Failed to fetch attendance');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchMuster = async () => {
    setMusterLoading(true);
    try {
      const response = await fetch(`/api/attendance/month?month=${musterMonth}`);
      if (response.ok) {
        const data = await response.json();
        setMusterData(data);
      }
    } catch (err) {
      console.error('Error fetching muster:', err);
    } finally {
      setMusterLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [date, shift]);

  useEffect(() => {
    if (activeTab === 'muster') {
      fetchMuster();
    }
  }, [musterMonth, activeTab]);

  const handleStatusChange = (empCode: string, newStatus: 'Present' | 'Absent' | 'Leave') => {
    setEmployees(prev => prev.map(emp => {
      if (emp.empCode === empCode) {
        return { ...emp, status: newStatus };
      }
      return emp;
    }));
  };

  // Bulk actions: Tick All (Present)
  const handleSelectAllPresent = () => {
    setEmployees(prev => prev.map(emp => {
      // Don't override Approved Leave status
      if (emp.status === 'Leave') return emp;
      return { ...emp, status: 'Present' };
    }));
  };

  // Bulk actions: Remove All (Absent)
  const handleSelectAllAbsent = () => {
    setEmployees(prev => prev.map(emp => {
      if (emp.status === 'Leave') return emp;
      return { ...emp, status: 'Absent' };
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const records: Record<string, string> = {};
      employees.forEach(emp => {
        records[emp.empCode] = emp.status;
      });

      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, shift, records }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Attendance record saved successfully.' });
        // Mark as saved in local list
        setEmployees(prev => prev.map(emp => ({ ...emp, saved: true })));
        setTimeout(() => setMessage(null), 3500);
      } else {
        throw new Error(data.error || 'Failed to save attendance');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Excel Excel Exporter - Shift Schedule & Attendance Sheets
  const handleExportData = async (type: 'schedule' | 'attendance') => {
    setDownloading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/attendance/month?month=${downloadMonth}`);
      if (!response.ok) {
        throw new Error('Failed to load records for the selected month.');
      }
      const data = await response.json();
      const schedule = data.schedule;
      const attendance = data.attendance;
      const leaves = data.leaves;

      if (!schedule || !schedule.employees || Object.keys(schedule.employees).length === 0) {
        throw new Error(`No shift schedule found for ${downloadMonth}. Please upload a shift schedule first.`);
      }

      const employeesList = Object.entries(schedule.employees);
      const [year, monthStr] = downloadMonth.split('-');
      const daysInMonth = new Date(parseInt(year, 10), parseInt(monthStr, 10), 0).getDate();

      const workbook = XLSX.utils.book_new();

      if (type === 'schedule') {
        // --- 1. DOWNLOAD SHIFT SCHEDULE EXCEL ---
        const rows: any[] = [];
        
        // Header Row 1: Sr, Code, Name, Days 01-31
        const header1 = ['Sr.', 'Emp. Code', 'Emp. name'];
        for (let d = 1; d <= daysInMonth; d++) {
          header1.push(d < 10 ? `0${d}` : `${d}`);
        }
        rows.push(header1);

        // Populate employees rows
        employeesList.forEach(([empCode, empData]: any, idx) => {
          const empRow = [idx + 1, empCode, empData.name];
          for (let d = 1; d <= daysInMonth; d++) {
            empRow.push(empData.days[d] || '');
          }
          rows.push(empRow);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(workbook, worksheet, `Shift Schedule ${downloadMonth}`);
        XLSX.writeFile(workbook, `Shift_Schedule_${downloadMonth}.xlsx`);

      } else {
        // --- 2. DOWNLOAD ATTENDANCE SHEET EXCEL ---
        const rows: any[] = [];
        
        // Row 1: ID Number, Name, days 1-31, totals
        const header1 = ['ID Number', 'Name'];
        for (let d = 1; d <= daysInMonth; d++) {
          header1.push(`${d}`);
        }
        header1.push('Total Working Days', 'Present', 'Absent');
        rows.push(header1);

        // Row 2: Days of week
        const daysOfWeek = ['', ''];
        for (let d = 1; d <= daysInMonth; d++) {
          const dateObj = new Date(parseInt(year, 10), parseInt(monthStr, 10) - 1, d);
          const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
          daysOfWeek.push(dayName);
        }
        daysOfWeek.push('', '', '');
        rows.push(daysOfWeek);

        // Populate employee attendance cells
        employeesList.forEach(([empCode, empData]: any) => {
          const empRow = [empCode, empData.name];
          let totalWorking = 0;
          let presentCount = 0;
          let absentCount = 0;

          for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${downloadMonth}-${d < 10 ? '0' + d : d}`;
            const scheduleShift = empData.days[d] || 'WO';

            // Check if Sunday (Holiday)
            const dateObj = new Date(parseInt(year, 10), parseInt(monthStr, 10) - 1, d);
            const isSunday = dateObj.getDay() === 0;

            if (isSunday || scheduleShift === 'H') {
              empRow.push('H'); // Holiday
            } else if (scheduleShift === 'WO') {
              empRow.push('WO'); // Weekly Off
            } else {
              // Standard scheduled work day
              totalWorking++;
              
              // Find attendance
              const dayAttendance = attendance[dateStr]?.[empCode];
              if (dayAttendance) {
                if (dayAttendance.status === 'Present') {
                  empRow.push('P');
                  presentCount++;
                } else if (dayAttendance.status === 'Absent') {
                  empRow.push('A');
                  absentCount++;
                } else if (dayAttendance.status === 'Leave') {
                  empRow.push('L');
                } else {
                  empRow.push('');
                }
              } else {
                // If attendance hasn't been filled yet, show blank
                empRow.push('');
              }
            }
          }

          empRow.push(totalWorking, presentCount, absentCount);
          rows.push(empRow);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(workbook, worksheet, `Attendance ${downloadMonth}`);
        XLSX.writeFile(workbook, `Attendance_Sheet_${downloadMonth}.xlsx`);
      }

      setMessage({ type: 'success', text: `${type === 'schedule' ? 'Shift schedule' : 'Attendance sheet'} downloaded successfully.` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setDownloading(false);
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.empCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const presentCount = employees.filter(e => e.status === 'Present').length;
  const absentCount = employees.filter(e => e.status === 'Absent').length;
  const leaveCount = employees.filter(e => e.status === 'Leave').length;

  return (
    <div className="space-y-8" id="attendance-tab">
      {/* Sub tabs selector */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('daily')}
          className={`py-3 px-5 font-semibold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === 'daily' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            <CheckSquare className="h-4 w-4" />
            <span>Daily Shift Attendance</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('muster')}
          className={`py-3 px-5 font-semibold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === 'muster' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="h-4 w-4" />
            <span>Monthly Attendance Muster (All Employees)</span>
          </div>
        </button>
      </div>

      {activeTab === 'daily' ? (
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column: Attendance Recording Section */}
          <div className="flex-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Fill Daily Shift Attendance</h3>
                  <p className="text-slate-500 text-sm mt-0.5">Select a date and shift to update operator presence</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Shift</label>
                    <select
                      value={shift}
                      onChange={(e) => setShift(e.target.value)}
                      className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="A1">A1</option>
                      <option value="C1">C1</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="G">G</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Quick Stats & Bulk Actions */}
              {employees.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-4 text-sm font-semibold">
                    <span className="text-slate-500">Scheduled: <strong className="text-slate-800">{employees.length}</strong></span>
                    <span className="text-green-600">Present: <strong className="text-green-700">{presentCount}</strong></span>
                    <span className="text-red-600">Absent: <strong className="text-red-700">{absentCount}</strong></span>
                    {leaveCount > 0 && <span className="text-indigo-600">Leave: <strong className="text-indigo-700">{leaveCount}</strong></span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllPresent}
                      className="text-xs font-bold text-green-700 bg-green-100/70 border border-green-200 hover:bg-green-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                      <span>Tick All (Present)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectAllAbsent}
                      className="text-xs font-bold text-slate-700 bg-slate-200/70 border border-slate-300 hover:bg-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Square className="h-3.5 w-3.5" />
                      <span>Remove All (Absent)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Search filter */}
              {employees.length > 0 && (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Filter by name or employee ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              )}

              {/* Message Bar */}
              <AnimatePresence>
                {message && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`p-3.5 rounded-xl border flex items-center gap-2 text-sm ${
                      message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    {message.type === 'success' ? <Check className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-red-500" />}
                    <span>{message.text}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Attendance checklist list */}
              {loading ? (
                <div className="p-12 text-center text-slate-500">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-4"></div>
                  <p className="text-sm">Fetching scheduled employees from month schedule...</p>
                </div>
              ) : employees.length === 0 ? (
                <div className="p-12 text-center text-slate-500 max-w-sm mx-auto space-y-4">
                  <FileSpreadsheet className="h-12 w-12 text-slate-400 mx-auto" />
                  <h4 className="font-bold text-slate-900">No Shift Schedule Found</h4>
                  <p className="text-sm text-slate-500">There are no operators or leaders scheduled for Shift <strong>{shift}</strong> on <strong>{date}</strong>.</p>
                  <button
                    onClick={() => onNavigateToTab('schedule')}
                    className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-4 py-2 rounded-xl cursor-pointer"
                  >
                    Upload Shift Schedule
                  </button>
                </div>
              ) : (
                <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
                  {filteredEmployees.map((emp) => (
                    <div key={emp.empCode} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-sm">{emp.name}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">ID: {emp.empCode}</span>
                        </div>
                        <p className="text-xs text-slate-400">Shift: {emp.scheduledShift}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {emp.status === 'Leave' ? (
                          <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg">
                            Approved Leave
                          </span>
                        ) : (
                          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                            <button
                              type="button"
                              onClick={() => handleStatusChange(emp.empCode, 'Present')}
                              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                                emp.status === 'Present'
                                  ? 'bg-green-600 text-white shadow-sm'
                                  : 'text-slate-600 hover:text-slate-950'
                              }`}
                            >
                              Present
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(emp.empCode, 'Absent')}
                              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                                emp.status === 'Absent'
                                  ? 'bg-red-600 text-white shadow-sm'
                                  : 'text-slate-600 hover:text-slate-950'
                              }`}
                            >
                              Absent
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Save Buttons */}
              {employees.length > 0 && (
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={fetchAttendance}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Reload</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 shadow-md hover:shadow-indigo-100 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    <Save className="h-4 w-4" />
                    <span>{saving ? 'Saving...' : 'Save Shift Attendance'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Download Excel Report Section */}
          <div className="w-full lg:w-80 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Excel Download Center</h3>
                <p className="text-slate-500 text-sm mt-0.5">Download schedules and attendance reports securely</p>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Target Month</label>
                  <input
                    type="month"
                    value={downloadMonth}
                    onChange={(e) => setDownloadMonth(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    disabled={downloading}
                    onClick={() => handleExportData('schedule')}
                    className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 rounded-xl text-left text-sm text-slate-800 font-semibold transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-100">
                        <FileSpreadsheet className="h-4 w-4" />
                      </div>
                      <div>
                        <span>Shift Schedule</span>
                        <p className="text-[10px] text-slate-400 font-normal mt-0.5">Get raw monthly matrix xlsx</p>
                      </div>
                    </div>
                    <Download className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  </button>

                  <button
                    type="button"
                    disabled={downloading}
                    onClick={() => handleExportData('attendance')}
                    className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-100 rounded-xl text-left text-sm text-slate-800 font-semibold transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-100">
                        <FileSpreadsheet className="h-4 w-4" />
                      </div>
                      <div>
                        <span>Attendance Sheet</span>
                        <p className="text-[10px] text-slate-400 font-normal mt-0.5">Calculated totals & Sun yellow highlight</p>
                      </div>
                    </div>
                    <Download className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl">
                <h4 className="text-xs font-bold text-slate-700 uppercase mb-1.5">Download Info</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Downloaded reports automatically compile all recorded shift hours and absences. This allows immediate auditing from other computers connected to the network.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Monthly Attendance Muster</h3>
              <p className="text-slate-500 text-sm mt-0.5">
                Complete view of attendance for all operators and leaders across the selected month.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700">Month:</label>
                <input
                  type="month"
                  value={musterMonth}
                  onChange={(e) => setMusterMonth(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <button
                onClick={fetchMuster}
                className="p-2.5 border border-slate-200 rounded-xl bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                title="Refresh muster grid"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Search filter */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search employees in muster..."
              value={musterSearch}
              onChange={(e) => setMusterSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Legend guide */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl">
            <span className="text-slate-500 uppercase tracking-wider text-[10px]">Legend:</span>
            <span className="flex items-center gap-1.5"><strong className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-mono">P</strong> Present</span>
            <span className="flex items-center gap-1.5"><strong className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-mono">A</strong> Absent</span>
            <span className="flex items-center gap-1.5"><strong className="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-mono">L</strong> Approved Leave</span>
            <span className="flex items-center gap-1.5"><strong className="bg-yellow-50 text-yellow-800 px-1.5 py-0.5 rounded border border-yellow-200/50 font-mono">H</strong> Sunday/Holiday</span>
            <span className="flex items-center gap-1.5"><strong className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">WO</strong> Weekly Off</span>
            <span className="flex items-center gap-1.5"><strong className="bg-slate-50 text-slate-400 px-1.5 py-0.5 border border-dashed rounded font-mono">A1/C1</strong> Scheduled (Not Marked)</span>
          </div>

          {musterLoading ? (
            <div className="p-12 text-center text-slate-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-4"></div>
              <p className="text-sm">Generating monthly attendance muster grid...</p>
            </div>
          ) : !musterData || !musterData.schedule || Object.keys(musterData.schedule.employees || {}).length === 0 ? (
            <div className="p-12 text-center text-slate-500 max-w-sm mx-auto space-y-3">
              <FileSpreadsheet className="h-12 w-12 text-slate-300 mx-auto" />
              <h4 className="font-bold text-slate-900">No Muster Data Available</h4>
              <p className="text-sm text-slate-500">No shift schedule uploaded for {musterMonth} to display attendance matrix.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <div className="min-w-[1200px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-2.5 text-xs font-bold text-slate-600 sticky left-0 bg-slate-50 z-10 w-32 border-r border-slate-100">Emp Code</th>
                      <th className="p-2.5 text-xs font-bold text-slate-600 sticky left-32 bg-slate-50 z-10 w-44 border-r border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">Emp Name</th>
                      {Array.from({ length: new Date(parseInt(musterMonth.split('-')[0]), parseInt(musterMonth.split('-')[1]), 0).getDate() }, (_, i) => i + 1).map(day => (
                        <th key={day} className="p-1 text-[10px] font-bold text-slate-600 text-center w-8 border-r border-slate-100">
                          {day < 10 ? `0${day}` : day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(musterData.schedule.employees).filter(([empCode, empData]: any) => 
                      empData.name.toLowerCase().includes(musterSearch.toLowerCase()) ||
                      empCode.toLowerCase().includes(musterSearch.toLowerCase())
                    ).map(([empCode, empData]: any) => {
                      const [mYear, mM] = musterMonth.split('-');
                      const numDays = new Date(parseInt(mYear), parseInt(mM), 0).getDate();
                      return (
                        <tr key={empCode} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-2.5 text-xs font-medium text-slate-700 font-mono sticky left-0 bg-white border-r border-slate-100">
                            {empCode}
                          </td>
                          <td className="p-2.5 text-xs font-semibold text-slate-900 sticky left-32 bg-white border-r border-slate-100 truncate max-w-[176px] shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                            {empData.name}
                          </td>
                          {Array.from({ length: numDays }, (_, i) => i + 1).map(day => {
                            const dayStr = day < 10 ? `0${day}` : String(day);
                            const dateStr = `${musterMonth}-${dayStr}`;
                            const record = musterData.attendance[dateStr]?.[empCode];
                            const scheduleShift = empData.days[day] || 'WO';

                            const dateObj = new Date(parseInt(mYear), parseInt(mM) - 1, day);
                            const isSunday = dateObj.getDay() === 0;

                            let cellText = '-';
                            let cellBg = 'bg-white text-slate-300';

                            if (record) {
                              if (record.status === 'Present') {
                                cellText = 'P';
                                cellBg = 'bg-green-100/70 text-green-800 font-bold';
                              } else if (record.status === 'Absent') {
                                cellText = 'A';
                                cellBg = 'bg-red-100/70 text-red-800 font-bold';
                              } else if (record.status === 'Leave') {
                                cellText = 'L';
                                cellBg = 'bg-indigo-100/70 text-indigo-800 font-bold';
                              }
                            } else if (isSunday || scheduleShift === 'H') {
                              cellText = 'H';
                              cellBg = 'bg-yellow-50 text-yellow-800 font-semibold border-x border-yellow-100/40';
                            } else if (scheduleShift === 'WO') {
                              cellText = 'WO';
                              cellBg = 'bg-slate-100 text-slate-400 font-normal';
                            } else {
                              cellText = scheduleShift;
                              cellBg = 'bg-slate-50/50 text-slate-400 font-medium hover:bg-slate-50';
                            }

                            return (
                              <td key={day} className={`p-1 text-center text-xs h-9 border-r border-slate-100 ${cellBg}`} title={`${empData.name} - Day ${day}`}>
                                {cellText}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
