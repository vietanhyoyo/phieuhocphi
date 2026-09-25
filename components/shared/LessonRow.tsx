"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock3, Edit3, Trash2 } from "lucide-react";
import { Lesson, Student, Subject } from "@/lib/types";
import { formatCurrency, minutesLabel } from "@/lib/utils";

export function LessonRow({ lesson, student, subject, onEdit, onDelete, compact = false }: { lesson: Lesson; student?: Student; subject?: Subject; onEdit?: () => void; onDelete?: () => void; compact?: boolean }) {
  const [, month, day] = lesson.lessonDate.split("-");
  const date = new Date(`${lesson.lessonDate}T12:00:00`);
  const validDate = Number.isFinite(date.getTime()) && Number.isFinite(Number(day)) && Number.isFinite(Number(month));
  const weekday = validDate ? (date.getDay() === 0 ? "CN" : `Th ${date.getDay() + 1}`) : "--";
  const shortDate = validDate ? `${Number(day)}/${Number(month)}` : "--/--";
  return <Card className={`lesson-row ${compact ? "compact" : ""}`}><div className="lesson-date"><span>{weekday}</span><strong>{shortDate}</strong></div><div className="lesson-main"><div className="lesson-line"><strong>{student?.name ?? "Học sinh đã lưu"}</strong>{lesson.note && <span className="note-dot" title="Có ghi chú" />}</div><span className="lesson-subline"><Badge variant="secondary" className="border-0 px-2 py-0.5">{subject?.name ?? "Môn đã lưu"}</Badge><span><Clock3 size={13} /> {lesson.startTime} · {minutesLabel(lesson.durationMinutes)}</span></span></div><div className="lesson-end"><strong>{formatCurrency(lesson.fee).replace(" ₫", "đ")}</strong>{!compact && <div className="row-actions"><Button type="button" variant="ghost" size="icon" aria-label="Sửa buổi dạy" onClick={onEdit}><Edit3 size={15} /></Button><Button type="button" variant="ghost" size="icon" aria-label="Xóa buổi dạy" onClick={onDelete}><Trash2 size={15} /></Button></div>}</div></Card>;
}
