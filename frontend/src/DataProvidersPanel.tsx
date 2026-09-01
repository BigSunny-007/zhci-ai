import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Database, RefreshCw, XCircle } from "lucide-react";
import { DataProviderHealth, getDataProviderHealth, getDataProviderHealthHistory, type DataProviderHealthHistory } from "./api";

type DataProvidersPanelProps = { token: string | null; isAdmin: boolean };

export default function DataProvidersPanel({ token, isAdmin }: DataProvidersPanelProps) {
  const [providers, setProviders] = useState<DataProviderHealth[] | null>(null);
  const [history, setHistory] = useState<DataProviderHealthHistory[]>([]);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadHealth = useCallback(() => {
    if (!token || !isAdmin) return () => undefined;
    setBusy(true);
    let active = true;
    Promise.all([getDataProviderHealth(token), getDataProviderHealthHistory(token, undefined, 30)]).then(([next, recent]) => { if (active) { setProviders(next); setHistory(recent); setError(false); } }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [token, isAdmin]);

  const refresh = () => { void loadHealth(); };

  useEffect(() => {
    if (!token || !isAdmin) { setProviders(null); return; }
    return loadHealth();
  }, [token, isAdmin, loadHealth]);

  if (!isAdmin) return null;
  const statusLabel: Record<DataProviderHealth["status"], string> = { healthy: "健康", demo: "演示", timeout: "超时", error: "异常", unavailable: "不可用" };
  const healthyHistory = history.filter((item) => item.status === "healthy" || item.status === "demo").length;
  const measuredLatency = history.flatMap((item) => item.latency_ms === null ? [] : [item.latency_ms]);
  const averageLatency = measuredLatency.length ? Math.round(measuredLatency.reduce((sum, value) => sum + value, 0) / measuredLatency.length) : null;
  return <section className="providers-panel panel"><div className="panel-header compact"><div><div className="section-kicker"><Database size={14}/>数据接入</div><h2>行情 Provider 健康度</h2><p>管理员手动探测指数快照，显示延迟与数据新鲜度</p></div><button className="provider-refresh" type="button" onClick={refresh} disabled={busy}><RefreshCw size={13} className={busy ? "spinning" : ""}/>立即探测</button></div>{error && <p className="providers-empty">数据源健康探测失败 · 请稍后重试</p>}{!providers && !error && <p className="providers-empty">正在探测数据源…</p>}{providers && <><div className="providers-list">{providers.map((provider) => <div className={provider.configured ? "provider-row configured" : "provider-row"} key={provider.name}><span className="provider-icon">{provider.status === "healthy" || provider.status === "demo" ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}</span><span><strong>{provider.name} · {statusLabel[provider.status]}</strong><small>{provider.kind} · {provider.message}</small></span><em>{provider.latency_ms === null ? "—" : `${provider.latency_ms} ms`}{provider.snapshot_age_seconds === null ? "" : ` · ${provider.snapshot_age_seconds}s`}</em></div>)}</div><div className="provider-history">最近 {history.length} 次探测：{healthyHistory} 次成功{averageLatency === null ? " · 平均延迟暂无" : ` · 平均延迟 ${averageLatency} ms`}</div></>}</section>;
}
