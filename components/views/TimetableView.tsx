"use client";

import { useState } from "react";
import {
  CalendarDays,
  Check,
  Pencil,
  Plus,
} from "lucide-react";
import { AppData, TimetableEntry } from "@/lib/types";
import { WEEKDAYS } from "@/lib/timetable";
import { TimetableGrid } from "@/components/shared/TimetableGrid";
import { TimetableDraft, TimetableModal } from "@/components/modals/TimetableModal";
import { ConfirmModal } from "@/components/modals/ConfirmModal";

export function TimetableView({ data, loading, onSave, onDelete, onTitle }: {
  data: AppData; loading: boolean;
  onSave: (entries: TimetableEntry[]) => string | null;
  onDelete: (id: string) => void;
  onTitle: (title: string) => void;
}) {
  const [draft, setDraft] = useState<TimetableDraft | null>(null);
  const [deleting, setDeleting] = useState<TimetableEntry | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const today = new Date().getDay() || 7;
  const activeDays = new Set(data.timetable.map((entry) => entry.dayOfWeek)).size;

  return <div className="view-stack !gap-5">
    <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-indigo-700 via-indigo-600 to-blue-600 p-5 text-white shadow-[0_16px_36px_rgba(67,56,202,0.24)]">
      <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full border border-white/[0.15] shadow-[0_0_0_22px_rgba(255,255,255,0.04),0_0_0_44px_rgba(255,255,255,0.025)]" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <span className="text-[9px] font-extrabold tracking-[0.16em] text-indigo-100">LỊCH DẠY HẰNG TUẦN</span>
          <h2 className="mt-2 font-sans text-[25px] font-bold leading-tight tracking-[-0.04em]">Thời khóa biểu</h2>
          <p className="mt-1.5 text-[11px] leading-5 text-indigo-100/[0.85]">Xem và cập nhật lịch dạy trong tuần</p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/[0.15] ring-1 ring-white/20 backdrop-blur-sm"><CalendarDays size={22} /></span>
      </div>
      <div className="relative mt-5 flex gap-2">
        <span className="rounded-full bg-white/[0.12] px-3 py-1.5 text-[10px] font-bold ring-1 ring-white/[0.15]">{data.timetable.length} ca học</span>
        <span className="rounded-full bg-white/[0.12] px-3 py-1.5 text-[10px] font-bold ring-1 ring-white/[0.15]">{activeDays} ngày có lịch</span>
      </div>
      <div className="relative mt-4">
        <button className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[11px] font-extrabold text-indigo-700 shadow-lg shadow-indigo-950/10 transition active:scale-[0.98]" disabled={loading} onClick={() => setDraft({ dayOfWeek: today })}><Plus size={17} /> Thêm lịch</button>
      </div>
    </section>

    <section className="min-w-0">
      <div className="flex items-start gap-3 pb-3 pt-1">
        {editingTitle ? <form className="min-w-0 flex-1" onSubmit={(event) => { event.preventDefault(); onTitle(titleDraft); setEditingTitle(false); }}>
          <label className="field"><span className="field-label">Tiêu đề bảng</span><input autoFocus value={titleDraft} maxLength={120} onChange={(event) => setTitleDraft(event.target.value)} placeholder="Lịch dạy Toán của Teacher Hiếu" /></label>
          <div className="mt-2 flex justify-end gap-2"><button type="button" className="ghost-button small-button" onClick={() => setEditingTitle(false)}>Hủy</button><button type="submit" className="primary-button small-button" disabled={loading}><Check size={14} /> Lưu</button></div>
        </form> : <>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-extrabold tracking-[0.13em] text-indigo-500">LỊCH TRONG TUẦN</span>
            <h3 className="mt-1 break-words text-[14px] font-extrabold leading-5 text-slate-800">{data.timetableTitle}</h3>
          </div>
          <button className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100" disabled={loading} aria-label="Đổi tiêu đề thời khóa biểu" onClick={() => { setTitleDraft(data.timetableTitle); setEditingTitle(true); }}><Pencil size={15} /></button>
        </>}
      </div>

      <div className="min-w-0">
        {data.timetable.length ? <>
          <div className="w-full overflow-hidden rounded-[4px] border border-indigo-200/90">
            <TimetableGrid entries={data.timetable} mobile disabled={loading} onEdit={(entry) => setDraft({ entry })} />
          </div>
          <p className="mt-2 text-[9px] leading-4 text-slate-400">Chạm vào ô có lịch để chỉnh sửa. Nhãn trên cùng: T2 đến T7 và CN.</p>
        </> : <div className="flex flex-col items-center rounded-[4px] border border-dashed border-indigo-200 bg-indigo-50/40 px-5 py-7 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-100 text-indigo-600"><CalendarDays size={19} /></span>
          <strong className="mt-3 text-[12px] text-slate-700">Tuần này chưa có ca học</strong>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">Thêm lịch để xem thời khóa biểu theo các ngày trong tuần.</p>
          <button className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-[10px] font-extrabold text-white shadow-md shadow-indigo-100" disabled={loading} onClick={() => setDraft({ dayOfWeek: today })}><Plus size={14} /> Thêm ca học</button>
        </div>}
      </div>
    </section>

    {draft && <TimetableModal draft={draft} students={data.students} onClose={() => setDraft(null)} onSave={onSave} onDelete={(entry) => { setDraft(null); setDeleting(entry); }} />}
    {deleting && <ConfirmModal title="Xóa lịch dạy?" message={`Xóa ${deleting.title} vào ${WEEKDAYS[deleting.dayOfWeek - 1]}, ${deleting.startTime} – ${deleting.endTime} khỏi lịch hằng tuần?`} confirmLabel="Xóa lịch" onClose={() => setDeleting(null)} onConfirm={() => { onDelete(deleting.id); setDeleting(null); }} />}
  </div>;
}
