"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { currentMonth, monthLabel, monthSelectionLabel } from "@/lib/utils";

const monthNames = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

export function VietnameseMultiMonthPicker({ value, onChange, compact = false }: { value: string[]; onChange: (value: string[]) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const selectedYear = Number(value[value.length - 1]?.slice(0, 4)) || Number(currentMonth().slice(0, 4));
  const [viewYear, setViewYear] = useState(selectedYear);

  useEffect(() => {
    if (!open) setViewYear(selectedYear);
  }, [selectedYear, open]);

  const toggleMonth = (month: string) => {
    const next = value.includes(month) ? value.filter((item) => item !== month) : [...value, month];
    onChange(next.sort());
  };

  return <div className="date-picker month-picker" data-compact={compact ? "true" : "false"}>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="date-picker-trigger" aria-label="Chọn các tháng">
          <CalendarDays size={15} />
          <span>{monthSelectionLabel(value)}</span>
          <ChevronDown className="date-picker-chevron" size={13} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="month-picker-popover multi-month-picker-popover" align="end" sideOffset={8} collisionPadding={12} aria-label="Bộ chọn nhiều tháng tiếng Việt">
        <div className="date-picker-header">
          <button type="button" onClick={() => setViewYear((year) => year - 1)} aria-label="Năm trước"><ArrowLeft size={15} /></button>
          <strong>Năm {viewYear}</strong>
          <button type="button" onClick={() => setViewYear((year) => year + 1)} aria-label="Năm sau"><ArrowRight size={15} /></button>
        </div>
        <div className="month-grid">
          {monthNames.map((name, index) => {
            const month = `${viewYear}-${String(index + 1).padStart(2, "0")}`;
            const selected = value.includes(month);
            return <button type="button" key={month} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => toggleMonth(month)}>{name}</button>;
          })}
        </div>
        <button type="button" className="today-button" onClick={() => onChange([currentMonth()])}>Chỉ xem tháng hiện tại</button>
        <div className="multi-month-footer">
          <span aria-live="polite">{value.length ? `${value.length} tháng được chọn` : "Chưa chọn tháng"}</span>
          <button type="button" onClick={() => setOpen(false)}>Xong</button>
        </div>
        {value.length > 0 && <div className="multi-month-selection" title={value.map(monthLabel).join(", ")}>{value.map(monthLabel).join(" · ")}</div>}
      </PopoverContent>
    </Popover>
  </div>;
}
