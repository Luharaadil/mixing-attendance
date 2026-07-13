import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import * as XLSX from 'xlsx';

async function startServer() {
  const app = express();
  const PORT = 5005;

  app.use(express.json({ limit: '50mb' }));

  // Ensure data directory exists
  const DATA_DIR = path.join(process.cwd(), 'data');
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // File paths
  const getUsersFilePath = () => path.join(DATA_DIR, 'users.xlsx');
  const getSchedulesFilePath = () => path.join(DATA_DIR, 'schedules.xlsx');
  const getAttendanceFilePath = () => path.join(DATA_DIR, 'attendance.xlsx');
  const getLeavesFilePath = () => path.join(DATA_DIR, 'leaves.xlsx');

  // Helper: Read Users from Excel
  interface UserData {
    empCode: string;
    name: string;
    password: string;
    role: 'user' | 'admin';
  }

  const readUsersFromExcel = (): Record<string, UserData> => {
    const filePath = getUsersFilePath();
    const defaultUsers: Record<string, UserData> = {
      '180044': {
        empCode: '180044',
        name: 'System Admin',
        password: 'MX180044',
        role: 'admin'
      }
    };

    if (!fs.existsSync(filePath)) {
      writeUsersToExcel(defaultUsers);
      return defaultUsers;
    }

    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<any>(worksheet);
      
      const users: Record<string, UserData> = {};
      for (const row of data) {
        const empCode = String(row['Employee Code'] || row['empCode'] || '').trim();
        if (!empCode) continue;
        users[empCode] = {
          empCode,
          name: String(row['Full Name'] || row['name'] || empCode).trim(),
          password: String(row['Password'] || row['password'] || empCode).trim(),
          role: (String(row['Role'] || row['role'] || 'user').trim().toLowerCase() === 'admin') ? 'admin' : 'user'
        };
      }
      
      // Ensure default admin 180044 exists
      if (!users['180044']) {
        users['180044'] = defaultUsers['180044'];
        writeUsersToExcel(users);
      }
      return users;
    } catch (e) {
      console.error('Error reading users.xlsx:', e);
      return defaultUsers;
    }
  };

  // Helper: Write Users to Excel
  const writeUsersToExcel = (users: Record<string, UserData>) => {
    const filePath = getUsersFilePath();
    const rows = Object.values(users).map(u => ({
      'Employee Code': u.empCode,
      'Full Name': u.name,
      'Role': u.role,
      'Password': u.password
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
    XLSX.writeFile(workbook, filePath);
  };

  // Helper: Read Schedules from Excel
  const readSchedulesFromExcel = (): Record<string, any> => {
    const filePath = getSchedulesFilePath();
    if (!fs.existsSync(filePath)) {
      return {};
    }

    try {
      const workbook = XLSX.readFile(filePath);
      const schedules: Record<string, any> = {};

      for (const sheetName of workbook.SheetNames) {
        if (!/^\d{4}-\d{2}$/.test(sheetName)) continue;

        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any>(worksheet);
        const employees: Record<string, any> = {};

        for (const row of rows) {
          const empCodeRaw = row['Emp. Code'] || row['Employee Code'] || row['empCode'] || row['ID Number'] || row['Sr.'];
          const nameRaw = row['Emp. name'] || row['Employee Name'] || row['name'] || row['Name'];
          if (!empCodeRaw) continue;

          const empCode = String(empCodeRaw).trim();
          const name = String(nameRaw || empCode).trim();

          const days: Record<number, string> = {};
          for (let d = 1; d <= 31; d++) {
            const val = row[String(d)] || row[d < 10 ? `0${d}` : String(d)];
            if (val !== undefined && String(val).trim() !== '') {
              days[d] = String(val).trim().toUpperCase();
            }
          }

          employees[empCode] = { name, days };
        }

        schedules[sheetName] = {
          month: sheetName,
          employees
        };
      }

      return schedules;
    } catch (e) {
      console.error('Error reading schedules.xlsx:', e);
      return {};
    }
  };

  // Helper: Write Schedules to Excel
  const writeSchedulesToExcel = (schedules: Record<string, any>) => {
    const filePath = getSchedulesFilePath();
    let workbook: XLSX.WorkBook;
    
    if (fs.existsSync(filePath)) {
      try {
        workbook = XLSX.readFile(filePath);
      } catch {
        workbook = XLSX.utils.book_new();
      }
    } else {
      workbook = XLSX.utils.book_new();
    }

    for (const [month, data] of Object.entries(schedules)) {
      const sheetRows: any[] = [];
      const employeesList = Object.entries(data.employees);

      employeesList.forEach(([empCode, empData]: any) => {
        const row: any = {
          'Emp. Code': empCode,
          'Emp. name': empData.name,
        };
        for (let d = 1; d <= 31; d++) {
          row[d < 10 ? `0${d}` : String(d)] = empData.days[d] || '';
        }
        sheetRows.push(row);
      });

      const worksheet = XLSX.utils.json_to_sheet(sheetRows);
      
      if (workbook.Sheets[month]) {
        workbook.Sheets[month] = worksheet;
      } else {
        XLSX.utils.book_append_sheet(workbook, worksheet, month);
      }
    }

    XLSX.writeFile(workbook, filePath);
  };

  // Helper: Read Attendance from Excel
  const readAttendanceFromExcel = (): Record<string, any> => {
    const filePath = getAttendanceFilePath();
    if (!fs.existsSync(filePath)) {
      return {};
    }

    try {
      const workbook = XLSX.readFile(filePath);
      const attendance: Record<string, any> = {};

      for (const sheetName of workbook.SheetNames) {
        if (!/^\d{4}-\d{2}$/.test(sheetName)) continue;

        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any>(worksheet);

        for (const row of rows) {
          const empCodeRaw = row['ID Number'] || row['Employee Code'] || row['empCode'] || row['Emp. Code'];
          if (!empCodeRaw) continue;

          const empCode = String(empCodeRaw).trim();

          for (let d = 1; d <= 31; d++) {
            const val = row[String(d)] || row[d < 10 ? `0${d}` : String(d)];
            if (val !== undefined && String(val).trim() !== '') {
              const statusChar = String(val).trim().toUpperCase();
              let status: 'Present' | 'Absent' | 'Leave' | null = null;
              if (statusChar === 'P' || statusChar === 'PRESENT') status = 'Present';
              else if (statusChar === 'A' || statusChar === 'ABSENT') status = 'Absent';
              else if (statusChar === 'L' || statusChar === 'LEAVE') status = 'Leave';

              if (status) {
                const dayStr = d < 10 ? `0${d}` : String(d);
                const dateStr = `${sheetName}-${dayStr}`;

                if (!attendance[dateStr]) {
                  attendance[dateStr] = {};
                }
                attendance[dateStr][empCode] = {
                  status,
                  shift: '', // Derives from schedule during queries
                  updatedAt: new Date().toISOString()
                };
              }
            }
          }
        }
      }

      return attendance;
    } catch (e) {
      console.error('Error reading attendance.xlsx:', e);
      return {};
    }
  };

  // Helper: Write Attendance to Excel
  const writeAttendanceToExcel = (attendance: Record<string, any>, schedules: Record<string, any>) => {
    const filePath = getAttendanceFilePath();
    let workbook: XLSX.WorkBook;

    if (fs.existsSync(filePath)) {
      try {
        workbook = XLSX.readFile(filePath);
      } catch {
        workbook = XLSX.utils.book_new();
      }
    } else {
      workbook = XLSX.utils.book_new();
    }

    const monthlyData: Record<string, Record<string, any>> = {};
    const employeesByMonth: Record<string, Record<string, string>> = {};

    for (const [month, sch] of Object.entries(schedules)) {
      if (!employeesByMonth[month]) employeesByMonth[month] = {};
      for (const [code, emp] of Object.entries(sch.employees) as any[]) {
        employeesByMonth[month][code] = emp.name;
      }
    }

    for (const dateStr of Object.keys(attendance)) {
      const month = dateStr.substring(0, 7);
      if (!/^\d{4}-\d{2}$/.test(month)) continue;
      if (!monthlyData[month]) monthlyData[month] = {};
    }

    for (const month of Object.keys(employeesByMonth)) {
      if (!monthlyData[month]) monthlyData[month] = {};
    }

    for (const month of Object.keys(monthlyData)) {
      const sheetRows: any[] = [];
      const empNamesMap = employeesByMonth[month] || {};

      const empCodesSet = new Set<string>(Object.keys(empNamesMap));
      for (const [dateStr, records] of Object.entries(attendance)) {
        if (dateStr.startsWith(month)) {
          for (const code of Object.keys(records)) {
            empCodesSet.add(code);
          }
        }
      }

      const empCodesList = Array.from(empCodesSet);

      empCodesList.forEach(empCode => {
        const row: any = {
          'ID Number': empCode,
          'Name': empNamesMap[empCode] || empCode,
        };

        for (let d = 1; d <= 31; d++) {
          const dayStr = d < 10 ? `0${d}` : String(d);
          const dateStr = `${month}-${dayStr}`;
          const record = attendance[dateStr]?.[empCode];
          
          let val = '';
          if (record) {
            if (record.status === 'Present') val = 'P';
            else if (record.status === 'Absent') val = 'A';
            else if (record.status === 'Leave') val = 'L';
          }
          row[d < 10 ? `0${d}` : String(d)] = val;
        }
        sheetRows.push(row);
      });

      const worksheet = XLSX.utils.json_to_sheet(sheetRows);

      if (workbook.Sheets[month]) {
        workbook.Sheets[month] = worksheet;
      } else {
        XLSX.utils.book_append_sheet(workbook, worksheet, month);
      }
    }

    XLSX.writeFile(workbook, filePath);
  };

  // Helper: Read Leaves from Excel
  const readLeavesFromExcel = (): any[] => {
    const filePath = getLeavesFilePath();
    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any>(worksheet);

      return rows.map(r => ({
        id: String(r['ID'] || r['id'] || '').trim(),
        empCode: String(r['Employee Code'] || r['empCode'] || '').trim(),
        empName: String(r['Employee Name'] || r['empName'] || '').trim(),
        startDate: String(r['Start Date'] || r['startDate'] || '').trim(),
        endDate: String(r['End Date'] || r['endDate'] || '').trim(),
        reason: String(r['Reason'] || r['reason'] || '').trim(),
        status: String(r['Status'] || r['status'] || 'Pending').trim(),
        approverId: String(r['Approver ID'] || r['approverId'] || 'admin').trim(),
        approvedBy: r['Approved By ID'] || r['approvedBy'] || undefined,
        actionDate: r['Action Date'] || r['actionDate'] || undefined,
        createdAt: String(r['Created At'] || r['createdAt'] || new Date().toISOString()).trim()
      }));
    } catch (e) {
      console.error('Error reading leaves.xlsx:', e);
      return [];
    }
  };

  // Helper: Write Leaves to Excel
  const writeLeavesToExcel = (leaves: any[]) => {
    const filePath = getLeavesFilePath();
    const rows = leaves.map(l => ({
      'ID': l.id,
      'Employee Code': l.empCode,
      'Employee Name': l.empName,
      'Start Date': l.startDate,
      'End Date': l.endDate,
      'Reason': l.reason,
      'Status': l.status,
      'Approver ID': l.approverId,
      'Approved By ID': l.approvedBy || '',
      'Action Date': l.actionDate || '',
      'Created At': l.createdAt
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leaves');
    XLSX.writeFile(workbook, filePath);
  };

  // Seed default DB
  const initDB = () => {
    // Triggers Excel file creation and default user seeding
    readUsersFromExcel();
  };

  initDB();

  // API Endpoints

  // 1. Auth Login
  app.post('/api/auth/login', (req, res) => {
    const { empCode, password } = req.body;
    if (!empCode || !password) {
      return res.status(400).json({ error: 'Employee Code and Password are required.' });
    }

    const users = readUsersFromExcel();
    const user = users[empCode];

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid Employee Code or Password.' });
    }

    return res.json({
      empCode: user.empCode,
      name: user.name,
      role: user.role
    });
  });

  // 1.1 Change Password
  app.post('/api/auth/change-password', (req, res) => {
    const { empCode, currentPassword, newPassword } = req.body;
    if (!empCode || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Employee Code, current password, and new password are required.' });
    }

    const users = readUsersFromExcel();
    const user = users[empCode];

    if (!user) {
      return res.status(404).json({ error: 'Employee account not found.' });
    }

    if (user.password !== currentPassword) {
      return res.status(401).json({ error: 'Current password does not match.' });
    }

    user.password = newPassword;
    users[empCode] = user;
    writeUsersToExcel(users);

    return res.json({ success: true, message: 'Password has been updated successfully.' });
  });

  // 1.2 Excel Sync & Backup Center
  app.get('/api/backup/download/:fileType', (req, res) => {
    const { fileType } = req.params;
    let filePath = '';
    let fileName = '';

    if (fileType === 'users') {
      filePath = getUsersFilePath();
      fileName = 'users.xlsx';
    } else if (fileType === 'schedules') {
      filePath = getSchedulesFilePath();
      fileName = 'schedules.xlsx';
    } else if (fileType === 'attendance') {
      filePath = getAttendanceFilePath();
      fileName = 'attendance.xlsx';
    } else if (fileType === 'leaves') {
      filePath = getLeavesFilePath();
      fileName = 'leaves.xlsx';
    } else {
      return res.status(400).json({ error: 'Invalid file type. Must be users, schedules, attendance, or leaves.' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `File ${fileName} does not exist yet. It will be created when relevant operations are performed.` });
    }

    return res.download(filePath, fileName);
  });

  app.post('/api/backup/upload/:fileType', (req, res) => {
    const { fileType } = req.params;
    const { fileData } = req.body; // Base64 encoded file content

    if (!fileData) {
      return res.status(400).json({ error: 'File content (base64) is required.' });
    }

    let filePath = '';
    if (fileType === 'users') {
      filePath = getUsersFilePath();
    } else if (fileType === 'schedules') {
      filePath = getSchedulesFilePath();
    } else if (fileType === 'attendance') {
      filePath = getAttendanceFilePath();
    } else if (fileType === 'leaves') {
      filePath = getLeavesFilePath();
    } else {
      return res.status(400).json({ error: 'Invalid file type.' });
    }

    try {
      // Decode base64 to buffer and write to file
      const buffer = Buffer.from(fileData, 'base64');
      fs.writeFileSync(filePath, buffer);
      return res.json({ success: true, message: `${fileType} database restored successfully.` });
    } catch (err: any) {
      console.error('Error restoring backup:', err);
      return res.status(500).json({ error: 'Failed to write the uploaded file. Ensure it is a valid Excel file.' });
    }
  });

  // 2. User accounts management
  app.get('/api/users', (req, res) => {
    const users = readUsersFromExcel();
    return res.json(Object.values(users));
  });

  app.post('/api/users/update', (req, res) => {
    const { empCode, name, password, role } = req.body;
    if (!empCode) {
      return res.status(400).json({ error: 'Employee code is required' });
    }

    const users = readUsersFromExcel();
    users[empCode] = {
      empCode,
      name: name || users[empCode]?.name || empCode,
      password: password !== undefined ? password : (users[empCode]?.password || empCode),
      role: role || users[empCode]?.role || 'user'
    };

    writeUsersToExcel(users);
    return res.json({ success: true, user: users[empCode] });
  });

  // 3. Shift Schedule Upload
  app.post('/api/schedule/upload', (req, res) => {
    const { month, employees } = req.body;
    if (!month || !employees) {
      return res.status(400).json({ error: 'Month and employee schedule data are required.' });
    }

    const schedules = readSchedulesFromExcel();
    schedules[month] = { month, employees };
    writeSchedulesToExcel(schedules);

    // Auto-create user accounts for new employees in the schedule
    const users = readUsersFromExcel();
    let usersUpdated = false;

    for (const empCode of Object.keys(employees)) {
      if (!users[empCode]) {
        users[empCode] = {
          empCode: empCode,
          name: employees[empCode].name,
          password: empCode, // default password is employee code
          role: 'user'
        };
        usersUpdated = true;
      }
    }

    if (usersUpdated) {
      writeUsersToExcel(users);
    }

    return res.json({ success: true, message: `Schedule for ${month} uploaded successfully.` });
  });

  // 4. Get Shift Schedule
  app.get('/api/schedule', (req, res) => {
    const { month } = req.query;
    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required.' });
    }

    const schedules = readSchedulesFromExcel();
    const schedule = schedules[month as string] || { month, employees: {} };
    return res.json(schedule);
  });

  // 5. Update Single Shift Cell
  app.post('/api/schedule/update-shift', (req, res) => {
    const { month, empCode, dayNum, shiftCode } = req.body;
    if (!month || !empCode || dayNum === undefined || shiftCode === undefined) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const schedules = readSchedulesFromExcel();
    if (!schedules[month]) {
      schedules[month] = { month, employees: {} };
    }
    if (!schedules[month].employees[empCode]) {
      schedules[month].employees[empCode] = {
        name: empCode,
        days: {}
      };
    }

    schedules[month].employees[empCode].days[dayNum] = shiftCode;
    writeSchedulesToExcel(schedules);

    return res.json({ success: true });
  });

  // 6. Get Attendance list for a specific Date and Shift
  app.get('/api/attendance', (req, res) => {
    const { date, shift } = req.query;
    if (!date || !shift) {
      return res.status(400).json({ error: 'Date and Shift are required.' });
    }

    const dateStr = date as string;
    const shiftStr = shift as string;
    const [year, monthStr, dayStr] = dateStr.split('-');
    const monthKey = `${year}-${monthStr}`;
    const dayNum = parseInt(dayStr, 10);

    const schedules = readSchedulesFromExcel();
    const attendance = readAttendanceFromExcel();
    const leaves = readLeavesFromExcel();

    const schedule = schedules[monthKey];
    const dailyAttendance = attendance[dateStr] || {};

    if (!schedule) {
      return res.json({ employees: [] });
    }

    const resultEmployees: any[] = [];

    for (const [empCode, empData] of Object.entries(schedule.employees) as any[]) {
      const scheduledShift = empData.days[dayNum];
      if (scheduledShift === shiftStr) {
        const onLeave = leaves.some(l => 
          l.empCode === empCode && 
          l.status === 'Approved' && 
          dateStr >= l.startDate && 
          dateStr <= l.endDate
        );

        const savedRecord = dailyAttendance[empCode];
        
        let status: 'Present' | 'Absent' | 'Leave' = 'Present';
        if (onLeave) {
          status = 'Leave';
        } else if (savedRecord) {
          status = savedRecord.status;
        }

        resultEmployees.push({
          empCode,
          name: empData.name,
          scheduledShift,
          status,
          saved: !!savedRecord
        });
      }
    }

    return res.json({ employees: resultEmployees });
  });

  // 7. Save Attendance
  app.post('/api/attendance', (req, res) => {
    const { date, shift, records } = req.body;
    if (!date || !shift || !records) {
      return res.status(400).json({ error: 'Date, Shift, and Records are required.' });
    }

    const attendance = readAttendanceFromExcel();
    if (!attendance[date]) {
      attendance[date] = {};
    }

    for (const [empCode, status] of Object.entries(records)) {
      attendance[date][empCode] = {
        status,
        shift,
        updatedAt: new Date().toISOString()
      };
    }

    const schedules = readSchedulesFromExcel();
    writeAttendanceToExcel(attendance, schedules);
    return res.json({ success: true });
  });

  // 8. Leave Requests
  app.get('/api/leaves', (req, res) => {
    const leaves = readLeavesFromExcel();
    return res.json(leaves);
  });

  app.post('/api/leaves/apply', (req, res) => {
    const { empCode, empName, startDate, endDate, reason, approverId } = req.body;
    if (!empCode || !empName || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: 'Missing required leave details.' });
    }

    const leaves = readLeavesFromExcel();
    const newLeave = {
      id: 'leave_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      empCode,
      empName,
      startDate,
      endDate,
      reason,
      approverId: approverId || '180044',
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    leaves.push(newLeave);
    writeLeavesToExcel(leaves);
    return res.json({ success: true, leave: newLeave });
  });

  app.post('/api/leaves/approve', (req, res) => {
    const { id, status, approvedBy } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: 'Leave ID and status are required.' });
    }

    const leaves = readLeavesFromExcel();
    const leaveIdx = leaves.findIndex(l => l.id === id);
    if (leaveIdx === -1) {
      return res.status(404).json({ error: 'Leave application not found.' });
    }

    leaves[leaveIdx].status = status;
    leaves[leaveIdx].approvedBy = approvedBy || '180044';
    leaves[leaveIdx].actionDate = new Date().toISOString();

    writeLeavesToExcel(leaves);

    if (status === 'Approved') {
      const attendance = readAttendanceFromExcel();
      const start = new Date(leaves[leaveIdx].startDate);
      const end = new Date(leaves[leaveIdx].endDate);
      const empCode = leaves[leaveIdx].empCode;

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (!attendance[dateStr]) {
          attendance[dateStr] = {};
        }
        attendance[dateStr][empCode] = {
          status: 'Leave',
          leaveId: id,
          updatedAt: new Date().toISOString()
        };
      }
      const schedules = readSchedulesFromExcel();
      writeAttendanceToExcel(attendance, schedules);
    }

    return res.json({ success: true, leave: leaves[leaveIdx] });
  });

  // 9. Dashboard Absentees Stat
  app.get('/api/dashboard/stats', (req, res) => {
    const { date } = req.query;
    const baseDateStr = (date as string) || new Date().toISOString().split('T')[0];

    const schedules = readSchedulesFromExcel();
    const attendance = readAttendanceFromExcel();
    const leaves = readLeavesFromExcel();

    const activeEmployees: Record<string, string> = {};
    for (const sch of Object.values(schedules) as any[]) {
      if (sch.employees) {
        for (const [code, emp] of Object.entries(sch.employees) as any[]) {
          activeEmployees[code] = emp.name;
        }
      }
    }

    const absentees: any[] = [];

    for (const [empCode, name] of Object.entries(activeEmployees)) {
      let consecutiveDays = 0;
      let brokeStreak = false;

      const base = new Date(baseDateStr);
      for (let i = 0; i < 15; i++) {
        const checkDate = new Date(base);
        checkDate.setDate(base.getDate() - i);
        const dateStr = checkDate.toISOString().split('T')[0];

        const dailyRecord = attendance[dateStr];
        if (dailyRecord && dailyRecord[empCode]) {
          const record = dailyRecord[empCode];
          if (record.status === 'Absent') {
            consecutiveDays++;
          } else {
            brokeStreak = true;
            break;
          }
        } else {
          const [year, monthStr, dayStr] = dateStr.split('-');
          const monthKey = `${year}-${monthStr}`;
          const dayNum = parseInt(dayStr, 10);
          const monthSch = schedules[monthKey];
          if (monthSch && monthSch.employees[empCode]) {
            const shift = monthSch.employees[empCode].days[dayNum];
            if (shift === 'WO' || shift === 'H') {
              continue;
            }
          }
        }
      }

      if (consecutiveDays > 0) {
        const matchingLeaves = leaves.filter(l => l.empCode === empCode);
        const activeLeave = matchingLeaves.find(l => baseDateStr >= l.startDate && baseDateStr <= l.endDate);
        const pendingLeave = matchingLeaves.find(l => l.status === 'Pending' && baseDateStr >= l.startDate && baseDateStr <= l.endDate);
        
        let leaveStatus: 'Pending' | 'Approved' | 'None' = 'None';
        let leaveInfo = '';

        if (activeLeave) {
          leaveStatus = 'Approved';
          leaveInfo = `${activeLeave.reason} (${activeLeave.startDate} to ${activeLeave.endDate})`;
        } else if (pendingLeave) {
          leaveStatus = 'Pending';
          leaveInfo = `Applied: ${pendingLeave.reason} (${pendingLeave.startDate} to ${pendingLeave.endDate})`;
        }

        absentees.push({
          empCode,
          name,
          consecutiveDays,
          leaveStatus,
          leaveInfo: leaveInfo || undefined
        });
      }
    }

    absentees.sort((a, b) => b.consecutiveDays - a.consecutiveDays);

    return res.json({ absentees });
  });

  // 10. Get Full Month Attendance (for Export and Attendance Muster)
  app.get('/api/attendance/month', (req, res) => {
    const { month } = req.query;
    if (!month) {
      return res.status(400).json({ error: 'Month is required.' });
    }

    const schedules = readSchedulesFromExcel();
    const attendance = readAttendanceFromExcel();
    const leaves = readLeavesFromExcel();

    const monthStr = month as string;
    const schedule = schedules[monthStr] || { month: monthStr, employees: {} };

    const monthAttendance: Record<string, any> = {};
    for (const [date, records] of Object.entries(attendance)) {
      if (date.startsWith(monthStr)) {
        monthAttendance[date] = records;
      }
    }

    return res.json({
      schedule,
      attendance: monthAttendance,
      leaves
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(console.error);
