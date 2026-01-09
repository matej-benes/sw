export type Role = 'ucitel' | 'rodic' | 'ziak' | 'administrator' | 'vedouci pracovnik';

export interface User {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  avatarUrl?: string;
  tridaId?: string; // Class for student or teacher
  studentId?: string; // For parent role
  pin?: string; // 6-digit PIN for registration
}

export interface Znamka {
  id: string;
  studentId: string;
  predmet: string;
  hodnota: number;
  datum: string;
  ucitelId: string;
  slovniHodnoceni?: string;
  tema?: string;
  druhHodnoceni?: string;
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

export interface Trida {
    id: string;
    nazev: string;
    ucitelId: string;
    ziaciIds: string[];
}

export interface Predmet {
  id: string;
  name: string;
  shortcut: string;
}

export interface Ucebna {
  id: string;
  nazev: string;
  kapacita?: number;
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

export interface LessonBlock {
  id: string;
  subjectId: string;
  teacherId: string;
  classId: string;
  subjectName: string;
  subjectShortcut: string;
  teacherName: string;
  className: string;
}

export type ScheduleGrid = {
  [day: string]: {
    [period: number]: LessonBlock | null;
  };
};

export interface Rozvrh {
    id: string;
    scheduleData: ScheduleGrid;
    timeSlots: string[];
}


export interface PoznamkaZaka {
  id: string;
  studentId: string;
  tridaId: string;
  predmet?: string;
  datum: string;
  druh: string;
  text: string;
  ucitelId: string;
  datumPodpisu?: string;
}

export interface Udalost {
  id: string;
  nazev: string;
  typ: string;
  datum: string; // YYYY-MM-DD
  cas: string; // HH:MM
  tridyIds: string[];
  uciteleIds: string[];
}
