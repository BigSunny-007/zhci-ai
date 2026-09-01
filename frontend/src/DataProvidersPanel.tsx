import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Database, RefreshCw, XCircle } from "lucide-react";
import { DataProviderHealth, getDataProviderHealth } from "./api";

type DataProvidersPanelProps = { token: string | null; isAdmin: boolean };

export default function DataProvidersPanel({ token, isAdmin }: DataProvidersPanelProps) {
  const [providers, setProviders] = useState<DataProviderHealth[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadHealth = useCallback(() => {
    if (!token || !isAdmin) return () => undefined;
    setBusy(true);
    let active = true;
    getDataProviderHealth(token).then((next) => { if (active) { setProviders(next); setError(false); } }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [token, isAdmin]);

  const refresh = () => { void loadHealth(); };

  useEffect(() => {
    if (!token || !isAdmin) { setProviders(null); return; }
    return loadHealth();
  }, [token, isAdmin, loadHealth]);

  if (!isAdmin) return null;
  const statusLabel: Record<DataProviderHealth["status"], string> = { healthy: "健康", demo: "演示", timeout: "超时", error: "异常", unavailable: "不可用" };
  return <section className="providers-panel panel"><div className="panel-header compact"><div><div className="section-kicker"><Database size={14}/>数据接入</div><h2>行情 Provider 健康度</h2><p>管理员手动探测指数快照，显示延迟与数据新鲜度</p></div><button className="provider-refresh" type="button" onClick={refresh} disabled={busy}><RefreshCw size={13} className={busy ? "spinning" : ""}/>立即探测</button></div>{error && <p className="providers-empty">数据源健康探测失败 · 请稍后重试</p>}{!providers && !error && <p className="providers-empty">正在探测数据源…</p>}{providers && <div className="providers-list">{providers.map((provider) => <div className={provider.configured ? "provider-row configured" : "provider-row"} key={provider.name}><span className="provider-icon">{provider.status === "healthy" || provider.status === "demo" ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}</span><span><strong>{provider.name} · {statusLabel[provider.status]}</strong><small>{provider.kind} · {provider.message}</small></span><em>{provider.latency_ms === null ? "—" : `${provider.latency_ms} ms`}{provider.snapshot_age_seconds === null ? "" : ` · ${provider.snapshot_age_seconds}s`}</em></div>)}</div>}</section>;
}
