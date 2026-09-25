import { AppData, Lesson, MonthlyStudentSummary, MonthlySubjectSummary, StudentDraft } from "./types";

export function uid(prefix = "id") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatCurrency(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(safeValue);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Number.isFinite(value) ? value : 0);
}

export function formatDate(date: string, options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit" }) {
  return new Intl.DateTimeFormat("vi-VN", options).format(new Date(`${date}T12:00:00`));
}

export function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

export function currentDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function currentTime() {
  return new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function currentMonth() {
  return currentDate().slice(0, 7);
}

export function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-");
  return `Tháng ${Number(monthNumber)} / ${year}`;
}

export function minutesLabel(minutes: number) {
  const safeMinutes = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  if (safeMinutes < 60) return `${safeMinutes} phút`;
  const hours = Math.floor(safeMinutes / 60);
  const rest = safeMinutes % 60;
  return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
}

export function getMonthlySummary(data: AppData, month: string, studentId?: string): MonthlyStudentSummary[] {
  const lessons = data.lessons.filter((lesson) => lesson.lessonDate.startsWith(month) && (!studentId || lesson.studentId === studentId));
  const grouped = new Map<string, Lesson[]>();
  lessons.forEach((lesson) => grouped.set(lesson.studentId, [...(grouped.get(lesson.studentId) ?? []), lesson]));
  return [...grouped.entries()].map(([id, studentLessons]) => {
    const subjectMap = new Map<string, Lesson[]>();
    studentLessons.forEach((lesson) => subjectMap.set(lesson.subjectId, [...(subjectMap.get(lesson.subjectId) ?? []), lesson]));
    const subjects: MonthlySubjectSummary[] = [...subjectMap.entries()].map(([subjectId, subjectLessons]) => {
      const subject = data.subjects.find((item) => item.id === subjectId);
      return {
        subjectId,
        subjectName: subject?.name ?? "Môn đã lưu",
        lessonCount: subjectLessons.length,
        totalFee: subjectLessons.reduce((sum, item) => sum + item.fee, 0),
        totalDurationMinutes: subjectLessons.reduce((sum, item) => sum + item.durationMinutes, 0),
        fees: subjectLessons.map((item) => item.fee),
      };
    });
    return {
      studentId: id,
      month,
      totalLessonCount: studentLessons.length,
      totalDurationMinutes: studentLessons.reduce((sum, item) => sum + item.durationMinutes, 0),
      totalFee: studentLessons.reduce((sum, item) => sum + item.fee, 0),
      lessonDates: [...new Set(studentLessons.map((item) => item.lessonDate))].sort(),
      subjects,
    };
  }).sort((a, b) => b.totalFee - a.totalFee);
}

export function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function sortLessonsNewestFirst(lessons: Lesson[]) {
  return [...lessons].sort((a, b) => `${b.lessonDate} ${b.startTime}`.localeCompare(`${a.lessonDate} ${a.startTime}`));
}

export function moneyInputValue(value: number) {
  return value ? String(value) : "";
}

export function parseDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1);
}

export function dateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function emptyStudentDraft(): StudentDraft {
  return { name: "", phone: "", parentName: "", parentPhone: "", note: "", assignments: {} };
}
