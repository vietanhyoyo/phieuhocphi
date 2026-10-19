"use client";

import { ArrowRight, CalendarDays, ChevronRight, CircleDollarSign, NotebookPen, Plus, Sparkles, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LessonRow } from "@/components/shared/LessonRow";
import { VietnameseMultiMonthPicker } from "@/components/shared/VietnameseMultiMonthPicker";
import { AppData } from "@/lib/types";
import { formatCurrency, getMonthlySummaryForMonths, monthSelectionLabel, sortLessonsNewestFirst } from "@/lib/utils";

export function HomeView({ data, months, setMonths, onRecord, onStudent, onViewLessons }: { data: AppData; months: string[]; setMonths: (months: string[]) => void; onRecord: () => void; onStudent: (id: string) => void; onViewLessons: () => void }) {
  const selectedMonths = new Set(months);
  const monthLessons = data.lessons.filter((lesson) => selectedMonths.has(lesson.lessonDate.slice(0, 7)));
  const monthTotal = monthLessons.reduce((sum, lesson) => sum + lesson.fee, 0);
  const studentSummaries = new Map(getMonthlySummaryForMonths(data, months).map((summary) => [summary.studentId, summary]));
  const studentStats = data.students
    .map((student) => ({ student, summary: studentSummaries.get(student.id) }))
    .sort((a, b) => (b.summary?.totalFee ?? 0) - (a.summary?.totalFee ?? 0) || a.student.name.localeCompare(b.student.name, "vi"));
  const recentStudentIds = [...new Set([...data.lessons].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((lesson) => lesson.studentId))].slice(0, 4);
  const greeting = new Date().getHours() < 12 ? "Chào buổi sáng" : new Date().getHours() < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  return <div className="view-stack">
    <section className="hero-card">
      <div className="hero-copy"><span className="hero-kicker">{greeting} ✦</span><h2>Hôm nay mình<br /><em>dạy gì nhỉ?</em></h2><p>Ghi nhận buổi học ngay khi vừa kết thúc.</p></div>
      <div className="hero-sparkle"><Sparkles size={44} /></div>
      <button className="primary-button hero-action" onClick={onRecord}><Plus size={19} /> Điểm danh / tạo buổi</button>
    </section>
    <section className="home-month-summary">
      <div className="home-month-heading"><div><span className="section-kicker">THỐNG KÊ THÁNG</span><strong>{monthSelectionLabel(months)}</strong></div><div className="home-month-picker"><VietnameseMultiMonthPicker value={months} onChange={setMonths} compact /></div></div>
      <div className="stat-grid">
        <Card className="stat-card"><span className="stat-icon blue"><NotebookPen size={17} /></span><strong>{monthLessons.length}</strong><span>Buổi trong kỳ đã chọn</span></Card>
        <Card className="stat-card"><span className="stat-icon amber"><CircleDollarSign size={17} /></span><strong>{formatCurrency(monthTotal).replace(" ₫", "đ")}</strong><span>Học phí trong kỳ</span></Card>
      </div>
    </section>
    <section className="section-block">
      <div className="section-heading"><div><span className="section-kicker">THỐNG KÊ THEO HỌC SINH</span><h3>Buổi dạy và học phí</h3></div></div>
      <Card className="home-student-stats-card">
        <div className="home-student-stats-caption">{monthSelectionLabel(months)} · {studentStats.length} học sinh</div>
        {studentStats.length ? <div className="home-student-stats-scroll">
          <table className="home-student-stats-table" aria-label={`Thống kê buổi dạy và học phí ${monthSelectionLabel(months)}`}>
            <thead><tr><th scope="col">Học sinh</th><th scope="col">Số buổi</th><th scope="col">Học phí</th></tr></thead>
            <tbody>{studentStats.map(({ student, summary }) => <tr key={student.id}>
              <td><span className="home-student-stats-name"><span className="avatar small">{student.name.charAt(0)}</span><span>{student.name}</span></span></td>
              <td>{summary?.totalLessonCount ?? 0}</td>
              <td>{formatCurrency(summary?.totalFee ?? 0).replace(" ₫", "đ")}</td>
            </tr>)}</tbody>
          </table>
        </div> : <p className="home-student-stats-empty">Thêm học sinh để xem thống kê theo từng em.</p>}
      </Card>
    </section>
    <section className="section-block">
      <div className="section-heading"><div><span className="section-kicker">LỐI TẮT</span><h3>Học sinh gần đây</h3></div>{data.students.length > 4 && <button className="text-button" onClick={() => onViewLessons()}>Xem tất cả <ChevronRight size={15} /></button>}</div>
      {recentStudentIds.length > 0 ? <div className="student-chips">{recentStudentIds.map((id) => { const student = data.students.find((item) => item.id === id); if (!student) return null; return <button className="student-chip" key={id} onClick={() => onStudent(id)}><span className="avatar small">{student.name.charAt(0)}</span><span>{student.name}</span><Plus size={15} /></button>; })}</div> : <div className="soft-empty"><span className="soft-empty-icon"><Users size={18} /></span><div><strong>Chưa có học sinh gần đây</strong><p>Tạo học sinh đầu tiên để bắt đầu ghi nhận.</p></div></div>}
    </section>
    <section className="section-block">
      <div className="section-heading"><div><span className="section-kicker">DÒNG THỜI GIAN</span><h3>Buổi dạy trong kỳ</h3></div><button className="round-link" onClick={onViewLessons}><ArrowRight size={17} /></button></div>
      {monthLessons.length ? <div className="lesson-list">{sortLessonsNewestFirst(monthLessons).slice(0, 5).map((lesson) => <LessonRow key={lesson.id} lesson={lesson} student={data.students.find((item) => item.id === lesson.studentId)} subject={data.subjects.find((item) => item.id === lesson.subjectId)} compact />)}</div> : <div className="empty-card"><div className="empty-illustration"><CalendarDays size={27} /></div><h4>Chưa có buổi học trong kỳ đã chọn</h4><p>Chọn tháng khác hoặc ghi nhận một buổi học mới.</p><button className="secondary-button" onClick={onRecord}><Plus size={17} /> Ghi nhận buổi đầu tiên</button></div>}
    </section>
  </div>;
}
