import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileSpreadsheet, Check, AlertCircle, Edit, Table, CheckCircle2, UserPlus, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { ShiftSchedule } from '../types';

interface ShiftSchedulerProps {
  userRole: 'user' | 'admin';
  selectedMonth: string;
  onMonthChange: (month: string) => void;
}

export default function ShiftScheduler({ userRole, selectedMonth, onMonthChange }: ShiftSchedulerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'view-edit' | 'upload'>('view-edit');
  const [schedule, setSchedule] = useState<ShiftSchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Upload states
  const [file, setFile] = useState<File | null>(null);
  const [parsedPreview, setParsedPreview] = useState<{ empCode: string; name: string; daysCount: number }[]>([]);
  const [parsedData, setParsedData] = useState<Record<string, any>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit cell states
  const [editingCell, setEditingCell] = useState<{ empCode: string; day: number } | null>(null);
  const [editValue, setEditValue] = useState('');

  const fetchSchedule = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/schedule?month=${selectedMonth}`);
      const data = await response.json();
      if (response.ok) {
        setSchedule(data.employees && Object.keys(data.employees).length > 0 ? data : null);
      } else {
        throw new Error(data.error || 'Failed to fetch schedule');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [selectedMonth]);

  // Handle Excel File Drop/Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      processFile(files[0]);
    }
  };

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setError('');
    setSuccess('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Use the first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to array of arrays
        const jsonSheet = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        
        if (jsonSheet.length === 0) {
          throw new Error('The uploaded Excel sheet is empty.');
        }

        // Find header row containing Employee Code and Employee Name
        let headerRowIdx = -1;
        let empCodeColIdx = -1;
        let empNameColIdx = -1;
        
        // Search rows for typical headers
        for (let r = 0; r < Math.min(jsonSheet.length, 10); r++) {
          const row = jsonSheet[r];
          if (!row) continue;
          
          const codeIdx = row.findIndex((cell: any) => {
            const str = String(cell).toLowerCase();
            return str.includes('emp. code') || str.includes('emp code') || str.includes('employee code') || str.includes('code');
          });

          const nameIdx = row.findIndex((cell: any) => {
            const str = String(cell).toLowerCase();
            return str.includes('emp. name') || str.includes('emp name') || str.includes('employee name') || str.includes('name');
          });

          if (codeIdx !== -1 && nameIdx !== -1) {
            headerRowIdx = r;
            empCodeColIdx = codeIdx;
            empNameColIdx = nameIdx;
            break;
          }
        }

        if (headerRowIdx === -1) {
          throw new Error('Could not find Employee Code and Name column headers. Please ensure headers like "Emp. Code" and "Emp. name" exist in the Excel sheet.');
        }

        const headerRow = jsonSheet[headerRowIdx];
        const daysInMonth = new Date(
          parseInt(selectedMonth.split('-')[0], 10), 
          parseInt(selectedMonth.split('-')[1], 10), 
          0
        ).getDate();

        // Map column indexes for day numbers 01 to 31 (or 1 to 31)
        // If the row immediately following headerRowIdx contains day numbers, data starts at headerRowIdx + 2.
        // Otherwise, data starts at headerRowIdx + 1.
        let dataStartRowIdx = headerRowIdx + 1;
        const dayColIndexes: Record<number, number> = {};

        for (let d = 1; d <= daysInMonth; d++) {
          const dStr1 = String(d);
          const dStr2 = d < 10 ? `0${d}` : String(d);
          
          // Search in headerRowIdx
          let colIdx = headerRow.findIndex((cell: any, i: number) => {
            if (i === empCodeColIdx || i === empNameColIdx) return false;
            const str = String(cell).trim();
            return str === dStr1 || str === dStr2;
          });

          // If not found, try searching the next row (headerRowIdx + 1)
          if (colIdx === -1 && headerRowIdx + 1 < jsonSheet.length) {
            const nextRow = jsonSheet[headerRowIdx + 1];
            colIdx = nextRow.findIndex((cell: any, i: number) => {
              if (i === empCodeColIdx || i === empNameColIdx) return false;
              const str = String(cell).trim();
              return str === dStr1 || str === dStr2;
            });
            if (colIdx !== -1) {
              dataStartRowIdx = headerRowIdx + 2;
            }
          }

          if (colIdx !== -1) {
            dayColIndexes[d] = colIdx;
          }
        }

        if (Object.keys(dayColIndexes).length === 0) {
          throw new Error('Could not find columns for day numbers (01, 02... 30). Please ensure day number columns exist in the header row.');
        }

        // Parse employee rows
        const employeesRecord: Record<string, any> = {};
        const previewList: { empCode: string; name: string; daysCount: number }[] = [];

        for (let r = dataStartRowIdx; r < jsonSheet.length; r++) {
          const row = jsonSheet[r];
          if (!row) continue;

          const rawCode = row[empCodeColIdx];
          const rawName = row[empNameColIdx];

          if (!rawCode || !rawName) continue;

          const empCode = String(rawCode).trim();
          const name = String(rawName).trim();

          // Ignore header rows repeating, page headers or grand total lines
          if (empCode.toLowerCase().includes('code') || name.toLowerCase().includes('name') || empCode.toLowerCase().includes('total')) {
            continue;
          }

          const daysSchedule: Record<number, string> = {};
          let parsedDaysCount = 0;

          for (let d = 1; d <= daysInMonth; d++) {
            const colIdx = dayColIndexes[d];
            if (colIdx !== undefined && row[colIdx] !== undefined) {
              const shiftCode = String(row[colIdx]).trim().toUpperCase();
              if (shiftCode) {
                daysSchedule[d] = shiftCode;
                parsedDaysCount++;
              }
            }
          }

          if (parsedDaysCount > 0) {
            employeesRecord[empCode] = { name, days: daysSchedule };
            previewList.push({ empCode, name, daysCount: parsedDaysCount });
          }
        }

        if (previewList.length === 0) {
          throw new Error('No employee schedule records could be parsed. Check the Excel data cells.');
        }

        setParsedData(employeesRecord);
        setParsedPreview(previewList);
        setSuccess(`Successfully parsed ${previewList.length} employees' shift matrix.`);
      } catch (err: any) {
        setError(err.message || 'Error processing Excel file. Check format.');
        setFile(null);
        setParsedPreview([]);
        setParsedData({});
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleSaveUpload = async () => {
    if (Object.keys(parsedData).length === 0) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/schedule/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          employees: parsedData
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess(`Shift schedule for ${selectedMonth} uploaded & saved. User login accounts successfully updated!`);
        setFile(null);
        setParsedPreview([]);
        setParsedData({});
        setActiveSubTab('view-edit');
        fetchSchedule();
      } else {
        throw new Error(data.error || 'Failed to save shift schedule.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCell = async (empCode: string, day: number, value: string) => {
    const uppercaseValue = value.trim().toUpperCase();
    try {
      const response = await fetch('/api/schedule/update-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          empCode,
          dayNum: day,
          shiftCode: uppercaseValue
        }),
      });

      if (response.ok) {
        // Update local state
        setSchedule(prev => {
          if (!prev) return prev;
          const updatedEmployees = { ...prev.employees };
          if (updatedEmployees[empCode]) {
            updatedEmployees[empCode].days[day] = uppercaseValue;
          }
          return { ...prev, employees: updatedEmployees };
        });
        setEditingCell(null);
      } else {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to update cell.');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Get number of days for the selected month
  const [year, monthStr] = selectedMonth.split('-');
  const daysInMonth = new Date(parseInt(year, 10), parseInt(monthStr, 10), 0).getDate();
  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="space-y-6" id="shift-schedule-tab">
      {/* Sub Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveSubTab('view-edit')}
            className={`py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'view-edit' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Table className="h-4 w-4" />
              <span>Change / View Shifts</span>
            </div>
          </button>
          {userRole === 'admin' && (
            <button
              onClick={() => setActiveSubTab('upload')}
              className={`py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer ${
                activeSubTab === 'upload' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Upload className="h-4 w-4" />
                <span>Upload New Excel</span>
              </div>
            </button>
          )}
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-slate-700">Target Month:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => onMonthChange(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start space-x-2.5"
          >
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm flex items-start space-x-2.5"
          >
            <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View & Change Shifts Tab */}
      {activeSubTab === 'view-edit' && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden space-y-6">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Monthly Shift Grid</h3>
              <p className="text-slate-500 text-sm mt-0.5">
                Double click or tap any cell containing shifts to make instant changes. Allowed shifts: <strong>A, B, C, A1, C1, G, WO, H</strong>.
              </p>
            </div>
            {userRole === 'admin' && !schedule && (
              <button
                onClick={() => setActiveSubTab('upload')}
                className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-4 py-2 rounded-xl cursor-pointer transition-colors"
              >
                Upload Excel Matrix
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-4"></div>
              <p className="text-sm">Loading shift schedules...</p>
            </div>
          ) : !schedule ? (
            <div className="p-16 text-center text-slate-400 max-w-sm mx-auto space-y-4">
              <FileSpreadsheet className="h-12 w-12 text-slate-300 mx-auto" />
              <h4 className="font-bold text-slate-900">No Shift Schedule Found</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                There is no shift schedule uploaded for {selectedMonth} yet. Please upload a spreadsheet to start recording shift attendance.
              </p>
            </div>
          ) : (
            <div className="p-6 overflow-x-auto">
              <div className="min-w-[1200px]">
                <table className="w-full text-left border-collapse border border-slate-100">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border border-slate-100 p-2.5 text-xs font-bold text-slate-600 w-32 sticky left-0 bg-slate-50 z-10">Emp Code</th>
                      <th className="border border-slate-100 p-2.5 text-xs font-bold text-slate-600 w-44 sticky left-32 bg-slate-50 z-10">Emp Name</th>
                      {dayHeaders.map(day => (
                        <th key={day} className="border border-slate-100 p-1 text-[10px] font-bold text-slate-600 text-center w-8">
                          {day < 10 ? `0${day}` : day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(schedule.employees).map(([empCode, empData]: any) => (
                      <tr key={empCode} className="hover:bg-slate-50/50 transition-colors">
                        <td className="border border-slate-100 p-2.5 text-xs font-medium text-slate-700 font-mono sticky left-0 bg-white hover:bg-slate-50">
                          {empCode}
                        </td>
                        <td className="border border-slate-100 p-2.5 text-xs font-semibold text-slate-900 sticky left-32 bg-white hover:bg-slate-50 truncate max-w-[176px]">
                          {empData.name}
                        </td>
                        {dayHeaders.map(day => {
                          const shiftCode = empData.days[day] || '';
                          const isEditing = editingCell?.empCode === empCode && editingCell?.day === day;
                          
                          // Style based on shift type
                          let cellBg = 'bg-white text-slate-700';
                          if (shiftCode === 'A1' || shiftCode === 'A') cellBg = 'bg-amber-50 text-amber-800 font-medium';
                          else if (shiftCode === 'C1' || shiftCode === 'C') cellBg = 'bg-blue-50 text-blue-800 font-medium';
                          else if (shiftCode === 'B') cellBg = 'bg-emerald-50 text-emerald-800 font-medium';
                          else if (shiftCode === 'G') cellBg = 'bg-purple-50 text-purple-800 font-medium';
                          else if (shiftCode === 'WO') cellBg = 'bg-slate-100 text-slate-500 font-normal';
                          else if (shiftCode === 'H') cellBg = 'bg-yellow-100 text-yellow-800 font-semibold';

                          return (
                            <td
                              key={day}
                              onDoubleClick={() => {
                                if (userRole === 'admin') {
                                  setEditingCell({ empCode, day });
                                  setEditValue(shiftCode);
                                }
                              }}
                              className={`border border-slate-100 p-1 text-center text-xs h-9 cursor-pointer select-none transition-all ${cellBg} relative group`}
                            >
                              {isEditing ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={() => handleUpdateCell(empCode, day, editValue)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleUpdateCell(empCode, day, editValue);
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                  className="absolute inset-0 w-full h-full text-center border-2 border-indigo-500 bg-white text-slate-900 rounded font-bold uppercase focus:outline-none focus:ring-0 z-20"
                                />
                              ) : (
                                <>
                                  <span>{shiftCode || '-'}</span>
                                  {userRole === 'admin' && (
                                    <div className="absolute right-0.5 bottom-0.5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                      <Edit className="h-2 w-2 text-slate-400" />
                                    </div>
                                  )}
                                </>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload New Excel Tab */}
      {activeSubTab === 'upload' && userRole === 'admin' && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden p-6 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Upload Monthly Shift Excel</h3>
            <p className="text-slate-500 text-sm mt-0.5">
              Select or drop your monthly schedule file. This will build the attendance records and automatically onboard missing employees.
            </p>
          </div>

          <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-8 text-center transition-all bg-slate-50/50 relative group">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx, .xls"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="space-y-3">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl inline-block group-hover:bg-indigo-100 transition-colors">
                <FileSpreadsheet className="h-8 w-8" />
              </div>
              <div className="text-sm font-semibold text-slate-800">
                {file ? file.name : 'Click to upload or drag & drop Excel'}
              </div>
              <p className="text-xs text-slate-400">Supports .xlsx or .xls files with headers like 'Emp. Code' and 'Emp. name'</p>
            </div>
          </div>

          {parsedPreview.length > 0 && (
            <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/20">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  File Preview ({parsedPreview.length} Employees found)
                </span>
                <button
                  type="button"
                  onClick={handleSaveUpload}
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow cursor-pointer transition-colors"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{loading ? 'Saving...' : 'Confirm & Save Schedule'}</span>
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 p-4 space-y-2">
                {parsedPreview.map((item) => (
                  <div key={item.empCode} className="flex items-center justify-between text-xs py-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-slate-500 font-semibold">{item.empCode}</span>
                      <span className="font-semibold text-slate-800">{item.name}</span>
                    </div>
                    <span className="text-slate-400 font-medium">{item.daysCount} shift entries parsed</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
