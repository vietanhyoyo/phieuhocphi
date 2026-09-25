"use client";

import { useState } from "react";
import { format as formatDateFns } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    <PopoverContent className="w-auto rounded-xl border-slate-200 p-3 shadow-xl" align="start">
      <div className="mb-2 flex items-center justify-between px-1"><p className="text-xs font-semibold text-slate-500">Chọn ngày học</p><Badge variant="secondary">dd/mm/yyyy</Badge></div>
      <Calendar mode="single" selected={selectedDate} onSelect={(date: Date | undefined) => { if (date) { onChange(dateValue(date)); setOpen(false); } }} />
      <Button type="button" variant="secondary" size="sm" className="mt-2 w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100" onClick={() => { onChange(currentDate()); setOpen(false); }}>Về hôm nay</Button>
    </PopoverContent>
  </Popover>;
}
