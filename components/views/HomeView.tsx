"use client";

import { ArrowRight, CalendarDays, ChevronRight, CircleDollarSign, NotebookPen, Plus, Sparkles, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LessonRow } from "@/components/shared/LessonRow";
import { VietnameseMonthPicker } from "@/components/shared/VietnameseMonthPicker";
import { AppData } from "@/lib/types";
import { formatCurrency, monthLabel, sortLessonsNewestFirst } from "@/lib/utils";

export function HomeView({ data, month, setMonth, onRecord, onStudent, onViewLessons }: { data: AppData; month: string; setMonth: (month: string) => void; onRecord: () => void; onStudent: (id: string) => void; onViewLessons: () => void }) {
  const monthLessons = data.lessons.filter((lesson) => lesson.lessonDate.startsWith(month));
  const monthTotal = monthLessons.reduce((sum, lesson) => sum + lesson.fee, 0);
  const recentStudentIds = [...new Set([...data.lessons].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((lesson) => lesson.studentId))].slice(0, 4);
  const greeting = new Date().getHours() < 12 ? "Chào buổi sáng" : new Date().getHours() < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  return <div className="view-stack">
    <section className="hero-card">
      <div className="hero-copy"><span className="hero-kicker">{greeting} ✦</span><h2>Hôm nay mình<br /><em>dạy gì nhỉ?</em></h2><p>Ghi nhận buổi học ngay khi vừa kết thúc.</p></div>
      <div className="hero-sparkle"><Sparkles size={44} /></div>
      <button className="primary-button hero-action" onClick={onRecord}><Plus size={19} /> Điểm danh / tạo buổi</button>
    </section>
    <section className="home-month-summary">
      <div className="home-month-heading"><div><span className="section-kicker">THỐNG KÊ THÁNG</span><strong>{monthLabel(month)}</strong></div><div className="home-month-picker"><VietnameseMonthPicker value={month} onChange={setMonth} compact /></div></div>
      <div className="stat-grid">
        <Card className="stat-card"><span className="stat-icon blue"><NotebookPen size={17} /></span><strong>{monthLessons.length}</strong><span>Buổi trong tháng</span></Card>
        <Card className="stat-card"><span className="stat-icon amber"><CircleDollarSign size={17} /></span><strong>{formatCurrency(monthTotal).replace(" ₫", "đ")}</strong><span>Học phí trong tháng</span></Card>
      </div>
    </section>
    <section className="section-block">
      <div className="section-heading"><div><span className="section-kicker">LỐI TẮT</span><h3>Học sinh gần đây</h3></div>{data.students.length > 4 && <button className="text-button" onClick={() => onViewLessons()}>Xem tất cả <ChevronRight size={15} /></button>}</div>
      {recentStudentIds.length > 0 ? <div className="student-chips">{recentStudentIds.map((id) => { const student = data.students.find((item) => item.id === id); if (!student) return null; return <button className="student-chip" key={id} onClick={() => onStudent(id)}><span className="avatar small">{student.name.charAt(0)}</span><span>{student.name}</span><Plus size={15} /></button>; })}</div> : <div className="soft-empty"><span className="soft-empty-icon"><Users size={18} /></span><div><strong>Chưa có học sinh gần đây</strong><p>Tạo học sinh đầu tiên để bắt đầu ghi nhận.</p></div></div>}
    </section>
    <section className="section-block">
      <div className="section-heading"><div><span className="section-kicker">DÒNG THỜI GIAN</span><h3>Buổi dạy trong tháng</h3></div><button className="round-link" onClick={onViewLessons}><ArrowRight size={17} /></button></div>
      {monthLessons.length ? <div className="lesson-list">{sortLessonsNewestFirst(monthLessons).slice(0, 5).map((lesson) => <LessonRow key={lesson.id} lesson={lesson} student={data.students.find((item) => item.id === lesson.studentId)} subject={data.subjects.find((item) => item.id === lesson.subjectId)} compact />)}</div> : <div className="empty-card"><div className="empty-illustration"><CalendarDays size={27} /></div><h4>Tháng này chưa có buổi học</h4><p>Chọn tháng khác hoặc ghi nhận một buổi học mới.</p><button className="secondary-button" onClick={onRecord}><Plus size={17} /> Ghi nhận buổi đầu tiên</button></div>}
    </section>
  </div>;
}
