"use client";

import { DayPicker } from "react-day-picker";
import { vi } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";

export function Calendar({ className, ...props }: React.ComponentProps<typeof DayPicker>) {
  return <DayPicker
    locale={vi}
    showOutsideDays
    className={cn("p-0", className)}
    classNames={{
      months: "flex flex-col space-y-4",
      month: "space-y-4",
      month_caption: "flex justify-center pt-1 relative items-center",
      caption_label: "text-sm font-semibold text-slate-700",
      nav: "space-x-1 flex items-center",
      button_previous: "absolute left-1 h-7 w-7 rounded-md p-0 text-slate-500 hover:bg-slate-100 inline-flex items-center justify-center",
      button_next: "absolute right-1 h-7 w-7 rounded-md p-0 text-slate-500 hover:bg-slate-100 inline-flex items-center justify-center",
      month_grid: "w-full border-collapse space-y-1",
      weekdays: "flex",
      weekday: "w-9 rounded-md text-[0.8rem] font-normal text-slate-400",
      week: "flex w-full mt-2",
      day: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-indigo-50 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
      day_button: "h-9 w-9 rounded-md p-0 font-normal text-slate-600 hover:bg-indigo-50 hover:text-indigo-800 aria-selected:bg-primary aria-selected:text-white",
      selected: "bg-primary text-white hover:bg-primary hover:text-white focus:bg-primary focus:text-white",
      today: "font-bold text-indigo-700",
      outside: "text-slate-300 opacity-60",
      disabled: "text-slate-300 opacity-50",
      hidden: "invisible",
    }}
    components={{
      Chevron: ({ orientation }) => orientation === "left" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />,
    }}
    {...props}
  />;
}
