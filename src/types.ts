export interface Employee {
  empCode: string;
  name: string;
  role: 'user' | 'admin';
}

export interface UserAccount extends Employee {
  password?: string;
}

export interface ShiftSchedule {
  month: string; // "YYYY-MM"
  employees: {
    [empCode: string]: {
      name: string;
      days: {
        [dayNum: number]: string; // "A", "B", "C", "A1", "C1", "G", "H", "WO", etc.
      };
    };
  };
}

export interface AttendanceRecord {
  date: string; // "YYYY-MM-DD"
  shift: string; // e.g. "A", "B", "C", "A1", "C1", "G"
  records: {
    [empCode: string]: {
      name: string;
      status: 'Present' | 'Absent' | 'Leave';
      leaveId?: string;
    };
  };
}

export interface LeaveApplication {
  id: string;
  empCode: string;
  empName: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
  reason: string;
  approverId: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
  approvedBy?: string;
  actionDate?: string;
}

export interface DashboardAbsentee {
  empCode: string;
  name: string;
  consecutiveDays: number;
  leaveStatus?: 'Pending' | 'Approved' | 'None';
  leaveInfo?: string;
}
