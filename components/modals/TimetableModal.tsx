"use client";

import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { ModalShell } from "@/components/shared/ModalShell";
import { Button } from "@/components/ui/button";
import { VietnameseTimePicker } from "@/components/shared/VietnameseTimePicker";
import { Student, TimetableEntry } from "@/lib/types";
import { isTime, TIMETABLE_COLORS, WEEKDAYS } from "@/lib/timetable";
import { uid } from "@/lib/utils";

export type TimetableDraft = { entry?: TimetableEntry; dayOfWeek?: number; startTime?: string; endTime?: string };

export function TimetableModal({ draft, students, onClose, onSave, onDelete }: {
  draft: TimetableDraft;
  students: Student[];
  onClose: () => void;
  onSave: (entries: TimetableEntry[]) => string | null;
  onDelete: (entry: TimetableEntry) => void;
}) {
  const initial = draft.entry;
  const [days, setDays] = useState<number[]>([initial?.dayOfWeek ?? draft.dayOfWeek ?? 1]);
  const [startTime, setStartTime] = useState(initial?.startTime ?? draft.startTime ?? "08:00");
  const [endTime, setEndTime] = useState(initial?.endTime ?? draft.endTime ?? "09:30");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [studentName, setStudentName] = useState(initial?.studentName ?? "");
  const [mode, setMode] = useState<TimetableEntry["mode"]>(initial?.mode ?? "in-person");
  const [color, setColor] = useState(initial?.color ?? TIMETABLE_COLORS[0].value);
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState("");
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) { setError("Vui lòng nhập môn hoặc tên lớp."); return; }
    if (!days.length) { setError("Chọn ít nhất một ngày trong tuần."); return; }
    if (!isTime(startTime) || !isTime(endTime) || endTime <= startTime) { setError("Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày."); return; }
    const timestamp = new Date().toISOString();
    const message = onSave(days.map((dayOfWeek) => ({ id: initial?.id ?? uid("timetable"), dayOfWeek, startTime, endTime, title: title.trim(), studentName: studentName.trim(), mode, color, note: note.trim(), createdAt: initial?.createdAt ?? timestamp, updatedAt: timestamp })));
    if (message) setError(message); else onClose();
  };
  return <ModalShell title={initial ? "Sửa lịch dạy" : "Thêm lịch dạy"} subtitle="Lặp lại hằng tuần theo các ngày bạn chọn" onClose={onClose} wide>
    <form onSubmit={submit}>
      <div className="modal-form timetable-form">
        <label className="field"><span className="field-label">Môn / lớp</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required placeholder="Ví dụ: Toán 7" /></label>
        <label className="field"><span className="field-label">Học sinh / nhóm học</span><input list="timetable-student-options" value={studentName} onChange={(event) => setStudentName(event.target.value)} maxLength={100} placeholder="Ví dụ: Hoàng" /><datalist id="timetable-student-options">{[...new Set(students.map((student) => student.name))].map((name) => <option key={name} value={name} />)}</datalist></label>
        <fieldset><legend>{initial ? "Ngày trong tuần" : "Các ngày trong tuần"}</legend><div className="timetable-day-options">{WEEKDAYS.map((day, index) => <button key={day} type="button" aria-pressed={days.includes(index + 1)} className={days.includes(index + 1) ? "selected" : ""} onClick={() => setDays(initial ? [index + 1] : days.includes(index + 1) ? days.filter((value) => value !== index + 1) : [...days, index + 1].sort())}>{index === 6 ? "CN" : `T${index + 2}`}</button>)}</div></fieldset>
        <div className="form-grid"><div className="field"><span className="field-label">Bắt đầu</span><VietnameseTimePicker value={startTime} onChange={setStartTime} label="Giờ bắt đầu" /></div><div className="field"><span className="field-label">Kết thúc</span><VietnameseTimePicker value={endTime} onChange={setEndTime} label="Giờ kết thúc" /></div></div>
        <fieldset><legend>Hình thức học</legend><div className="timetable-mode-options">{(["in-person", "online"] as const).map((value) => <button key={value} type="button" className={mode === value ? "selected" : ""} aria-pressed={mode === value} onClick={() => setMode(value)}>{value === "online" ? "Online" : "Trực tiếp"}</button>)}</div></fieldset>
        <fieldset><legend>Màu hiển thị</legend><div className="timetable-color-options">{TIMETABLE_COLORS.map((option) => <button type="button" key={option.value} style={{ backgroundColor: option.value }} aria-label={option.label} aria-pressed={color === option.value} onClick={() => setColor(option.value)}>{color === option.value && <Check size={18} />}</button>)}</div></fieldset>
        <label className="field"><span className="field-label">Ghi chú (không bắt buộc)</span><textarea rows={2} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Địa điểm, phòng học…" /></label>
        {error && <p role="alert" className="form-alert">{error}</p>}
      </div>
      <div className="modal-footer">{initial && <Button type="button" variant="ghost" className="mr-auto text-red-600" onClick={() => onDelete(initial)}><Trash2 size={16} /> Xóa</Button>}<Button type="button" variant="ghost" onClick={onClose}>Hủy</Button><Button type="submit"><Check size={16} /> Lưu lịch</Button></div>
    </form>
  </ModalShell>;
}
