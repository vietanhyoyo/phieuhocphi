import { TimetableEntry } from "@/lib/types";

export const WEEKDAYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
export const TIMETABLE_COLORS = [
  { value: "#fef08a", label: "Vàng" },
  { value: "#fdba74", label: "Cam" },
  { value: "#67e8f9", label: "Xanh dương" },
  { value: "#bbf7d0", label: "Xanh lá" },
  { value: "#ddd6fe", label: "Tím" },
  { value: "#fbcfe8", label: "Hồng" },
];
export const isTime = (value: unknown): value is string => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export function isTimetableEntry(value: unknown): value is TimetableEntry {
  if (!value || typeof value !== "object") return false;
  const item = value as TimetableEntry;
  return typeof item.id === "string" && !!item.id && Number.isInteger(item.dayOfWeek) && item.dayOfWeek >= 1 && item.dayOfWeek <= 7
    && isTime(item.startTime) && isTime(item.endTime) && item.startTime < item.endTime
    && typeof item.title === "string" && !!item.title.trim() && item.title.length <= 100
    && typeof item.studentName === "string" && item.studentName.length <= 100
    && (item.mode === "in-person" || item.mode === "online")
    && TIMETABLE_COLORS.some((color) => color.value === item.color)
    && typeof item.note === "string" && item.note.length <= 300
    && typeof item.createdAt === "string" && typeof item.updatedAt === "string";
}

export function timetableConflict(entries: TimetableEntry[], candidate: Pick<TimetableEntry, "id" | "dayOfWeek" | "startTime" | "endTime">) {
  return entries.find((item) => item.id !== candidate.id && item.dayOfWeek === candidate.dayOfWeek
    && candidate.startTime < item.endTime && candidate.endTime > item.startTime);
}

export function timetableSlots(entries: TimetableEntry[]) {
  return [...new Set(entries.map((item) => `${item.startTime}|${item.endTime}`))].sort().map((slot) => {
    const [startTime, endTime] = slot.split("|");
    return { startTime, endTime };
  });
}
