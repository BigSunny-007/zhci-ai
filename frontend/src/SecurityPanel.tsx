import { FormEvent, useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { changePassword } from "./api";

type SecurityPanelProps = { token: string | null; onSessionInvalidated: () => void };

export default function SecurityPanel({ token, onSessionInvalidated }: SecurityPanelProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("登录后可轮换密码");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || newPassword.length < 8) return;
    setState("loading");
    try {
      await changePassword(token, currentPassword, newPassword);
      setMessage("密码已更新，正在退出当前会话…");
      setCurrentPassword(""); setNewPassword("");
      onSessionInvalidated();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "密码更新失败");
    }
  };

  return <section className="security-panel panel"><div className="panel-header compact"><div><div className="section-kicker"><KeyRound size={14}/>账号安全</div><h2>轮换登录密码</h2><p>更新后会立即使旧会话失效</p></div></div><form className="security-form" onSubmit={submit}><input aria-label="当前密码" type="password" minLength={8} placeholder="当前密码" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={!token}/><input aria-label="新密码" type="password" minLength={8} placeholder="新密码（至少 8 位）" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} disabled={!token}/><button className="security-submit" disabled={!token || state === "loading"}>{state === "loading" ? "更新中…" : "更新密码"}</button></form><div className={state === "error" ? "security-message error" : "security-message"}><ShieldCheck size={13}/>{message}</div></section>;
}
