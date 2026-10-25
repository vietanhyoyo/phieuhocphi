"use client";

import { useState } from "react";
import { BookOpen, CircleDollarSign, Filter, Plus, RotateCcw, Search, SlidersHorizontal, Users } from "lucide-react";
import { LessonRow } from "@/components/shared/LessonRow";
import { VietnameseMultiMonthPicker } from "@/components/shared/VietnameseMultiMonthPicker";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppData, Lesson } from "@/lib/types";
import { currentMonth, filterLessons, LessonPaymentFilter, monthSelectionLabel } from "@/lib/utils";

export function LessonsView({ data, months, setMonths, search, setSearch, onRecord, onEdit, onDelete }: { data: AppData; months: string[]; setMonths: (value: string[]) => void; search: string; setSearch: (value: string) => void; onRecord: () => void; onEdit: (lesson: Lesson) => void; onDelete: (lesson: Lesson) => void }) {
  const [studentFilter, setStudentFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState<LessonPaymentFilter>("unpaid");
  const hasFilters = Boolean(search) || studentFilter !== "all" || subjectFilter !== "all" || paymentFilter !== "unpaid" || months.length !== 1 || months[0] !== currentMonth();
  const resetFilters = () => { setSearch(""); setStudentFilter("all"); setSubjectFilter("all"); setPaymentFilter("unpaid"); setMonths([currentMonth()]); };
  const filtered = filterLessons(data, months, studentFilter, subjectFilter, paymentFilter, search);
  return <div className="view-stack"><div className="page-heading"><div><span className="section-kicker">NHẬT KÝ</span><h2>Buổi dạy</h2><p>{filtered.length} buổi trong {monthSelectionLabel(months).toLowerCase()}</p></div><Button type="button" onClick={onRecord} className="lesson-add-button"><Plus size={16} /><span>Thêm buổi dạy</span></Button></div>
    <Card className="filter-panel rounded-2xl"><div className="filter-panel-heading"><div><span className="filter-heading-icon"><SlidersHorizontal size={15} /></span><div><strong>Bộ lọc buổi dạy</strong><span>Tìm nhanh theo tháng, học sinh, môn và trạng thái thu tiền</span></div></div>{hasFilters && <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg px-2 text-xs text-slate-500" onClick={resetFilters}><RotateCcw className="h-3.5 w-3.5" /> Đặt lại</Button>}</div><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên học sinh…" className="pl-10" /></div><div className="filter-row"><div className="shadcn-month-filter"><VietnameseMultiMonthPicker value={months} onChange={setMonths} /></div><Select value={studentFilter} onValueChange={setStudentFilter}><SelectTrigger aria-label="Lọc học sinh" className="min-w-0"><Users className="mr-2 h-4 w-4 shrink-0 text-primary" /><SelectValue /></SelectTrigger><SelectContent align="start"><SelectItem value="all">Tất cả học sinh</SelectItem>{data.students.map((student) => <SelectItem key={student.id} value={student.id}>{student.name}</SelectItem>)}</SelectContent></Select></div><Select value={subjectFilter} onValueChange={setSubjectFilter}><SelectTrigger aria-label="Lọc môn học"><BookOpen className="mr-2 h-4 w-4 shrink-0 text-primary" /><SelectValue /></SelectTrigger><SelectContent align="start"><SelectItem value="all">Tất cả môn học</SelectItem>{data.subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent></Select><Select value={paymentFilter} onValueChange={(value) => setPaymentFilter(value as LessonPaymentFilter)}><SelectTrigger aria-label="Lọc trạng thái thu tiền"><CircleDollarSign className="mr-2 h-4 w-4 shrink-0 text-primary" /><SelectValue /></SelectTrigger><SelectContent align="start"><SelectItem value="all">Tất cả</SelectItem><SelectItem value="paid">Đã thu tiền</SelectItem><SelectItem value="unpaid">Chưa thu tiền</SelectItem></SelectContent></Select></Card>
    {filtered.length ? <div className="lesson-list full-list">{filtered.map((lesson) => <LessonRow key={lesson.id} lesson={lesson} student={data.students.find((item) => item.id === lesson.studentId)} subject={data.subjects.find((item) => item.id === lesson.subjectId)} onEdit={() => onEdit(lesson)} onDelete={() => onDelete(lesson)} />)}</div> : <div className="empty-card"><div className="empty-illustration"><Filter size={27} /></div><h4>Không có buổi phù hợp</h4><p>Thử đổi tháng hoặc bộ lọc để xem những dữ liệu khác.</p></div>}
  </div>;
}
