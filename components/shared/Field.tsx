"use client";

import { Label } from "@/components/ui/label";

export function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="field space-y-2"><Label className="flex items-center gap-1.5 text-slate-600"><span className="text-primary">{icon}</span>{label}</Label>{children}</div>;
}
