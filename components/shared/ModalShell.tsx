"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function ModalShell({ title, subtitle, onClose, children, wide = false }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const category = title.toLowerCase().includes("buổi") ? "BUỔI DẠY" : title.toLowerCase().includes("học sinh") ? "HỌC SINH" : title.toLowerCase().includes("môn") ? "MÔN HỌC" : "XÁC NHẬN";
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className={`modal-sheet ${wide ? "wide" : ""}`} role="dialog" aria-modal="true"><div className="modal-grabber" /><div className="mb-6 flex items-start justify-between gap-4"><div><Badge variant="secondary" className="mb-2">{category}</Badge><h3 className="font-sans text-xl font-bold tracking-tight text-slate-900">{title}</h3>{subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}</div><Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Đóng" className="rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"><X className="h-4 w-4" /></Button></div>{children}</section></div>;
}
