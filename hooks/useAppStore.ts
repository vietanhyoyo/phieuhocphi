"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppData, Lesson, Notice, NoticeType, Student, StudentDraft, StudentSubject, Subject } from "@/lib/types";
import { createInitialData, isValidAppData, loadData, normalizeAppData, saveData } from "@/lib/storage";
import { loadRemoteData, saveRemoteData } from "@/lib/cloud-storage";
import { currentDate, currentMonth, emptyStudentDraft, uid } from "@/lib/utils";

export type AppStore = ReturnType<typeof useAppStore>;

export function useAppStore(accountId: string | null) {
  const [data, setData] = useState<AppData>(createInitialData);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<"home" | "lessons" | "students" | "tuition" | "settings">("home");
  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [lessonModal, setLessonModal] = useState<Lesson | "new" | null>(null);
  const [studentModal, setStudentModal] = useState<Student | "new" | null>(null);
  const [subjectModal, setSubjectModal] = useState<Subject | "new" | null>(null);
  const [receiptTarget, setReceiptTarget] = useState<{ studentId: string; month: string } | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [storageStatus, setStorageStatus] = useState<"checking" | "local" | "cloud" | "syncing" | "error">("checking");
  const [confirmDelete, setConfirmDelete] = useState<Lesson | null>(null);
  const [studentDraft, setStudentDraft] = useState<StudentDraft>(emptyStudentDraft());
  const [subjectName, setSubjectName] = useState("");
  const restoreRef = useRef<HTMLInputElement>(null);
  const cloudEnabledRef = useRef(false);
  const latestDataRef = useRef<AppData>(createInitialData());
  const saveQueueRef = useRef(Promise.resolve());
  const syncErrorShownRef = useRef(false);

  const storageScope = accountId ?? "guest";

  useEffect(() => {
    if (!accountId) {
      cloudEnabledRef.current = false;
      setHydrated(false);
      setStorageStatus("checking");
      return;
    }

    cloudEnabledRef.current = false;
    const localData = loadData(storageScope);
    latestDataRef.current = localData;
    setData(localData);
    setStorageStatus("checking");
    setHydrated(true);
    syncErrorShownRef.current = false;
    saveQueueRef.current = Promise.resolve();
    void refreshRemoteData(localData);
  }, [accountId]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const queueRemoteSave = (next: AppData, ownerId: string | null = accountId) => {
    if (!ownerId || !cloudEnabledRef.current) return;
    saveQueueRef.current = saveQueueRef.current
      .then(async () => {
        if (ownerId !== accountId) return;
        setStorageStatus("syncing");
        await saveRemoteData(next);
        if (ownerId !== accountId) return;
        setStorageStatus("cloud");
        syncErrorShownRef.current = false;
      })
      .catch(() => {
        if (ownerId !== accountId) return;
        setStorageStatus("error");
        if (!syncErrorShownRef.current) {
          syncErrorShownRef.current = true;
          setNotice({ message: "Đã lưu tạm trên thiết bị nhưng chưa đồng bộ được với Google Sheet.", type: "error" });
        }
      });
  };

  const refreshRemoteData = async (fallbackData = latestDataRef.current, ownerId: string | null = accountId) => {
    if (!ownerId) return;
    setStorageStatus("checking");
    try {
      const remote = await loadRemoteData();
      if (ownerId !== accountId) return;
      if (!remote.configured) {
        cloudEnabledRef.current = false;
        setStorageStatus("local");
        return;
      }
      cloudEnabledRef.current = true;
      if (remote.data) {
        latestDataRef.current = remote.data;
        setData(remote.data);
        saveData(remote.data, storageScope);
      } else {
        await saveRemoteData(fallbackData);
        if (ownerId !== accountId) return;
      }
      setStorageStatus("cloud");
    } catch {
      if (ownerId !== accountId) return;
      cloudEnabledRef.current = false;
      setStorageStatus("error");
    }
  };

  const updateData = (next: AppData) => {
    const normalized = normalizeAppData(next);
    latestDataRef.current = normalized;
    setData(normalized);
    saveData(normalized, storageScope);
    queueRemoteSave(normalized, accountId);
  };

  const notify = (message: string, type: NoticeType = "success") => setNotice({ message, type });

  const todayLessons = useMemo(() => data.lessons.filter((lesson) => lesson.lessonDate === currentDate()), [data.lessons]);

  const openStudent = (student: Student | "new") => {
    setStudentModal(student);
    if (student === "new") {
      setStudentDraft(emptyStudentDraft());
      return;
    }
    const assignments = Object.fromEntries(
      data.studentSubjects
        .filter((item) => item.studentId === student.id)
        .map((item) => [item.subjectId, { active: item.active, fee: item.defaultFee, duration: item.defaultDurationMinutes }]),
    );
    setStudentDraft({
      name: student.name,
      phone: student.phone ?? "",
      parentName: student.parentName ?? "",
      parentPhone: student.parentPhone ?? "",
      note: student.note ?? "",
      assignments,
    });
  };

  const openSubject = (subject: Subject | "new") => {
    setSubjectModal(subject);
    setSubjectName(subject === "new" ? "" : subject.name);
  };

  const saveStudent = () => {
    if (!studentModal) return;
    const name = studentDraft.name.trim();
    if (!name) {
      notify("Vui lòng nhập tên học sinh.", "error");
      return;
    }
    const timestamp = new Date().toISOString();
    let studentId: string;
    let nextStudents = [...data.students];
    if (studentModal === "new") {
      studentId = uid("student");
      nextStudents.push({ id: studentId, name, phone: studentDraft.phone.trim(), parentName: studentDraft.parentName.trim(), parentPhone: studentDraft.parentPhone.trim(), note: studentDraft.note.trim(), active: true, createdAt: timestamp, updatedAt: timestamp });
    } else {
      studentId = studentModal.id;
      nextStudents = nextStudents.map((student) => student.id === studentId ? { ...student, name, phone: studentDraft.phone.trim(), parentName: studentDraft.parentName.trim(), parentPhone: studentDraft.parentPhone.trim(), note: studentDraft.note.trim(), updatedAt: timestamp } : student);
    }
    const existing = data.studentSubjects.filter((item) => item.studentId === studentId);
    const nextAssignments = data.subjects.flatMap((subject) => {
      const draft = studentDraft.assignments[subject.id];
      const old = existing.find((item) => item.subjectId === subject.id);
      if (!draft?.active) return [];
      return [{
        id: old?.id ?? uid("student-subject"),
        studentId,
        subjectId: subject.id,
        defaultFee: Number(draft.fee) || 0,
        defaultDurationMinutes: Number(draft.duration) || 90,
        active: true,
        createdAt: old?.createdAt ?? timestamp,
        updatedAt: timestamp,
      } satisfies StudentSubject];
    });
    const untouched = data.studentSubjects.filter((item) => item.studentId !== studentId);
    updateData({ ...data, students: nextStudents, studentSubjects: [...untouched, ...nextAssignments] });
    setStudentModal(null);
    notify(studentModal === "new" ? "Đã thêm học sinh mới." : "Đã cập nhật thông tin học sinh.");
  };

  const toggleStudentActive = (student: Student) => {
    const timestamp = new Date().toISOString();
    updateData({ ...data, students: data.students.map((item) => item.id === student.id ? { ...item, active: !item.active, updatedAt: timestamp } : item) });
    notify(student.active ? "Đã chuyển học sinh sang trạng thái nghỉ học." : "Đã kích hoạt lại học sinh.");
  };

  const saveSubject = () => {
    if (!subjectModal) return;
    const name = subjectName.trim();
    if (!name) {
      notify("Vui lòng nhập tên môn học.", "error");
      return;
    }
    const timestamp = new Date().toISOString();
    if (subjectModal === "new") {
      updateData({ ...data, subjects: [...data.subjects, { id: uid("subject"), name, active: true, createdAt: timestamp, updatedAt: timestamp }] });
      notify("Đã thêm môn học.");
    } else {
      updateData({ ...data, subjects: data.subjects.map((subject) => subject.id === subjectModal.id ? { ...subject, name, updatedAt: timestamp } : subject) });
      notify("Đã đổi tên môn học.");
    }
    setSubjectModal(null);
  };

  const toggleSubject = (subject: Subject) => {
    updateData({ ...data, subjects: data.subjects.map((item) => item.id === subject.id ? { ...item, active: !item.active, updatedAt: new Date().toISOString() } : item) });
    notify(subject.active ? "Đã tạm ngưng môn học." : "Đã bật lại môn học.");
  };

  const saveLesson = (lesson: Lesson) => {
    const timestamp = new Date().toISOString();
    const exists = data.lessons.some((item) => item.id === lesson.id);
    const normalized = { ...lesson, durationMinutes: Number(lesson.durationMinutes) || 0, fee: Number(lesson.fee) || 0, updatedAt: timestamp };
    updateData({ ...data, lessons: exists ? data.lessons.map((item) => item.id === lesson.id ? normalized : item) : [...data.lessons, { ...normalized, createdAt: timestamp }] });
    setLessonModal(null);
    notify(exists ? "Đã cập nhật buổi dạy." : "Đã lưu buổi dạy vào sổ.");
  };

  const removeLesson = () => {
    if (!confirmDelete) return;
    updateData({ ...data, lessons: data.lessons.filter((lesson) => lesson.id !== confirmDelete.id) });
    setConfirmDelete(null);
    notify("Đã xóa buổi dạy.");
  };

  const openRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as unknown;
        if (!isValidAppData(parsed)) throw new Error("invalid");
        if (window.confirm("Khôi phục sẽ thay thế toàn bộ dữ liệu hiện tại. Bạn có chắc chắn không?")) {
          updateData(parsed);
          notify("Đã khôi phục dữ liệu thành công.");
        }
      } catch {
        notify("File backup không hợp lệ hoặc đã bị hỏng.", "error");
      } finally {
        if (restoreRef.current) restoreRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  return {
    data, hydrated, view, setView, month, setMonth, search, setSearch,
    selectedStudentId, setSelectedStudentId,
    lessonModal, setLessonModal, studentModal, setStudentModal, studentDraft, setStudentDraft,
    subjectModal, setSubjectModal, subjectName, setSubjectName,
    receiptTarget, setReceiptTarget, notice, confirmDelete, setConfirmDelete,
    restoreRef, todayLessons,
    storageStatus, refreshRemoteData,
    openStudent, saveStudent, toggleStudentActive,
    openSubject, saveSubject, toggleSubject,
    saveLesson, removeLesson, openRestore, notify,
  };
}
