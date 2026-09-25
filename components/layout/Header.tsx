"use client";

import { ArrowLeft, Settings } from "lucide-react";
import { View } from "@/lib/types";

export function Header({ view, onSettings, onBack }: { view: View; onSettings: () => void; onBack: () => void }) {
  const isSubpage = view === "settings";
  return (
    <header className="app-header">
      {isSubpage ? <button className="icon-button" aria-label="Quay lại" onClick={onBack}><ArrowLeft size={20} /></button> : <div className="brand-mark brand-image"><img src="/app-logo.png" alt="Logo Sổ học phí" /></div>}
      <div className="header-title-wrap"><span className="eyebrow">TRỢ LÝ GIA SƯ</span><h1>{isSubpage ? "Cài đặt" : "Sổ học phí"}</h1></div>
      {!isSubpage ? <button className="icon-button" aria-label="Mở cài đặt" onClick={onSettings}><Settings size={20} /></button> : <div className="header-spacer" />}
    </header>
  );
}
