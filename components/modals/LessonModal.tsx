"use client";

import { useState } from "react";
import { AlertTriangle, BookOpen, CalendarDays, Check, CircleDollarSign, Clock3, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ModalShell } from "@/components/shared/ModalShell";
import { Field } from "@/components/shared/Field";
import { VietnameseDatePicker } from "@/components/shared/VietnameseDatePicker";
import { VietnameseTimePicker } from "@/components/shared/VietnameseTimePicker";
import { AppData, Lesson } from "@/lib/types";
import { currentDate, currentTime, uid } from "@/lib/utils";

export function LessonModal({ data, initial, onClose, onSave }: { data: AppData; initial: Lesson | null; onClose: () => void; onSave: (lesson: Lesson) => void }) {
  const [studentId, setStudentId] = useState(initial?.studentId ?? data.students.find((student) => student.active)?.id ?? "");
  const studentConfigs = data.studentSubjects.filter((item) => item.studentId === studentId && item.active);
  const initialConfig = studentConfigs.find((item) => item.subjectId === initial?.subjectId) ?? studentConfigs[0];
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? initialConfig?.subjectId ?? "");
  const config = studentConfigs.find((item) => item.subjectId === subjectId);
  const [lessonDate, setLessonDate] = useState(initial?.lessonDate ?? currentDate());
  const [startTime, setStartTime] = useState(initial?.startTime ?? currentTime());
  const [duration, setDuration] = useState(String(initial?.durationMinutes ?? config?.defaultDurationMinutes ?? 90));
  const [fee, setFee] = useState(String(initial?.fee ?? config?.defaultFee ?? 0));
  const [note, setNote] = useState(initial?.note ?? "");
  const setStudent = (id: string) => { setStudentId(id); const next = data.studentSubjects.find((item) => item.studentId === id && item.active); setSubjectId(next?.subjectId ?? ""); setDuration(String(next?.defaultDurationMinutes ?? 90)); setFee(String(next?.defaultFee ?? 0)); };
  const submit = () => { if (!studentId || !subjectId || !lessonDate || !startTime) return; onSave({ id: initial?.id ?? uid("lesson"), studentId, subjectId, lessonDate, startTime, durationMinutes: Number(duration) || 0, fee: Number(fee) || 0, note: note.trim(), createdAt: initial?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() }); };
  const changeSubject = (id: string) => {
    setSubjectId(id);
    const next = data.studentSubjects.find((item) => item.studentId === studentId && item.subjectId === id);
    setDuration(String(next?.defaultDurationMinutes ?? 90));
    setFee(String(next?.defaultFee ?? 0));
  };

  return <ModalShell title={initial ? "Sửa buổi dạy" : "Ghi nhận buổi dạy"} subtitle={initial ? "Cập nhật lại thông tin buổi học" : "Lưu lại những gì vừa diễn ra"} onClose={onClose} wide>
    <div className="space-y-5">
      <Field label="Học sinh" icon={<Users className="h-4 w-4" />}>
        <Select value={studentId} onValueChange={setStudent}>
          <SelectTrigger aria-label="Học sinh"><SelectValue placeholder="Chọn học sinh" /></SelectTrigger>
          <SelectContent>{data.students.filter((student) => student.active || student.id === initial?.studentId).map((student) => <SelectItem key={student.id} value={student.id}>{student.name}</SelectItem>)}</SelectContent>
        </Select>
      </Field>

      {studentId && <Field label="Môn học" icon={<BookOpen className="h-4 w-4" />}>
        <Select value={subjectId} onValueChange={changeSubject}>
          <SelectTrigger aria-label="Môn học"><SelectValue placeholder="Chọn môn học" /></SelectTrigger>
          <SelectContent>{studentConfigs.map((item) => <SelectItem key={item.subjectId} value={item.subjectId}>{data.subjects.find((subject) => subject.id === item.subjectId)?.name ?? "Môn đã lưu"}</SelectItem>)}</SelectContent>
        </Select>
      </Field>}

      {studentId && !studentConfigs.length && <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Học sinh này chưa được gán môn học. Hãy thêm môn trong hồ sơ học sinh trước.</div>}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Ngày học" icon={<CalendarDays className="h-4 w-4" />}><VietnameseDatePicker value={lessonDate} onChange={setLessonDate} /></Field>
        <Field label="Giờ bắt đầu" icon={<Clock3 className="h-4 w-4" />}><VietnameseTimePicker value={startTime} onChange={setStartTime} /></Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Thời lượng" icon={<Clock3 className="h-4 w-4" />}><div className="relative"><Input type="number" min="1" step="5" value={duration} onChange={(event) => setDuration(event.target.value)} className="pr-12" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400">phút</span></div></Field>
        <Field label="Học phí" icon={<CircleDollarSign className="h-4 w-4" />}><div className="relative"><Input type="number" min="0" step="1000" value={fee} onChange={(event) => setFee(event.target.value)} className="pr-8" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400">đ</span></div><p className="mt-1 text-[9px] text-slate-400">Lưu riêng cho buổi này</p></Field>
      </div>

      <Field label="Ghi chú" icon={<FileText className="h-4 w-4" />}><Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: Ôn tập chương 2…" /></Field>
    </div>
    <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
      <Button type="button" variant="ghost" onClick={onClose} className="text-slate-500">Hủy</Button>
      <Button type="button" disabled={!studentId || !subjectId || !studentConfigs.length} onClick={submit} className="rounded-xl px-5 shadow-lg shadow-indigo-200"><Check className="h-4 w-4" /> {initial ? "Lưu thay đổi" : "Xác nhận buổi dạy"}</Button>
    </div>
  </ModalShell>;
}
