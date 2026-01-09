export type Role = 'ucitel' | 'rodic' | 'ziak';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string;
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
  name: string;
  avatarUrl: string;
  grades: Grade[];
  parentId: string;
  teacherId: string;
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
