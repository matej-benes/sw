export type Role = 'ucitel' | 'rodic' | 'ziak' | 'administrator' | 'vedouci pracovnik';

export interface User {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  avatarUrl?: string;
  tridaId?: string; // Class for student or teacher
  studentId?: string; // For parent role
}

export interface Grade {
  id: string;
  subject: string;
  grade: number;
  date: string;
  notes?: string;
}

export interface Student {
  id: string;
  name:string;
  avatarUrl: string;
  grades: Grade[];
  parentId: string;
  teacherId: string;
  classId: string;
}

export interface Lesson {
  time: string;
  subject: string;
  teacher?: string;
  class?: string;
  room: string;
}

export type DaySchedule = Lesson[];

export type Timetable = {
  [day: string]: DaySchedule;
};
