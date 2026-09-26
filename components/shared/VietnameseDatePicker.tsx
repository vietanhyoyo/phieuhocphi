"use client";

import { useState } from "react";
import { format as formatDateFns } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { currentDate, dateValue, parseDateValue } from "@/lib/utils";

export function VietnameseDatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const selectedDate = parseDateValue(value);
  const [open, setOpen] = useState(false);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" className="vi-picker-trigger w-full justify-start bg-slate-50 font-normal text-slate-700 hover:bg-slate-50" aria-label="Chọn ngày học"><CalendarDays className="h-4 w-4 text-slate-400" /><span>{formatDateFns(selectedDate, "dd/MM/yyyy", { locale: vi })}</span><ChevronDown className="ml-auto h-4 w-4 text-slate-400" /></Button>
    </PopoverTrigger>
    <PopoverContent className="vi-date-popover" align="start" sideOffset={8} collisionPadding={12} aria-label="Chọn ngày học">
      <div className="vi-date-heading"><span className="vi-date-heading-icon"><CalendarDays size={18} /></span><div><strong>Chọn ngày học</strong><span>{formatDateFns(selectedDate, "EEEE, dd/MM/yyyy", { locale: vi })}</span></div></div>
      <Calendar mode="single" defaultMonth={selectedDate} selected={selectedDate} labels={{ labelPrevious: () => "Tháng trước", labelNext: () => "Tháng sau" }} formatters={{ formatCaption: (date) => `Tháng ${date.getMonth() + 1} / ${date.getFullYear()}` }} onSelect={(date: Date | undefined) => { if (date) { onChange(dateValue(date)); setOpen(false); } }} />
      <Button type="button" variant="secondary" size="sm" className="vi-date-today" onClick={() => { onChange(currentDate()); setOpen(false); }}>Về hôm nay</Button>
    </PopoverContent>
  </Popover>;
}
