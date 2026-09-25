"use client";

import { BookOpen, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalShell } from "@/components/shared/ModalShell";
import { Field } from "@/components/shared/Field";
import { Subject } from "@/lib/types";

export function SubjectModal({ initial, name, setName, onClose, onSave }: { initial: Subject | null; name: string; setName: (value: string) => void; onClose: () => void; onSave: () => void }) {
  return <ModalShell title={initial ? "Đổi tên môn học" : "Thêm môn học"} subtitle="Môn học sẽ dùng khi gán cho học sinh" onClose={onClose}><div className="modal-form"><Field label="Tên môn học" icon={<BookOpen size={16} />}><Input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onSave()} placeholder="Ví dụ: Tiếng Anh" /></Field></div><div className="modal-footer"><Button type="button" variant="ghost" onClick={onClose}>Hủy</Button><Button type="button" onClick={onSave} className="rounded-xl"><Check className="h-4 w-4" /> Lưu môn học</Button></div></ModalShell>;
}
