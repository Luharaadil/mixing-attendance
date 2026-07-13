import React, { useState } from 'react';
import { Database, Download, Upload, CheckCircle2, AlertCircle, RefreshCw, HelpCircle, ArrowUpRight, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

interface BackupFile {
  id: string;
  name: string;
  filename: string;
  description: string;
  iconBg: string;
  iconColor: string;
}

export default function ExcelSyncCenter() {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({});

  const backupFiles: BackupFile[] = [
    {
      id: 'users',
      name: 'User Accounts & Logins',
      filename: 'users.xlsx',
      description: 'Employee login credentials, passwords, and user access roles (Admin / User).',
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
    },
    {
      id: 'schedules',
      name: 'Shift Schedules Matrix',
      filename: 'schedules.xlsx',
      description: 'Monthly operator duty rosters and schedules uploaded from Excel matrix files.',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      id: 'attendance',
      name: 'Attendance Sheet Logs',
      filename: 'attendance.xlsx',
      description: 'Recorded daily presence status records (Present, Absent, Leave) for all shifts.',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      id: 'leaves',
      name: 'Leave Requests Ledger',
      filename: 'leaves.xlsx',
      description: 'Leave applications, dates, comments, approval status, and approver details.',
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
    },
  ];

  const handleDownload = async (fileId: string, filename: string) => {
    setLoading(prev => ({ ...prev, [fileId + '-download']: true }));
    setMessages(prev => ({ ...prev, [fileId]: null as any }));

    try {
      const response = await fetch(`/api/backup/download/${fileId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to download file');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setMessages(prev => ({
        ...prev,
        [fileId]: { type: 'success', text: `Downloaded successfully. Saved to your computer as ${filename}.` }
      }));
    } catch (err: any) {
      console.error(err);
      setMessages(prev => ({
        ...prev,
        [fileId]: { type: 'error', text: err.message || 'Excel sheet has not been created on the server yet.' }
      }));
    } finally {
      setLoading(prev => ({ ...prev, [fileId + '-download']: false }));
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>, fileId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Verify it is an excel file
    if (!file.name.endsWith('.xlsx')) {
      setMessages(prev => ({
        ...prev,
        [fileId]: { type: 'error', text: 'Invalid file. Please upload only a valid Microsoft Excel (.xlsx) file.' }
      }));
      return;
    }

    setLoading(prev => ({ ...prev, [fileId + '-upload']: true }));
    setMessages(prev => ({ ...prev, [fileId]: null as any }));

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = reader.result as string;
        const base64 = result.split(',')[1]; // Extract base64 content

        const response = await fetch(`/api/backup/upload/${fileId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileData: base64 }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to upload backup');
        }

        setMessages(prev => ({
          ...prev,
          [fileId]: { type: 'success', text: `Restored successfully! The cloud database is now updated.` }
        }));
      } catch (err: any) {
        console.error(err);
        setMessages(prev => ({
          ...prev,
          [fileId]: { type: 'error', text: err.message || 'Failed to restore file.' }
        }));
      } finally {
        setLoading(prev => ({ ...prev, [fileId + '-upload']: false }));
        // Reset the file input value so same file can be uploaded again
        e.target.value = '';
      }
    };

    reader.onerror = () => {
      setMessages(prev => ({
        ...prev,
        [fileId]: { type: 'error', text: 'Error reading file on your device.' }
      }));
      setLoading(prev => ({ ...prev, [fileId + '-upload']: false }));
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-8" id="sync-tab">
      {/* Banner / Explanation */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Excel Sync & Local Backup Center</h3>
            <p className="text-slate-500 text-sm mt-1 leading-relaxed">
              To allow operators to submit attendance or request leaves from anywhere (outside the company Wi-Fi network), the system runs as a hosted cloud portal. 
              Since browser security sandboxes prevent web portals from writing files directly to your local computer's physical drive, this dashboard enables you to:
            </p>
            <ul className="list-disc pl-5 text-xs text-slate-500 mt-2 space-y-1.5">
              <li><strong>Local Backups:</strong> Download cloud Excel databases to keep a copy securely saved on your own computer.</li>
              <li><strong>Cloud Restore & Sync:</strong> Upload your computer's Excel files to overwrite and synchronize the cloud portal state.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Grid of Excel Files */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {backupFiles.map((file) => {
          const msg = messages[file.id];
          const isDownloading = loading[file.id + '-download'];
          const isUploading = loading[file.id + '-upload'];

          return (
            <div key={file.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className={`p-2.5 rounded-xl ${file.iconBg} ${file.iconColor}`}>
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{file.name}</h4>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono mt-0.5 inline-block">
                      {file.filename}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {file.description}
                </p>
              </div>

              {/* Status Message */}
              {msg && (
                <div className={`text-xs p-3 rounded-xl border flex items-start space-x-2 ${
                  msg.type === 'success' 
                    ? 'bg-green-50 border-green-150 text-green-800' 
                    : 'bg-red-50 border-red-150 text-red-800'
                }`}>
                  {msg.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                  <span>{msg.text}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-50">
                <button
                  type="button"
                  disabled={isDownloading || isUploading}
                  onClick={() => handleDownload(file.id, file.filename)}
                  className="flex-1 min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold border border-slate-250 hover:border-slate-350 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isDownloading ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  <span>{isDownloading ? 'Downloading...' : 'Save to Computer'}</span>
                </button>

                <div className="flex-1 min-w-[130px] relative">
                  <input
                    type="file"
                    accept=".xlsx"
                    id={`upload-input-${file.id}`}
                    onChange={(e) => handleUpload(e, file.id)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    disabled={isDownloading || isUploading}
                  />
                  <button
                    type="button"
                    disabled={isDownloading || isUploading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-indigo-100 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isUploading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    <span>{isUploading ? 'Syncing...' : 'Upload & Overwrite'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cloud & GitHub Deployment Guide */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 text-white space-y-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 bg-indigo-600/30 text-indigo-400 rounded-xl border border-indigo-500/20">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-100 text-sm">Deployment & GitHub Guide</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Because this application is built with React + Express, you can run and export it to run on any computer or host it on public services like GitHub and Google Cloud Run.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 bg-slate-800/50 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center space-x-1.5 text-indigo-400 font-semibold text-xs">
              <ArrowUpRight className="h-4 w-4" />
              <span>How to Export & Deploy</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Open the <strong>Settings menu</strong> at the top right of the Google AI Studio environment, and select <strong>Export to GitHub</strong> or <strong>Download ZIP</strong>. This gives you the full, self-contained production code.
            </p>
          </div>

          <div className="p-4 bg-slate-800/50 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold text-xs">
              <CheckCircle2 className="h-4 w-4" />
              <span>Running Anywhere</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Once exported, simply run <code className="bg-slate-950 px-1 py-0.5 rounded text-indigo-300 font-mono text-[10px]">npm install</code> and <code className="bg-slate-950 px-1 py-0.5 rounded text-indigo-300 font-mono text-[10px]">npm run build</code>, then launch it. The Excel spreadsheets will automatically compile and save locally inside the <code className="text-slate-300 font-mono font-semibold text-[10px]">/data/</code> folder.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
