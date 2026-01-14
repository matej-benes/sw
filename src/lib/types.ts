import { Timestamp } from "firebase/firestore";

export type Role = 'ucitel' | 'rodic' | 'ziak' | 'administrator' | 'vedouci pracovnik' | 'asistent pedagoga' | 'vedouci skupiny' | 'hlavni vedouci skupiny' | 'clen';
export type OrganizationType = 'skola' | 'zajmova_skupina';

export interface Organization {
  id: string;
  name: string;
  ownerId: string;
  status: 'trial' | 'active' | 'expired';
  trialEndDate?: string; // YYYY-MM-DDTHH:mm:ss
  registrationPin?: string | null;
  type: OrganizationType;
}

export interface User {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  avatarUrl?: string;
  studentId?: string; 
  pin?: string | null;
  isSuperAdmin?: boolean;
  organizationId?: string;

  // Student-specific data (matrika)
  rodneCislo?: string;
  datumNarozeni?: string; // YYYY-MM-DD
  rodnePrijmeni?: string;
  mistoNarozeni?: string;
  statNarozeni?: string;
  pohlavi?: 'Muž' | 'Žena';
  rodinnyStav?: 'Svobodný/Svobodná' | 'Ženatý/Vdaná' | 'Rozvedený/Rozvedená';
  stav?: 'Aktivní' | 'Neaktivní' | 'Přerušené' | 'Absolvent';
  okresNarozeni?: string;
  plnolety?: boolean;
  pocetDeti?: number;
  cisloOP?: string;
  cisloPasu?: string;
  osobniEmail?: string;
  skolniEmail?: string;
  oborVzdelani?: string;
  cvtv?: string;
  tridaId?: string;
  password?: string; // Only for form handling, should not be stored in Firestore
}

export interface Grading {
  id: string;
  organizationId: string;
  datum: string; // YYYY-MM-DD
  cas: string;   // HH:MM
  ziakId: string;
  ziakJmeno: string;
  predmet: string;
  predmetId: string;
  znamka: number;
  vaha: number;
  komentar: string;
  ucitelId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  tridaId: string;
}


export interface Trida {
    id: string;
    organizationId: string;
    nazev: string;
    ucitelId: string;
    zastupciIds?: string[];
    asistentiIds?: string[];
    ziaciIds: string[];
}

export interface Predmet {
  id: string;
  organizationId: string;
  name: string;
  shortcut: string;
  teacherCount: number;
}

export interface Ucebna {
  id: string;
  organizationId: string;
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
  ucebnaId?: string;
  ucebnaName?: string;
}

export type ScheduleGrid = {
  [day: string]: {
    [period: number]: LessonBlock | null;
  };
};

export interface Rozvrh {
    id: string;
    organizationId: string;
    tridaId: string;
    datum: string; // YYYY-MM-DD
    timeSlots: string[];
    hodiny: (LessonBlock | null)[];
}

export interface StorableDay {
    dayIndex: number;
    lessons: (LessonBlock | null)[];
}

export interface ScheduleTemplate {
    id: string; // Should be the same as tridaId
    organizationId: string;
    tridaId: string;
    timeSlots: string[];
    days: StorableDay[];
}


export interface DailySchedule {
    date: Date;
    timeSlots: string[];
    lessons: (LessonBlock | null)[];
}


export interface PoznamkaZaka {
  id: string;
  organizationId: string;
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
  organizationId: string;
  nazev: string;
  typ: string;
  datum: string; // YYYY-MM-DD
  cas: string; // HH:MM
  tridyIds: string[];
  uciteleIds: string[];
  nahrazujeHodiny?: boolean;
}

export type SubstitutionType = 'zmena-ucitele' | 'zmena-ucebny' | 'zruseno' | 'spojeno';

export interface Substitution {
    id: string;
    organizationId: string;
    date: string; // YYYY-MM-DD
    originalLesson: {
        day: string;
        period: number;
        classId: string;
        lessonBlock: LessonBlock;
    };
    changes: {
        teacherId?: string;
        ucebnaId?: string;
        subjectId?: string;
        note?: string;
        type: SubstitutionType | SubstitutionType[];
    };
}

export interface Message {
    id: string;
    organizationId: string;
    senderId: string;
    recipientIds: string[];
    text: string;
    createdAt: any; // Firestore Timestamp
    readBy: string[]; // List of user IDs who have read the message
}

export type AttendanceStatus = '-' | '/' | 'O' | 'N' | 'S';

export interface ZapisHodiny {
    id: string; // e.g., {tridaId}-{datum}-{hodina}
    organizationId: string;
    tridaId: string;
    datum: string; // YYYY-MM-DD
    hodina: string; // period number
    predmetId: string;
    ucitelId: string;
    topic: string;
    note?: string;
    attendance: {
        studentId: string;
        status: AttendanceStatus;
        reason?: string;
    }[];
}

export interface Absence {
    id: string;
    organizationId: string;
    studentId: string;
    tridaId: string;
    datum: string; // YYYY-MM-DD
    hodina: string; // period number
    predmetId: string;
    ucitelId: string;
    status: AttendanceStatus;
    omluvenkaId?: string;
}


export interface Omluvenka {
    id: string;
    organizationId: string;
    studentId: string;
    parentId?: string;
    tridaId: string;
    datumOd: string; // YYYY-MM-DD
    datumDo: string; // YYYY-MM-DD
    duvod: string;
    status: 'pending' | 'approved' | 'rejected';
    datumPodani: any; // Firestore Timestamp
    vyjadreniUcitele?: string;
}

export interface DomaciUkol {
    id: string;
    organizationId: string;
    tridaId: string;
    predmetId: string;
    ucitelId: string;
    nazev: string;
    popis: string;
    datumZadani: string; // YYYY-MM-DD
    terminOdevzdani: string; // YYYY-MM-DD
    prilohy?: string[];
}

export interface PrijimaciRizeni {
    id: string;
    organizationId: string;
    jmenoDitete: string;
    datumNarozeniDitete: string; // YYYY-MM-DD
    bydlisteDitete: string;
    jmenoZastupce: string;
    emailZastupce: string;
    telefonZastupce: string;
    datumPodani: string; // YYYY-MM-DD HH:MM
    status: 'Podáno' | 'Přijato' | 'Nepřijato' | 'Odklad' | 'Převedeno do matriky';
}

export interface ZaznamSchuzky {
    id: string;
    organizationId: string;
    datum: string; // YYYY-MM-DD
    cas: string; // HH:MM
    topic: string;
    notes?: string;
    createdBy: string;
    createdAt: Timestamp;
}

    
