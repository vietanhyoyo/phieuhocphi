"use client";

import { DayPicker } from "react-day-picker";
import { vi } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";

export function Calendar({ className, classNames, components, ...props }: React.ComponentProps<typeof DayPicker>) {
  return <DayPicker
    locale={vi}
    showOutsideDays
    className={cn("vi-calendar", className)}
    classNames={{
      months: "vi-calendar-months",
      month: "vi-calendar-month",
      month_caption: "vi-calendar-caption",
      caption_label: "vi-calendar-title",
      nav: "vi-calendar-nav",
      button_previous: "vi-calendar-previous",
      button_next: "vi-calendar-next",
      month_grid: "vi-calendar-grid",
      weekday: "vi-calendar-weekday",
      day: "vi-calendar-day",
      day_button: "vi-calendar-day-button",
      selected: "vi-calendar-selected",
      today: "vi-calendar-today",
      outside: "vi-calendar-outside",
      disabled: "vi-calendar-disabled",
      hidden: "invisible",
      ...classNames,
    }}
    components={{
      Chevron: ({ orientation }) => orientation === "left" ? <ChevronLeft size={18} /> : <ChevronRight size={18} />,
      ...components,
    }}
    {...props}
  />;
}
