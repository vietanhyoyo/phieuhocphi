"use client";

import { FormEvent, useState } from "react";
import { KeyRound, LoaderCircle, LockKeyhole } from "lucide-react";
import { Field } from "@/components/shared/Field";
import { ModalShell } from "@/components/shared/ModalShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ChangePasswordModal({ onClose, onPasswordChanged }: { onClose: () => void; onPasswordChanged: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Mật khẩu mới cần có ít nhất 8 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(body.message || "Không thể đổi mật khẩu lúc này.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onPasswordChanged();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Không thể đổi mật khẩu lúc này.");
    } finally {
      setBusy(false);
    }
  };

  return <ModalShell title="Đổi mật khẩu" subtitle="Nhập mật khẩu hiện tại và đặt mật khẩu mới." onClose={onClose}>
    <form className="modal-form" onSubmit={submit}>
      <Field label="Mật khẩu hiện tại" icon={<LockKeyhole size={15} />}>
        <Input autoFocus type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
      </Field>
      <Field label="Mật khẩu mới" icon={<KeyRound size={15} />}>
        <Input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
      </Field>
      <Field label="Xác nhận mật khẩu mới" icon={<KeyRound size={15} />}>
        <Input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
      </Field>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="modal-footer">
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Hủy</Button>
        <Button type="submit" className="rounded-xl" disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} {busy ? "Đang lưu…" : "Đổi mật khẩu"}</Button>
      </div>
    </form>
  </ModalShell>;
}
