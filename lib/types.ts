export type View = "home" | "lessons" | "students" | "tuition" | "timetable" | "settings";
export type NoticeType = "success" | "error";
export type Notice = { type: NoticeType; message: string } | null;
export type AuthUser = { id: string; username: string };
export type StudentDraft = {
  name: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  note: string;
  assignments: Record<string, { active: boolean; fee: number; duration: number }>;
};

export interface Subject {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  id: string;
  name: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  note?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudentSubject {
  id: string;
  studentId: string;
  subjectId: string;
  defaultFee: number;
  defaultDurationMinutes: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Lesson {
  id: string;
  studentId: string;
  subjectId: string;
  lessonDate: string;
  startTime: string;
  durationMinutes: number;
  fee: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimetableEntry {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  title: string;
  studentName: string;
  mode: "in-person" | "online";
  color: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  version: number;
  subjects: Subject[];
  students: Student[];
  studentSubjects: StudentSubject[];
  lessons: Lesson[];
  timetable: TimetableEntry[];
  timetableTitle: string;
}

export interface MonthlySubjectSummary {
  subjectId: string;
  subjectName: string;
  lessonCount: number;
  totalFee: number;
  totalDurationMinutes: number;
  fees: number[];
}

export interface MonthlyStudentSummary {
  studentId: string;
  month: string;
  totalLessonCount: number;
  totalDurationMinutes: number;
  totalFee: number;
  lessonDates: string[];
  subjects: MonthlySubjectSummary[];
}
