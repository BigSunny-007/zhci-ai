import { useEffect, useState } from "react";
import { Fingerprint, ShieldCheck, ShieldX } from "lucide-react";
import { getAuditEvents, getAuditIntegrity, type AuditEventSummary, type AuditIntegrityReport } from "./api";

type AuditPanelProps = { token: string | null; isAdmin: boolean };

export default function AuditPanel({ token, isAdmin }: AuditPanelProps) {
  const [report, setReport] = useState<AuditIntegrityReport | null>(null);
  const [error, setError] = useState(false);
  const [events, setEvents] = useState<AuditEventSummary[]>([]);

  useEffect(() => {
    if (!token || !isAdmin) {
      setReport(null);
      return;
    }
    let active = true;
    Promise.all([getAuditIntegrity(token), getAuditEvents(token, 8)]).then(([next, recent]) => {
      if (active) { setReport(next); setEvents(recent); setError(false); }
    }).catch(() => {
      if (active) setError(true);
    });
    return () => { active = false; };
  }, [token, isAdmin]);

  if (!isAdmin) return null;
  return <section className="audit-panel panel"><div className="panel-header compact"><div><div className="section-kicker"><Fingerprint size={14}/>审计完整性</div><h2>证据链校验</h2><p>校验签名并查看最近操作摘要（不含事件正文）</p></div></div>{error && <p className="audit-empty">审计报告同步失败 · 请稍后重试</p>}{!report && !error && <p className="audit-empty">正在校验审计事件…</p>}{report && <><div className="audit-kpis"><div><ShieldCheck size={14}/><span>有效</span><strong>{report.valid_events}</strong></div><div><ShieldX size={14}/><span>异常</span><strong className="audit-danger">{report.invalid_events}</strong></div><div><span>不可验证</span><strong>{report.unverifiable_events}</strong></div><div><span>已检查</span><strong>{report.checked_events}</strong></div></div>{events.length > 0 && <div className="audit-events">{events.map((event) => <div className="audit-event" key={event.event_id}><span>{event.action}</span><small>{event.resource_type} · {new Date(event.created_at).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</small></div>)}</div>}<div className="audit-foot">{report.data_scope}</div></>}</section>;
}
