"use client";

import { Plus } from "lucide-react";
import { TimetableEntry } from "@/lib/types";
import { timetableSlots, WEEKDAYS } from "@/lib/timetable";

export function TimetableGrid({ entries, onEdit, onAdd, disabled = false, mobile = false }: {
  entries: TimetableEntry[];
  onEdit?: (entry: TimetableEntry) => void;
  onAdd?: (dayOfWeek: number, startTime: string, endTime: string) => void;
  disabled?: boolean;
  mobile?: boolean;
}) {
  const slots = timetableSlots(entries);
  return <table className={`timetable-grid${mobile ? " timetable-grid-mobile" : ""}`}>
    <thead><tr><th scope="col">Giờ học</th>{WEEKDAYS.map((day, index) => <th scope="col" key={day} aria-label={day}><span className="timetable-day-full">{day}</span><span className="timetable-day-short">{index === 6 ? "CN" : `T${index + 2}`}</span></th>)}</tr></thead>
    <tbody>{slots.map((slot) => <tr key={`${slot.startTime}-${slot.endTime}`}>
      <th scope="row"><span>{slot.startTime}</span><span>– {slot.endTime}</span></th>
      {WEEKDAYS.map((day, index) => {
        const matches = entries.filter((item) => item.dayOfWeek === index + 1 && item.startTime === slot.startTime && item.endTime === slot.endTime);
        return <td key={day} style={matches.length === 1 ? { backgroundColor: matches[0].color } : undefined}>
          {matches.map((entry) => {
            const content = <><strong>{entry.title}</strong><span className="timetable-mode-full">{entry.mode === "online" ? "Online" : "Trực tiếp"}</span><span className="timetable-mode-short">{entry.mode === "online" ? "OL" : "TT"}</span>{entry.studentName && <em>({entry.studentName})</em>}{entry.note && <small>{entry.note}</small>}</>;
            return onEdit ? <button key={entry.id} type="button" className="timetable-cell" style={{ backgroundColor: entry.color }} onClick={() => onEdit(entry)} disabled={disabled} aria-label={`Sửa ${entry.title}, ${day}, ${entry.startTime} – ${entry.endTime}`}>{content}</button>
              : <div key={entry.id} className="timetable-cell" style={{ backgroundColor: entry.color }}>{content}</div>;
          })}
          {!matches.length && onAdd && <button className="timetable-empty-cell" type="button" disabled={disabled} onClick={() => onAdd(index + 1, slot.startTime, slot.endTime)} aria-label={`Thêm lịch ${day}, ${slot.startTime} – ${slot.endTime}`}><Plus size={16} /></button>}
        </td>;
      })}
    </tr>)}</tbody>
  </table>;
}
