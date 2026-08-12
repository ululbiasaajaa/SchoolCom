export type CategoryType = 'Observation' | 'Behavior' | 'Academic' | 'Social' | 'Incident' | 'Other';
export type PriorityType = 'Low' | 'Medium' | 'High';
export type StatusType = 'Pending' | 'Follow-up' | 'Resolved';

export interface Parent {
  name: string;
  relationship: string;
  phone: string;
}

export interface Student {
  id: string;
  name: string;
  avatar: string;
  className: string;
  dob: string;
  parents: Parent[];
}

export interface FollowUpLog {
  id: string;
  note: string;
  updatedAt: string;
}

export interface Incident {
  id: string;
  studentId: string;
  category: CategoryType;
  priority: PriorityType;
  description: string;
  actionTaken: string;
  status: StatusType;
  createdAt: string;
  teacherName: string;
  followUpLogs: FollowUpLog[];
}