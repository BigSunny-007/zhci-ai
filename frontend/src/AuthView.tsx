import { type FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, ShieldCheck, Sparkles } from "lucide-react";
import { ApiError, clearSession, login, register, resendVerification, saveSession, TokenSession, UserProfile } from "./api";
import "./auth.css";

type AuthViewProps = {
  onAuthenticated: (session: TokenSession, profile?: UserProfile) => void;
  onDemo?: () => void;
};

export default function AuthView({ onAuthenticated, onDemo }: AuthViewProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verificationPending, setVerificationPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "login") {
        const session = await login(email, password);
        saveSession(session);
        onAuthenticated(session);
      } else {
        const result = await register(email, password, displayName || "投资者");
        if (result.verificationRequired) {
          clearSession();
          setVerificationPending(true);
          setNotice("注册成功，请完成邮箱验证后再登录。开发环境可在接口响应中查看验证令牌。");
          return;
        }
        saveSession(result);
        onAuthenticated(result);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "网络暂不可用，请检查 API 地址");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!email) return;
    setBusy(true);
    try {
      const result = await resendVerification(email);
      setNotice(`${result.message}${result.verificationToken ? ` · 开发令牌：${result.verificationToken}` : ""}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "验证邮件发送失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand"><span className="auth-mark"><Sparkles size={17} /></span><span><strong>智策 AI</strong><small>ZHICE INTELLIGENCE</small></span></div>
        <div className="auth-copy"><span className="auth-kicker">个人投研工作台</span><h1>让每个判断，都有依据。</h1><p>连接行情、资金流与新闻，构建可追溯的投资观察。</p></div>
        <div className="auth-tabs" role="tablist">
          <button className={mode === "login" ? "selected" : ""} onClick={() => setMode("login")} role="tab" aria-selected={mode === "login"}>登录</button>
          <button className={mode === "register" ? "selected" : ""} onClick={() => setMode("register")} role="tab" aria-selected={mode === "register"}>注册账号</button>
        </div>
        <form onSubmit={submit}>
          {mode === "register" && <label>显示名称<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="例如：林先生" autoComplete="name" /></label>}
          <label>邮箱地址<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@example.com" autoComplete="email" required /></label>
          <label>密码<div className="password-field"><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} minLength={8} placeholder="至少 8 位字符" autoComplete={mode === "login" ? "current-password" : "new-password"} required /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "隐藏密码" : "显示密码"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          {verificationPending && <button type="button" className="resend-verification" onClick={() => void resend()} disabled={busy}>重新发送验证邮件</button>}
          <button className="auth-submit" disabled={busy}>{busy ? "处理中…" : mode === "login" ? "进入工作台" : "创建我的工作区"}<ArrowRight size={16} /></button>
        </form>
        <div className="auth-foot"><ShieldCheck size={14} /><span>数据仅用于投研辅助，不构成投资建议</span></div>
        {onDemo && <button className="demo-link" onClick={onDemo}>先浏览演示工作台</button>}
      </section>
    </main>
  );
}
