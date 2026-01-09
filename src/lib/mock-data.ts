import type { User, Student, Role, Timetable } from './types';

export const mockUsers: User[] = [
  { 
    id: 'user-0', 
    name: 'Matěj Mikolášek', 
    email: 'matej.romana@seznam.cz', 
    roles: ['administrator', 'ucitel', 'vedouci pracovnik'], 
    avatarUrl: 'https://picsum.photos/seed/avatar0/100/100',
    tridaId: 'trida-1'
  },
  { 
    id: 'user-1', 
    name: 'Robert Bartošek', 
    email: 'bartosekr@szs-bukovany.cz', 
    roles: ['ucitel'], 
    avatarUrl: 'https://picsum.photos/seed/avatar1/100/100',
    tridaId: 'trida-4'
  },
  { 
    id: 'user-2', 
    name: 'Anna Volná', 
    email: 'volnaa@szs-bukovany.cz', 
    roles: ['rodic'], 
    avatarUrl: 'https://picsum.photos/seed/avatar2/100/100',
    studentId: 'user-3',
    tridaId: 'trida-4'
  },
  { 
    id: 'user-3', 
    name: 'Adam Volný', 
    email: 'volnya@szs-bukovany.cz', 
    roles: ['ziak'], 
    avatarUrl: 'https://picsum.photos/seed/avatar3/100/100',
    tridaId: 'trida-4'
  },
];

export const mockStudents: Student[] = [
  {
    id: 'student-1',
    name: 'Adam Volný',
    avatarUrl: 'https://picsum.photos/seed/avatar3/100/100',
    parentId: 'user-2',
    teacherId: 'user-1',
    classId: 'trida-4',
    grades: [
      { id: 'grade-1', subject: 'Matematika', grade: 2, date: '2024-05-20', notes: 'Písemná práce.' },
      { id: 'grade-2', subject: 'Anglický jazyk', grade: 1, date: '2024-05-18', notes: 'Slovíčka.' },
      { id: 'grade-3', subject: 'Dějepis', grade: 3, date: '2024-05-15', notes: 'Test z novověku.' },
    ],
  },
    {
    id: 'student-2',
    name: 'Eva Svobodová',
    avatarUrl: 'https://picsum.photos/seed/avatar4/100/100',
    parentId: 'user-x',
    teacherId: 'user-1',
    classId: 'trida-4',
    grades: [
      { id: 'grade-5', subject: 'Matematika', grade: 2, date: '2024-05-20' },
      { id: 'grade-6', subject: 'Český jazyk', grade: 1, date: '2024-05-18', notes: 'Skvělá interpretace básně.' },
    ],
  },
  {
    id: 'student-3',
    name: 'Pavel Černý',
    avatarUrl: 'https://picsum.photos/seed/avatar5/100/100',
    parentId: 'user-y',
    teacherId: 'user-1',
    classId: 'trida-4',
    grades: [
      { id: 'grade-7', subject: 'Matematika', grade: 4, date: '2024-05-20', notes: 'Nedostatečná domácí příprava.' },
      { id: 'grade-8', subject: 'Dějepis', grade: 2, date: '2024-05-19' },
    ],
  },
];

export const mockStudentTimetable: Timetable = {
  'Pondělí': [
    { time: '8:00-8:45', subject: 'Český jazyk', teacher: 'Mgr. Dvořáčková', room: 'ČJ2' },
    { time: '9:00-9:45', subject: 'Matematika', teacher: 'Mgr. Bartošek', room: 'M1' },
    { time: '10:00-10:45', subject: 'Tělesná výchova', teacher: 'Mgr. Sportovec', room: 'Tělocvična' },
    { time: '11:00-11:45', subject: 'Fyzika', teacher: 'Mgr. Procházka', room: 'F1' },
  ],
  'Úterý': [
    { time: '8:00-8:45', subject: 'Dějepis', teacher: 'Mgr. Černý', room: 'D5' },
    { time: '9:00-9:45', subject: 'Chemie', teacher: 'Ing. Růžičková', room: 'CHL' },
    { time: '10:00-10:45', subject: 'Matematika', teacher: 'Mgr. Bartošek', room: 'M1' },
    { time: '11:00-11:45', subject: 'Český jazyk', teacher: 'Mgr. Dvořáčková', room: 'ČJ2' },
  ],
  'Středa': [
    { time: '9:00-9:45', subject: 'Anglický jazyk', teacher: 'Mr. Smith', room: 'A3' },
    { time: '10:00-10:45', subject: 'Fyzika', teacher: 'Mgr. Procházka', room: 'F1' },
    { time: '11:00-11:45', subject: 'Tělesná výchova', teacher: 'Mgr. Sportovec', room: 'Tělocvična' },
    { time: '12:00-12:45', subject: 'Hudební výchova', teacher: 'Mgr. Zpěvavá', room: 'HV' },
  ],
  'Čtvrtek': [
    { time: '8:00-8:45', subject: 'Matematika', teacher: 'Mgr. Bartošek', room: 'M1' },
    { time: '9:00-9:45', subject: 'Český jazyk', teacher: 'Mgr. Dvořáčková', room: 'ČJ2' },
    { time: '10:00-10:45', subject: 'Chemie', teacher: 'Ing. Růžičková', room: 'CHL' },
    { time: '11:00-11:45', subject: 'Dějepis', teacher: 'Mgr. Černý', room: 'D5' },
  ],
  'Pátek': [
    { time: '8:00-8:45', subject: 'Anglický jazyk', teacher: 'Mr. Smith', room: 'A3' },
    { time: '9:00-9:45', subject: 'Fyzika', teacher: 'Mgr. Procházka', room: 'F1' },
    { time: '10:00-10:45', subject: 'Výtvarná výchova', teacher: 'Mgr. Malíř', room: 'VV' },
  ],
};

export const mockTeacherTimetable: Timetable = {
  'Pondělí': [
    { time: '8:00-8:45', subject: 'Matematika', class: '8.A', room: 'M1' },
    { time: '9:00-9:45', subject: 'Matematika', class: '9.B', room: 'M1' },
    { time: '10:00-10:45', subject: 'Volná hodina', room: 'Kabinet' },
    { time: '11:00-11:45', subject: 'Matematika', class: '7.C', room: 'M2' },
  ],
  'Úterý': [
    { time: '10:00-10:45', subject: 'Matematika', class: '8.A', room: 'M1' },
    { time: '11:00-11:45', subject: 'Matematika', class: '9.B', room: 'M1' },
  ],
  'Středa': [
    { time: '8:00-8:45', subject: 'Dozor', room: 'Chodba 1. patro' },
    { time: '9:00-9:45', subject: 'Matematika', class: '7.C', room: 'M2' },
    { time: '10:00-10:45', subject: 'Volná hodina', room: 'Kabinet' },
  ],
  'Čtvrtek': [
    { time: '8:00-8:45', subject: 'Matematika', class: '8.A', room: 'M1' },
    { time: '9:00-9:45', subject: 'Konzultace', room: 'Kabinet' },
    { time: '10:00-10:45', subject: 'Matematika', class: '9.B', room: 'M1' },
  ],
  'Pátek': [
    { time: '8:00-8:45', subject: 'Volná hodina', room: 'Kabinet' },
    { time: '9:00-9:45', subject: 'Matematika', class: '7.C', room: 'M2' },
    { time: '10:00-10:45', subject: 'Třídnická hodina', class: '8.A', room: 'M1' },
  ],
};

export function getMockUserByEmail(email: string): User | undefined {
  return mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
}

export function getStudentForParent(parentId: string): Student | undefined {
  return mockStudents.find(s => s.parentId === parentId);
}

export function getStudentById(studentId: string): Student | undefined {
  return mockStudents.find(s => s.id === studentId);
}
