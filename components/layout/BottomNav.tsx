"use client";

import { Home, NotebookPen, Users, WalletCards } from "lucide-react";
import { View } from "@/lib/types";

export function BottomNav({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  const items: { key: View; label: string; icon: typeof Home }[] = [
    { key: "home", label: "Trang chủ", icon: Home },
    { key: "lessons", label: "Buổi dạy", icon: NotebookPen },
    { key: "students", label: "Học sinh", icon: Users },
    { key: "tuition", label: "Học phí", icon: WalletCards },
  ];
  return <nav className="bottom-nav" aria-label="Điều hướng chính">{items.map(({ key, label, icon: Icon }) => <button className={`nav-item ${view === key ? "active" : ""}`} key={key} onClick={() => onChange(key)} aria-current={view === key ? "page" : undefined}><span className="nav-icon"><Icon size={19} strokeWidth={view === key ? 2.5 : 2} /></span><span>{label}</span></button>)}</nav>;
}
