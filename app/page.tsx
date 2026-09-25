"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, LoaderCircle } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { HomeView } from "@/components/views/HomeView";
import { LessonsView } from "@/components/views/LessonsView";
import { StudentsView } from "@/components/views/StudentsView";
import { StudentDetail } from "@/components/views/StudentDetail";
import { TuitionView } from "@/components/views/TuitionView";
import { SettingsView } from "@/components/views/SettingsView";
import { ReceiptPreview } from "@/components/views/ReceiptPreview";
import { LessonModal } from "@/components/modals/LessonModal";
import { StudentModal } from "@/components/modals/StudentModal";
import { SubjectModal } from "@/components/modals/SubjectModal";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { exportBackup } from "@/lib/storage";
import { useAppStore } from "@/hooks/useAppStore";
import { AuthView } from "@/components/views/AuthView";
import { AuthUser } from "@/lib/types";

export default function Page() {
  const [auth, setAuth] = useState<{ loading: boolean; configured: boolean; authenticated: boolean; hasUsers: boolean; user: AuthUser | null; error?: string }>({ loading: true, configured: false, authenticated: true, hasUsers: false, user: null });
  const storageScope = auth.configured ? (auth.authenticated && auth.user ? auth.user.id : null) : "local";
  const app = useAppStore(storageScope);

  useEffect(() => {
    fetch("/api/auth", { cache: "no-store" })
      .then(async (response) => ({ response, body: await response.json().catch(() => ({})) as { configured?: boolean; authenticated?: boolean; hasUsers?: boolean; user?: AuthUser | null; message?: string } }))
      .then(({ body }) => setAuth({ loading: false, configured: Boolean(body.configured), authenticated: Boolean(body.authenticated), hasUsers: Boolean(body.hasUsers), user: body.user ?? null, error: body.message }))
      .catch(() => setAuth({ loading: false, configured: false, authenticated: true, hasUsers: false, user: null }));
  }, []);

  const handleAuthenticated = async (user: AuthUser) => {
    setAuth((current) => ({ ...current, authenticated: true, user }));
  };

  const logout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setAuth((current) => ({ ...current, authenticated: false, user: null }));
  };

  if (auth.loading) {
    return <main className="loading-screen"><div className="loading-mark brand-image"><img src="/app-logo.png" alt="Logo Sổ học phí" /></div><span>Đang mở sổ học phí…</span></main>;
  }

  if (auth.error && auth.configured) return <main className="loading-screen"><span>{auth.error}</span></main>;
  if (auth.configured && !auth.authenticated) return <AuthView hasUsers={auth.hasUsers} onAuthenticated={handleAuthenticated} />;
  if (!app.hydrated) return <main className="loading-screen"><div className="loading-mark brand-image"><img src="/app-logo.png" alt="Logo Sổ học phí" /></div><span>Đang tải dữ liệu riêng của bạn…</span></main>;

  const selectedStudent = app.selectedStudentId ? app.data.students.find((student) => student.id === app.selectedStudentId) : null;

  return (
    <main className="page-background">
      <div className="app-shell">
        <Header view={app.view} onSettings={() => app.setView("settings")} onBack={() => { app.setView("home"); app.setSelectedStudentId(null); }} />
        <div className="app-content">
          {app.view === "home" && <HomeView data={app.data} month={app.month} setMonth={app.setMonth} onRecord={() => app.setLessonModal("new")} onStudent={(id) => { app.setSelectedStudentId(id); app.setView("students"); }} onViewLessons={() => app.setView("lessons")} />}
          {app.view === "lessons" && <LessonsView data={app.data} month={app.month} setMonth={app.setMonth} search={app.search} setSearch={app.setSearch} onRecord={() => app.setLessonModal("new")} onEdit={(lesson) => app.setLessonModal(lesson)} onDelete={app.setConfirmDelete} />}
          {app.view === "students" && (
            selectedStudent ? <StudentDetail data={app.data} student={selectedStudent} month={app.month} setMonth={app.setMonth} onBack={() => app.setSelectedStudentId(null)} onEdit={() => app.openStudent(selectedStudent)} onRecord={() => app.setLessonModal("new")} onToggleActive={() => app.toggleStudentActive(selectedStudent)} onReceipt={() => app.setReceiptTarget({ studentId: selectedStudent.id, month: app.month })} /> :
              <StudentsView data={app.data} search={app.search} setSearch={app.setSearch} onAdd={() => app.openStudent("new")} onEdit={app.openStudent} onSelect={(id) => app.setSelectedStudentId(id)} />
          )}
          {app.view === "tuition" && <TuitionView data={app.data} month={app.month} setMonth={app.setMonth} onReceipt={(studentId) => app.setReceiptTarget({ studentId, month: app.month })} onStudent={(id) => { app.setSelectedStudentId(id); app.setView("students"); }} />}
          {app.view === "settings" && <SettingsView data={app.data} storageStatus={app.storageStatus} currentUser={auth.user} onLogout={logout} onBack={() => app.setView("home")} onAddSubject={() => app.openSubject("new")} onEditSubject={app.openSubject} onToggleSubject={app.toggleSubject} onBackup={() => exportBackup(app.data)} onRestore={() => app.restoreRef.current?.click()} />}
        </div>
        {app.view !== "settings" && <BottomNav view={app.view} onChange={(next) => { app.setView(next); app.setSelectedStudentId(null); app.setSearch(""); }} />}
      </div>
      <input ref={app.restoreRef} className="hidden" type="file" accept="application/json,.json" onChange={app.openRestore} />

      {(app.storageStatus === "checking" || app.storageStatus === "syncing") && <div className="sheet-loading-indicator" role="status" aria-live="polite"><LoaderCircle size={15} className="sheet-loading-spinner" /><span>{app.storageStatus === "checking" ? "Đang tải dữ liệu…" : "Đang lưu vào Google Sheet…"}</span></div>}

      {app.lessonModal && <LessonModal data={app.data} initial={app.lessonModal === "new" ? null : app.lessonModal} onClose={() => app.setLessonModal(null)} onSave={app.saveLesson} />}
      {app.studentModal && <StudentModal data={app.data} draft={app.studentDraft} setDraft={app.setStudentDraft} initial={app.studentModal === "new" ? null : app.studentModal} onClose={() => app.setStudentModal(null)} onSave={app.saveStudent} />}
      {app.subjectModal && <SubjectModal initial={app.subjectModal === "new" ? null : app.subjectModal} name={app.subjectName} setName={app.setSubjectName} onClose={() => app.setSubjectModal(null)} onSave={app.saveSubject} />}
      {app.confirmDelete && <ConfirmModal title="Xóa buổi dạy?" message="Buổi này sẽ bị xóa khỏi lịch sử và tổng học phí tháng sẽ được tính lại." confirmLabel="Xóa buổi dạy" onClose={() => app.setConfirmDelete(null)} onConfirm={app.removeLesson} />}
      {app.receiptTarget && <ReceiptPreview data={app.data} target={app.receiptTarget} onClose={() => app.setReceiptTarget(null)} onNotice={app.notify} />}
      {app.notice && <div className={`toast ${app.notice.type === "error" ? "toast-error" : ""}`}><span className="toast-icon">{app.notice.type === "error" ? <AlertTriangle size={17} /> : <Check size={17} />}</span>{app.notice.message}</div>}
    </main>
  );
}
