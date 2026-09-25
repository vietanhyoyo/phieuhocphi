"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown } from "lucide-react";
import { currentMonth, monthLabel } from "@/lib/utils";

export function VietnameseMonthPicker({ value, onChange, compact = false }: { value: string; onChange: (value: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const selectedYear = Number(value.slice(0, 4));
  const [viewYear, setViewYear] = useState(selectedYear);
  useEffect(() => {
    if (!open) setViewYear(selectedYear);
  }, [selectedYear, open]);
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);
  const monthNames = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
  return <div ref={pickerRef} className="date-picker month-picker" data-compact={compact ? "true" : "false"}>
    <button type="button" className="date-picker-trigger" onClick={() => setOpen((current) => !current)} aria-label="Chọn tháng"><CalendarDays size={15} /><span>{monthLabel(value)}</span><ChevronDown className="date-picker-chevron" size={13} /></button>
    {open && <div className="date-picker-popover month-picker-popover" role="dialog" aria-label="Bộ chọn tháng tiếng Việt"><div className="date-picker-header"><button type="button" onClick={() => setViewYear((current) => current - 1)} aria-label="Năm trước"><ArrowLeft size={15} /></button><strong>Năm {viewYear}</strong><button type="button" onClick={() => setViewYear((current) => current + 1)} aria-label="Năm sau"><ArrowRight size={15} /></button></div><div className="month-grid">{monthNames.map((name, index) => { const monthNumber = index + 1; const monthValueText = `${viewYear}-${String(monthNumber).padStart(2, "0")}`; return <button type="button" key={name} className={monthValueText === value ? "selected" : ""} onClick={() => { onChange(monthValueText); setOpen(false); }}>{name}</button>; })}</div><button type="button" className="today-button" onClick={() => { onChange(currentMonth()); setOpen(false); }}>Về tháng hiện tại</button></div>}
  </div>;
}
