"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { currentMonth, monthLabel } from "@/lib/utils";

export function VietnameseMonthPicker({ value, onChange, compact = false }: { value: string; onChange: (value: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const selectedYear = Number(value.slice(0, 4));
  const [viewYear, setViewYear] = useState(selectedYear);
  useEffect(() => {
    if (!open) setViewYear(selectedYear);
  }, [selectedYear, open]);
  const monthNames = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
  return <div className="date-picker month-picker" data-compact={compact ? "true" : "false"}>
    <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><button type="button" className="date-picker-trigger" aria-label="Chọn tháng"><CalendarDays size={15} /><span>{monthLabel(value)}</span><ChevronDown className="date-picker-chevron" size={13} /></button></PopoverTrigger>
    <PopoverContent className="month-picker-popover" align="end" sideOffset={8} collisionPadding={12} aria-label="Bộ chọn tháng tiếng Việt"><div className="date-picker-header"><button type="button" onClick={() => setViewYear((current) => current - 1)} aria-label="Năm trước"><ArrowLeft size={15} /></button><strong>Năm {viewYear}</strong><button type="button" onClick={() => setViewYear((current) => current + 1)} aria-label="Năm sau"><ArrowRight size={15} /></button></div><div className="month-grid">{monthNames.map((name, index) => { const monthNumber = index + 1; const monthValueText = `${viewYear}-${String(monthNumber).padStart(2, "0")}`; return <button type="button" key={name} className={monthValueText === value ? "selected" : ""} onClick={() => { onChange(monthValueText); setOpen(false); }}>{name}</button>; })}</div><button type="button" className="today-button" onClick={() => { onChange(currentMonth()); setOpen(false); }}>Về tháng hiện tại</button></PopoverContent>
    </Popover>
  </div>;
}
