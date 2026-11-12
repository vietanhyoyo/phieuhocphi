"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppData, Lesson, Notice, NoticeType, ReceiptTarget, Student, StudentDraft, StudentSubject, Subject, TimetableEntry, View } from "@/lib/types";
import { isTimetableEntry, timetableConflict, WEEKDAYS } from "@/lib/timetable";
import { createInitialData, isValidAppData, loadData, normalizeAppData, saveData, STORAGE_KEY } from "@/lib/storage";
import { loadRemoteData, saveRemoteData } from "@/lib/cloud-storage";
import { clearPendingSave, hasLocalData, loadPendingSave, loadSyncedData, markMisScopedSaveMigrated, reconcileData, recoverMisScopedData, sameData, saveSyncedData, stagePendingSave, wasMisScopedSaveMigrated } from "@/lib/sync-queue";
import { loadCachedAccount } from "@/lib/account-cache";
import { currentDate, currentMonth, emptyStudentDraft, getReceiptLessons, uid, updateReceiptLessonsPaid } from "@/lib/utils";

export type AppStore = ReturnType<typeof useAppStore>;

export function useAppStore(accountId: string | null) {
  const [data, setData] = useState<AppData>(createInitialData);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<View>("home");
  const [month, setMonth] = useState(currentMonth());
  const [months, setMonths] = useState([currentMonth()]);
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [lessonModal, setLessonModal] = useState<Lesson | "new" | null>(null);
  const [studentModal, setStudentModal] = useState<Student | "new" | null>(null);
  const [subjectModal, setSubjectModal] = useState<Subject | "new" | null>(null);
  const [receiptTarget, setReceiptTarget] = useState<ReceiptTarget | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [storageStatus, setStorageStatus] = useState<"checking" | "local" | "cloud" | "syncing" | "error">("checking");
  const [confirmDelete, setConfirmDelete] = useState<Lesson | null>(null);
  const [confirmDeleteStudent, setConfirmDeleteStudent] = useState<Student | null>(null);
  const [studentDraft, setStudentDraft] = useState<StudentDraft>(emptyStudentDraft());
  const [subjectName, setSubjectName] = useState("");
  const restoreRef = useRef<HTMLInputElement>(null);
  const cloudEnabledRef = useRef(false);
  const latestDataRef = useRef<AppData>(createInitialData());
  const saveQueueRef = useRef(Promise.resolve());
  const refreshingRef = useRef<{ ownerId: string; promise: Promise<void> } | null>(null);
  const syncErrorShownRef = useRef(false);
  // IDs for a record being created are fixed when its modal opens, so a
  // repeated tap on Save updates that record instead of adding a duplicate.
  const newStudentIdRef = useRef(uid("student"));
  const newSubjectIdRef = useRef(uid("subject"));
  const activeAccountRef = useRef(accountId);
  activeAccountRef.current = accountId;

  const storageScope = accountId ?? "guest";

  useEffect(() => {
    if (!accountId) {
      cloudEnabledRef.current = false;
      setHydrated(false);
      setStorageStatus("checking");
      return;
    }

    cloudEnabledRef.current = false;
    let queued = loadPendingSave(storageScope);
    let localData = queued?.data ?? loadData(storageScope);
    const misplaced = storageScope !== "local" && loadCachedAccount()?.id === storageScope ? loadPendingSave("local") : null;
    if (misplaced && !wasMisScopedSaveMigrated(storageScope, misplaced.revision)) {
      const recovered = recoverMisScopedData(localData, misplaced.data);
      if (!sameData(recovered, localData)) {
        localData = recovered;
        queued = stagePendingSave(storageScope, recovered);
      }
      markMisScopedSaveMigrated(storageScope, misplaced.revision);
    }
    if (queued) saveData(localData, storageScope);
    latestDataRef.current = localData;
    setData(localData);
    setStorageStatus("checking");
    setHydrated(true);
    syncErrorShownRef.current = false;
    saveQueueRef.current = Promise.resolve();
    void refreshRemoteData(localData, accountId);
  }, [accountId]);

  useEffect(() => {
    if (!accountId) return;
    const retry = () => {
      if (document.visibilityState === "visible" && navigator.onLine && (loadPendingSave(accountId) || storageStatus === "error")) {
        void refreshRemoteData(latestDataRef.current, accountId);
      }
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", retry);
    const timer = window.setInterval(retry, 30000);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", retry);
      window.clearInterval(timer);
    };
  }, [accountId, storageStatus]);

  // Another tab of the same account shares this localStorage queue. Adopt its
  // writes so an edit here never overwrites the queue with an older snapshot.
  useEffect(() => {
    if (!accountId) return;
    const key = `${STORAGE_KEY}:${accountId}`;
    const adopt = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || event.key !== key || !event.newValue) return;
      const next = loadPendingSave(accountId)?.data ?? loadData(accountId);
      if (sameData(next, latestDataRef.current)) return;
      latestDataRef.current = next;
      setData(next);
    };
    window.addEventListener("storage", adopt);
    return () => window.removeEventListener("storage", adopt);
  }, [accountId]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const queueRemoteSave = (ownerId: string | null = accountId): Promise<boolean | null> => {
    if (!ownerId || !cloudEnabledRef.current) return Promise.resolve(null);
    const saveTask = saveQueueRef.current
      .then(async () => {
        if (ownerId !== activeAccountRef.current) return false;
        const pending = loadPendingSave(ownerId);
        if (!pending) return true;
        setStorageStatus("syncing");
        await saveRemoteData(pending.data, ownerId);
        if (ownerId !== activeAccountRef.current) return false;
        saveSyncedData(ownerId, pending.data);
        clearPendingSave(ownerId, pending.revision);
        setStorageStatus(loadPendingSave(ownerId) ? "syncing" : "cloud");
        syncErrorShownRef.current = false;
        return true;
      })
      .catch(() => {
        if (ownerId !== activeAccountRef.current) return false;
        setStorageStatus("error");
        if (!syncErrorShownRef.current) {
          syncErrorShownRef.current = true;
          setNotice({ message: "Đã lưu tạm trên thiết bị nhưng chưa đồng bộ được với Google Sheet.", type: "error" });
        }
        return false;
      });
    saveQueueRef.current = saveTask.then(() => undefined);
    return saveTask;
  };

  const refreshRemoteData = (fallbackData = latestDataRef.current, ownerId: string | null = accountId): Promise<void> => {
    if (!ownerId) return Promise.resolve();
    if (refreshingRef.current?.ownerId === ownerId) return refreshingRef.current.promise;
    const promise = refreshRemoteDataNow(fallbackData, ownerId).finally(() => {
      if (refreshingRef.current?.promise === promise) refreshingRef.current = null;
    });
    refreshingRef.current = { ownerId, promise };
    return promise;
  };

  const refreshRemoteDataNow = async (fallbackData: AppData, ownerId: string) => {
    if (!ownerId) return;
    setStorageStatus("checking");
    // The read runs in the same queue as saves, never alongside one. A save
    // that finished while a read was in flight would move the sync baseline
    // past the read's older server copy, so records deleted by that save
    // would look new on the server and be brought back.
    const readTask = saveQueueRef.current.then(() => loadAndMergeRemote(fallbackData, ownerId));
    saveQueueRef.current = readTask.then(() => undefined);
    if (await readTask) await queueRemoteSave(ownerId);
  };

  // Returns true when the merged data still has to be pushed to the server.
  const loadAndMergeRemote = async (fallbackData: AppData, ownerId: string): Promise<boolean> => {
    try {
      const remote = await loadRemoteData();
      if (ownerId !== activeAccountRef.current) return false;
      if (!remote.configured) {
        cloudEnabledRef.current = false;
        setStorageStatus("local");
        return false;
      }
      cloudEnabledRef.current = true;
      const pending = loadPendingSave(ownerId);
      const localExists = hasLocalData(ownerId) || Boolean(pending);
      const local = pending?.data ?? (localExists ? latestDataRef.current : fallbackData);
      const merged = remote.data && !localExists
        ? remote.data
        : reconcileData(local, remote.data, loadSyncedData(ownerId));
      latestDataRef.current = merged;
      setData(merged);
      saveData(merged, ownerId);
      if (remote.data && sameData(merged, remote.data)) {
        if (pending) clearPendingSave(ownerId, pending.revision);
        saveSyncedData(ownerId, merged);
        setStorageStatus("cloud");
        return false;
      }
      stagePendingSave(ownerId, merged);
      return true;
    } catch {
      if (ownerId === activeAccountRef.current) setStorageStatus("error");
      return false;
    }
  };

  const updateData = (next: AppData) => {
    const normalized = normalizeAppData(next);
    if (accountId) stagePendingSave(accountId, normalized);
    latestDataRef.current = normalized;
    setData(normalized);
    saveData(normalized, storageScope);
    return queueRemoteSave(accountId);
  };

  const notify = (message: string, type: NoticeType = "success") => setNotice({ message, type });

  const todayLessons = useMemo(() => data.lessons.filter((lesson) => lesson.lessonDate === currentDate()), [data.lessons]);

  const openStudent = (student: Student | "new") => {
    setStudentModal(student);
    if (student === "new") {
      newStudentIdRef.current = uid("student");
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
    if (subject === "new") newSubjectIdRef.current = uid("subject");
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
    const current = latestDataRef.current;
    const timestamp = new Date().toISOString();
    const studentId = studentModal === "new" ? newStudentIdRef.current : studentModal.id;
    let nextStudents = [...current.students];
    if (!nextStudents.some((student) => student.id === studentId)) {
      nextStudents.push({ id: studentId, name, phone: studentDraft.phone.trim(), parentName: studentDraft.parentName.trim(), parentPhone: studentDraft.parentPhone.trim(), note: studentDraft.note.trim(), active: true, createdAt: timestamp, updatedAt: timestamp });
    } else {
      nextStudents = nextStudents.map((student) => student.id === studentId ? { ...student, name, phone: studentDraft.phone.trim(), parentName: studentDraft.parentName.trim(), parentPhone: studentDraft.parentPhone.trim(), note: studentDraft.note.trim(), updatedAt: timestamp } : student);
    }
    const existing = current.studentSubjects.filter((item) => item.studentId === studentId);
    const nextAssignments = current.subjects.flatMap((subject) => {
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
    const untouched = current.studentSubjects.filter((item) => item.studentId !== studentId);
    updateData({ ...current, students: nextStudents, studentSubjects: [...untouched, ...nextAssignments] });
    setStudentModal(null);
    notify(studentModal === "new" ? "Đã thêm học sinh mới." : "Đã cập nhật thông tin học sinh.");
  };

  const toggleStudentActive = (student: Student) => {
    const timestamp = new Date().toISOString();
    const current = latestDataRef.current;
    updateData({ ...current, students: current.students.map((item) => item.id === student.id ? { ...item, active: !item.active, updatedAt: timestamp } : item) });
    notify(student.active ? "Đã chuyển học sinh sang trạng thái nghỉ học." : "Đã kích hoạt lại học sinh.");
  };

  const saveSubject = () => {
    if (!subjectModal) return;
    const name = subjectName.trim();
    if (!name) {
      notify("Vui lòng nhập tên môn học.", "error");
      return;
    }
    const current = latestDataRef.current;
    const timestamp = new Date().toISOString();
    const subjectId = subjectModal === "new" ? newSubjectIdRef.current : subjectModal.id;
    if (!current.subjects.some((subject) => subject.id === subjectId)) {
      updateData({ ...current, subjects: [...current.subjects, { id: subjectId, name, active: true, createdAt: timestamp, updatedAt: timestamp }] });
      notify("Đã thêm môn học.");
    } else {
      updateData({ ...current, subjects: current.subjects.map((subject) => subject.id === subjectId ? { ...subject, name, updatedAt: timestamp } : subject) });
      notify("Đã đổi tên môn học.");
    }
    setSubjectModal(null);
  };

  const toggleSubject = (subject: Subject) => {
    const current = latestDataRef.current;
    updateData({ ...current, subjects: current.subjects.map((item) => item.id === subject.id ? { ...item, active: !item.active, updatedAt: new Date().toISOString() } : item) });
    notify(subject.active ? "Đã tạm ngưng môn học." : "Đã bật lại môn học.");
  };

  const saveLesson = (lesson: Lesson) => {
    const current = latestDataRef.current;
    const timestamp = new Date().toISOString();
    const exists = current.lessons.some((item) => item.id === lesson.id);
    const normalized = { ...lesson, durationMinutes: Number(lesson.durationMinutes) || 0, fee: Number(lesson.fee) || 0, updatedAt: timestamp };
    updateData({ ...current, lessons: exists ? current.lessons.map((item) => item.id === lesson.id ? normalized : item) : [...current.lessons, { ...normalized, createdAt: timestamp }] });
    setLessonModal(null);
    notify(exists ? "Đã cập nhật buổi dạy." : "Đã lưu buổi dạy vào sổ.");
  };

  const setReceiptPaid = async (target: ReceiptTarget, paid: boolean): Promise<boolean> => {
    const current = latestDataRef.current;
    if (!getReceiptLessons(current, target).length) return false;
    const timestamp = new Date().toISOString();
    const syncResult = await updateData(updateReceiptLessonsPaid(current, target, paid, timestamp));
    if (syncResult === false) return false;
    notify(syncResult === null
      ? (paid ? "Đã cập nhật trạng thái thu tiền trên thiết bị." : "Đã cập nhật trạng thái học phí trên thiết bị.")
      : (paid ? "Đã đồng bộ trạng thái thu tiền với Google Sheet." : "Đã đồng bộ trạng thái học phí với Google Sheet."));
    return true;
  };

  const removeLesson = () => {
    if (!confirmDelete) return;
    const current = latestDataRef.current;
    updateData({ ...current, lessons: current.lessons.filter((lesson) => lesson.id !== confirmDelete.id) });
    setConfirmDelete(null);
    notify("Đã xóa buổi dạy.");
  };

  // Only students already marked as no longer studying can be deleted. Their
  // subject assignments and lessons go with them; the queued snapshot then
  // removes those rows from Google Sheet on the next sync.
  const removeStudent = () => {
    if (!confirmDeleteStudent) return;
    const current = latestDataRef.current;
    const studentId = confirmDeleteStudent.id;
    const student = current.students.find((item) => item.id === studentId);
    setConfirmDeleteStudent(null);
    if (!student) return;
    if (student.active) {
      notify("Chỉ xóa được học sinh đã cho nghỉ học.", "error");
      return;
    }
    updateData({
      ...current,
      students: current.students.filter((item) => item.id !== studentId),
      studentSubjects: current.studentSubjects.filter((item) => item.studentId !== studentId),
      lessons: current.lessons.filter((lesson) => lesson.studentId !== studentId),
    });
    if (selectedStudentId === studentId) setSelectedStudentId(null);
    notify(`Đã xóa học sinh ${student.name} và các buổi học liên quan.`);
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

  const saveTimetable = (entries: TimetableEntry[]) => {
    if (!entries.length || !entries.every(isTimetableEntry)) return "Thông tin lịch dạy không hợp lệ.";
    const current = latestDataRef.current;
    const ids = new Set(entries.map((entry) => entry.id));
    const untouched = current.timetable.filter((entry) => !ids.has(entry.id));
    for (const entry of entries) {
      const conflict = timetableConflict([...untouched, ...entries], entry);
      if (conflict) return `${WEEKDAYS[entry.dayOfWeek - 1]} trùng giờ với ${conflict.title} (${conflict.startTime} – ${conflict.endTime}).`;
    }
    updateData({ ...current, timetable: [...untouched, ...entries] });
    notify("Đã lưu thời khóa biểu.");
    return null;
  };

  const removeTimetable = (id: string) => {
    const current = latestDataRef.current;
    updateData({ ...current, timetable: current.timetable.filter((item) => item.id !== id) });
    notify("Đã xóa ca khỏi thời khóa biểu.");
  };

  const saveTimetableTitle = (title: string) => {
    updateData({ ...latestDataRef.current, timetableTitle: title.trim().slice(0, 120) || "Thời khóa biểu" });
    notify("Đã lưu tiêu đề thời khóa biểu.");
  };

  const setSelectedMonths = (selected: string[]) => {
    const normalized = [...new Set(selected)].sort();
    setMonths(normalized);
    if (normalized.length) setMonth(normalized[normalized.length - 1]);
  };

  return {
    data, hydrated, view, setView, month, setMonth, months, setMonths: setSelectedMonths, search, setSearch,
    selectedStudentId, setSelectedStudentId,
    lessonModal, setLessonModal, studentModal, setStudentModal, studentDraft, setStudentDraft,
    subjectModal, setSubjectModal, subjectName, setSubjectName,
    receiptTarget, setReceiptTarget, notice, confirmDelete, setConfirmDelete,
    confirmDeleteStudent, setConfirmDeleteStudent, removeStudent,
    restoreRef, todayLessons,
    storageStatus, refreshRemoteData,
    openStudent, saveStudent, toggleStudentActive,
    openSubject, saveSubject, toggleSubject,
    saveLesson, setReceiptPaid, removeLesson, openRestore, notify,
    saveTimetable, removeTimetable, saveTimetableTitle,
  };
}
