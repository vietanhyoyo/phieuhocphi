"use client";

import { useState } from "react";
import { Check, ChevronDown, Clock3, Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { currentTime } from "@/lib/utils";

function TimeStepper({ label, value, onDecrease, onIncrease }: { label: string; value: string; onDecrease: () => void; onIncrease: () => void }) {
  return <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-2 text-center">
    <Label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</Label>
    <strong className="my-1 block text-2xl tabular-nums text-slate-800">{value}</strong>
    <div className="grid grid-cols-2 gap-1">
      <Button type="button" variant="outline" size="icon" className="h-9 w-full rounded-xl bg-white" onClick={onDecrease} aria-label={`Giảm ${label.toLowerCase()}`}><Minus className="h-4 w-4" /></Button>
      <Button type="button" variant="outline" size="icon" className="h-9 w-full rounded-xl bg-white" onClick={onIncrease} aria-label={`Tăng ${label.toLowerCase()}`}><Plus className="h-4 w-4" /></Button>
    </div>
  </div>;
}

export function VietnameseTimePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hour = "09", minute = "00"] = (value || "09:00").split(":");
  const updateTime = (nextHour: number, nextMinute: number) => {
    const totalMinutes = ((nextHour * 60 + nextMinute) % 1440 + 1440) % 1440;
    onChange(`${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`);
  };
  const changeHour = (amount: number) => updateTime(Number(hour) + amount, Number(minute));
  const changeMinute = (amount: number) => updateTime(Number(hour), Number(minute) + amount);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" className="vi-picker-trigger w-full justify-start bg-slate-50 font-normal text-slate-700 hover:bg-slate-50" aria-label="Chọn giờ bắt đầu"><Clock3 className="h-4 w-4 text-slate-400" /><span>{value || "09:00"}</span><ChevronDown className="ml-auto h-4 w-4 text-slate-400" /></Button>
    </PopoverTrigger>
    <PopoverContent className="w-[min(18rem,calc(100vw-2rem))] rounded-2xl border-slate-200 p-4 shadow-xl" align="end">
      <div className="mb-4 flex items-center justify-between"><p className="text-sm font-semibold text-slate-700">Chọn giờ bắt đầu</p><Badge variant="secondary" className="text-sm tabular-nums">{hour}:{minute}</Badge></div>
      <div className="grid grid-cols-2 gap-3">
        <TimeStepper label="Giờ" value={hour} onDecrease={() => changeHour(-1)} onIncrease={() => changeHour(1)} />
        <TimeStepper label="Phút" value={minute} onDecrease={() => changeMinute(-5)} onIncrease={() => changeMinute(5)} />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2" aria-label="Chọn phút nhanh">
        {["00", "15", "30", "45"].map((item) => <Button type="button" key={item} variant={item === minute ? "default" : "outline"} size="sm" className="rounded-xl px-0 tabular-nums" onClick={() => updateTime(Number(hour), Number(item))}>:{item}</Button>)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" className="rounded-xl" onClick={() => onChange(currentTime())}><Clock3 className="h-4 w-4" /> Bây giờ</Button>
        <Button type="button" className="rounded-xl" onClick={() => setOpen(false)}><Check className="h-4 w-4" /> Xong</Button>
      </div>
    </PopoverContent>
  </Popover>;
}
