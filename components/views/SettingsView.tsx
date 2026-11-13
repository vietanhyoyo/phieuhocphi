"use client";

import { Fragment, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, BookOpen, CheckCircle2, ChevronRight, Cloud, Download, KeyRound, Loader2, LogOut, Pencil, Plus, ShieldCheck, Upload, WifiOff } from "lucide-react";
import { ChangePasswordModal } from "@/components/modals/ChangePasswordModal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { AppData, AuthUser, Subject } from "@/lib/types";

type StorageStatus = "checking" | "local" | "cloud" | "syncing" | "error";

const STORAGE_META: Record<StorageStatus, { title: string; description: string; variant: "success" | "info" | "warning"; icon: typeof Cloud; spin?: boolean }> = {
  cloud: { title: "Đã đồng bộ Google Sheet", description: "Dữ liệu được sao lưu trên Google Sheet, bản đệm vẫn giữ trên thiết bị.", variant: "success", icon: CheckCircle2 },
  syncing: { title: "Đang đồng bộ Google Sheet…", description: "Các thay đổi đang được gửi lên Google Sheet.", variant: "info", icon: Loader2, spin: true },
  checking: { title: "Đang kiểm tra nơi lưu trữ…", description: "Đang kết nối tới Google Sheet.", variant: "info", icon: Cloud },
  error: { title: "Đang lưu tạm trên thiết bị", description: "Không kết nối được Google Sheet. Dữ liệu sẽ đồng bộ lại khi có mạng.", variant: "warning", icon: WifiOff },
  local: { title: "Chỉ lưu trên thiết bị", description: "Chưa cấu hình Google Sheet, dữ liệu chỉ nằm trong trình duyệt này.", variant: "warning", icon: WifiOff },
};

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="m-0 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{children}</p>;
}

function ActionRow({ icon, iconClassName, title, description, onClick, destructive }: { icon: ReactNode; iconClassName: string; title: string; description?: string; onClick: () => void; destructive?: boolean }) {
  return <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 bg-transparent px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none">
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", iconClassName)}>{icon}</span>
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className={cn("text-sm font-medium", destructive ? "text-red-600" : "text-slate-800")}>{title}</span>
      {description && <span className="text-xs text-slate-500">{description}</span>}
    </span>
    {!destructive && <ChevronRight className="size-4 text-slate-300 transition-transform group-hover:translate-x-0.5" />}
  </button>;
}

export function SettingsView({ data, storageStatus, currentUser, onLogout, onPasswordChanged, onBack, onAddSubject, onEditSubject, onToggleSubject, onBackup, onRestore }: { data: AppData; storageStatus: StorageStatus; currentUser: AuthUser | null; onLogout: () => void; onPasswordChanged: () => void; onBack: () => void; onAddSubject: () => void; onEditSubject: (subject: Subject) => void; onToggleSubject: (subject: Subject) => void; onBackup: () => void; onRestore: () => void }) {
  const [changingPassword, setChangingPassword] = useState(false);
  const storage = STORAGE_META[storageStatus];
  const StorageIcon = storage.icon;
  const activeCount = data.subjects.filter((subject) => subject.active).length;

  return <div className="flex flex-col gap-6 pb-2 pt-2">
    <header className="flex items-center justify-between gap-3 px-1">
      <p className="m-0 text-sm text-slate-500">Quản lý tài khoản, môn học và dữ liệu.</p>
      <Badge variant="success" className="shrink-0 gap-1 px-2 py-1"><ShieldCheck className="size-3.5" /> Riêng tư</Badge>
    </header>

    {currentUser && <section className="flex flex-col gap-2">
      <SectionLabel>Tài khoản</SectionLabel>
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-base font-semibold uppercase text-white shadow-sm">{currentUser.username.slice(0, 1)}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[15px] font-semibold text-slate-900">{currentUser.username}</span>
            <span className="text-xs text-slate-500">Đang đăng nhập</span>
          </div>
        </div>
        <Separator />
        <ActionRow icon={<KeyRound className="size-4" />} iconClassName="bg-indigo-50 text-indigo-600" title="Đổi mật khẩu" description="Cập nhật mật khẩu đăng nhập" onClick={() => setChangingPassword(true)} />
        <Separator />
        <ActionRow icon={<LogOut className="size-4" />} iconClassName="bg-red-50 text-red-500" title="Đăng xuất" onClick={onLogout} destructive />
      </Card>
    </section>}

    <section className="flex flex-col gap-2">
      <SectionLabel>Lưu trữ</SectionLabel>
      <Alert variant={storage.variant}>
        <StorageIcon className={cn(storage.spin && "animate-spin")} />
        <div className="flex flex-col gap-1">
          <AlertTitle className="m-0">{storage.title}</AlertTitle>
          <AlertDescription>{storage.description}</AlertDescription>
        </div>
      </Alert>
    </section>

    <section className="flex flex-col gap-2">
      <SectionLabel>Danh mục</SectionLabel>
      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 p-4">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Môn học</CardTitle>
            <CardDescription>{activeCount}/{data.subjects.length} môn đang hoạt động</CardDescription>
          </div>
          <Button size="sm" variant="secondary" className="h-8 rounded-lg px-3 text-xs" onClick={onAddSubject}><Plus className="size-4" /> Thêm môn</Button>
        </CardHeader>
        <Separator />
        {data.subjects.length === 0
          ? <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <BookOpen className="size-6 text-slate-300" />
            <span className="text-sm text-slate-500">Chưa có môn học nào</span>
          </div>
          : <ul className="m-0 list-none p-0">{data.subjects.map((subject, index) => <Fragment key={subject.id}>
            {index > 0 && <Separator className="ml-16 w-auto" />}
            <li className="flex items-center gap-3 px-4 py-3">
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", subject.active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400")}><BookOpen className="size-4" /></span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cn("truncate text-sm font-medium", subject.active ? "text-slate-800" : "text-slate-400 line-through decoration-slate-300")}>{subject.name}</span>
                <span className="text-xs text-slate-500">{subject.active ? "Đang hoạt động" : "Đã tạm ngưng"}</span>
              </div>
              <Button size="icon-sm" variant="ghost" className="text-slate-500" onClick={() => onEditSubject(subject)} aria-label={`Đổi tên môn ${subject.name}`}><Pencil className="size-4" /></Button>
              <Switch checked={subject.active} onCheckedChange={() => onToggleSubject(subject)} aria-label={subject.active ? `Tạm ngưng môn ${subject.name}` : `Bật môn ${subject.name}`} />
            </li>
          </Fragment>)}</ul>}
        <Separator />
        <p className="m-0 flex items-center gap-1.5 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-500"><ShieldCheck className="size-3.5 shrink-0" /> Môn đã có trong lịch sử sẽ được tạm ngưng thay vì xóa.</p>
      </Card>
    </section>

    <section className="flex flex-col gap-2">
      <SectionLabel>Dữ liệu</SectionLabel>
      <Card className="overflow-hidden">
        <ActionRow icon={<Download className="size-4" />} iconClassName="bg-sky-50 text-sky-600" title="Xuất bản sao lưu" description="Tải toàn bộ dữ liệu thành file JSON" onClick={onBackup} />
        <Separator className="ml-16 w-auto" />
        <ActionRow icon={<Upload className="size-4" />} iconClassName="bg-emerald-50 text-emerald-600" title="Khôi phục dữ liệu" description="Nhập lại từ file backup đã lưu" onClick={onRestore} />
      </Card>
      <Alert variant="warning" className="py-2.5">
        <AlertTriangle />
        <AlertDescription className="opacity-100">Backup định kỳ giúp bạn không mất dữ liệu khi đổi thiết bị hoặc xóa trình duyệt.</AlertDescription>
      </Alert>
    </section>

    <Card className="bg-slate-50/60 shadow-none">
      <CardContent className="flex items-center gap-3 p-4">
        <span className="size-10 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm"><img src="/app-logo.png" alt="Logo Sổ học phí" className="size-full object-contain" /></span>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold text-slate-800">Sổ học phí</span>
          <span className="text-xs text-slate-500">Google Sheet + bản đệm offline</span>
        </div>
      </CardContent>
    </Card>

    <Button variant="ghost" className="mx-auto text-slate-500" onClick={onBack}><ArrowLeft className="size-4" /> Về trang chủ</Button>
    {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} onPasswordChanged={onPasswordChanged} />}
  </div>;
}
