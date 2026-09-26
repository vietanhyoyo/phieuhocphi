"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { AuthUser } from "@/lib/types";

export function AuthView({ hasUsers, notice, onAuthenticated }: { hasUsers: boolean; notice?: string; onAuthenticated: (user: AuthUser) => void }) {
  const [registerMode, setRegisterMode] = useState(!hasUsers);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hasUsers) setRegisterMode(true);
  }, [hasUsers]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: registerMode ? "register" : "login", username, password }) });
      const body = (await response.json().catch(() => ({}))) as { user?: AuthUser; message?: string };
      if (!response.ok || !body.user) throw new Error(body.message || "Không thể xác thực tài khoản.");
      onAuthenticated(body.user);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Không thể xác thực tài khoản.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="auth-screen"><div className="auth-card"><div className="brand-mark brand-image auth-logo"><img src="/app-logo.png" alt="Logo Sổ học phí" /></div><span className="settings-badge">Google Sheet · Dữ liệu riêng tư</span><h1>{registerMode ? "Tạo tài khoản" : "Đăng nhập"}</h1><p>{registerMode ? "Tạo tài khoản để có một sổ học phí riêng trên Google Sheet." : "Đăng nhập để mở dữ liệu học sinh và học phí của bạn."}</p>{notice && !registerMode && <div className="password-success" role="status">{notice}</div>}<form onSubmit={submit}><label><span>Tên đăng nhập</span><div className="auth-input"><UserRound size={17} /><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></div></label><label><span>Mật khẩu</span><div className="auth-input"><LockKeyhole size={17} /><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} minLength={8} autoComplete={registerMode ? "new-password" : "current-password"} required /><button className="password-toggle" type="button" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>{error && <div className="auth-error">{error}</div>}<button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Đang xử lý…" : registerMode ? "Tạo tài khoản" : "Đăng nhập"}<ArrowRight size={17} /></button></form>{hasUsers && <button className="auth-switch" type="button" onClick={() => { setRegisterMode((mode) => !mode); setError(""); }}>{registerMode ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Tạo tài khoản"}</button>}</div></main>;
}
