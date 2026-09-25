"use client";

import { useState } from "react";
import { BookOpen, Filter, NotebookPen, RotateCcw, Search, SlidersHorizontal, Users } from "lucide-react";
import { LessonRow } from "@/components/shared/LessonRow";
import { VietnameseMonthPicker } from "@/components/shared/VietnameseMonthPicker";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppData, Lesson } from "@/lib/types";
import { monthLabel, sortLessonsNewestFirst } from "@/lib/utils";

export function LessonsView({ data, month, setMonth, search, setSearch, onEdit, onDelete }: { data: AppData; month: string; setMonth: (value: string) => void; search: string; setSearch: (value: string) => void; onEdit: (lesson: Lesson) => void; onDelete: (lesson: Lesson) => void }) {
  const [studentFilter, setStudentFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const hasFilters = Boolean(search) || studentFilter !== "all" || subjectFilter !== "all";
  const resetFilters = () => { setSearch(""); setStudentFilter("all"); setSubjectFilter("all"); };
  const filtered = sortLessonsNewestFirst(data.lessons.filter((lesson) => lesson.lessonDate.startsWith(month) && (studentFilter === "all" || lesson.studentId === studentFilter) && (subjectFilter === "all" || lesson.subjectId === subjectFilter) && (!search || `${data.students.find((s) => s.id === lesson.studentId)?.name} ${data.subjects.find((s) => s.id === lesson.subjectId)?.name}`.toLowerCase().includes(search.toLowerCase()))));
  return <div className="view-stack"><div className="page-heading"><div><span className="section-kicker">NHẬT KÝ</span><h2>Buổi dạy</h2><p>{filtered.length} buổi trong {monthLabel(month).toLowerCase()}</p></div><span className="heading-icon blue-tint"><NotebookPen size={21} /></span></div>
    <Card className="filter-panel rounded-2xl"><div className="filter-panel-heading"><div><span className="filter-heading-icon"><SlidersHorizontal size={15} /></span><div><strong>Bộ lọc buổi dạy</strong><span>Tìm nhanh theo tháng, học sinh và môn</span></div></div>{hasFilters && <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg px-2 text-xs text-slate-500" onClick={resetFilters}><RotateCcw className="h-3.5 w-3.5" /> Đặt lại</Button>}</div><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên học sinh…" className="pl-10" /></div><div className="filter-row"><div className="shadcn-month-filter"><VietnameseMonthPicker value={month} onChange={setMonth} /></div><Select value={studentFilter} onValueChange={setStudentFilter}><SelectTrigger aria-label="Lọc học sinh" className="min-w-0"><Users className="mr-2 h-4 w-4 shrink-0 text-primary" /><SelectValue /></SelectTrigger><SelectContent align="start"><SelectItem value="all">Tất cả học sinh</SelectItem>{data.students.map((student) => <SelectItem key={student.id} value={student.id}>{student.name}</SelectItem>)}</SelectContent></Select></div><Select value={subjectFilter} onValueChange={setSubjectFilter}><SelectTrigger aria-label="Lọc môn học"><BookOpen className="mr-2 h-4 w-4 shrink-0 text-primary" /><SelectValue /></SelectTrigger><SelectContent align="start"><SelectItem value="all">Tất cả môn học</SelectItem>{data.subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent></Select></Card>
    {filtered.length ? <div className="lesson-list full-list">{filtered.map((lesson) => <LessonRow key={lesson.id} lesson={lesson} student={data.students.find((item) => item.id === lesson.studentId)} subject={data.subjects.find((item) => item.id === lesson.subjectId)} onEdit={() => onEdit(lesson)} onDelete={() => onDelete(lesson)} />)}</div> : <div className="empty-card"><div className="empty-illustration"><Filter size={27} /></div><h4>Không có buổi phù hợp</h4><p>Thử đổi tháng hoặc bộ lọc để xem những dữ liệu khác.</p></div>}
  </div>;
}
