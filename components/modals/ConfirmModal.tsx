"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/shared/ModalShell";

export function ConfirmModal({ title, message, confirmLabel, onClose, onConfirm }: { title: string; message: string; confirmLabel: string; onClose: () => void; onConfirm: () => void }) {
  return <ModalShell title={title} subtitle={message} onClose={onClose}><div className="confirm-icon"><Trash2 size={24} /></div><div className="modal-footer"><Button type="button" variant="ghost" onClick={onClose}>Hủy</Button><Button type="button" onClick={onConfirm} className="rounded-xl bg-red-500 hover:bg-red-600"><Trash2 className="h-4 w-4" /> {confirmLabel}</Button></div></ModalShell>;
}
