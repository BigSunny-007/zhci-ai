import { useEffect, useState } from "react";
import { CheckCircle2, Database, XCircle } from "lucide-react";
import { DataProviderStatus, getDataProviders } from "./api";

type DataProvidersPanelProps = { token: string | null; isAdmin: boolean };

export default function DataProvidersPanel({ token, isAdmin }: DataProvidersPanelProps) {
  const [providers, setProviders] = useState<DataProviderStatus[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token || !isAdmin) { setProviders(null); return; }
    let active = true;
    getDataProviders(token).then((next) => { if (active) { setProviders(next); setError(false); } }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [token, isAdmin]);

  if (!isAdmin) return null;
  return <section className="providers-panel panel"><div className="panel-header compact"><div><div className="section-kicker"><Database size={14}/>数据接入</div><h2>行情 Provider 健康度</h2><p>只读显示配置与可用性，不伪造实时状态</p></div></div>{error && <p className="providers-empty">数据源目录同步失败 · 请检查后台服务</p>}{!providers && !error && <p className="providers-empty">正在读取数据源目录…</p>}{providers && <div className="providers-list">{providers.map((provider) => <div className={provider.configured ? "provider-row configured" : "provider-row"} key={provider.name}><span className="provider-icon">{provider.available ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}</span><span><strong>{provider.name}</strong><small>{provider.kind} · {provider.description}</small></span><em>{provider.configured ? "当前配置" : provider.available ? "可切换" : "未安装"}</em></div>)}</div>}</section>;
}
