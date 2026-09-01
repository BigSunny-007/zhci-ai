import { useEffect, useState } from "react";
import { LineChart } from "lucide-react";
import { getMarketIndex, type MarketIndexSnapshot } from "./api";
import "./market-index.css";

type MarketIndexPanelProps = { token: string | null };

export default function MarketIndexPanel({ token }: MarketIndexPanelProps) {
  const [snapshot, setSnapshot] = useState<MarketIndexSnapshot | null>(null);
  const [status, setStatus] = useState(token ? "正在同步大盘快照…" : "登录后查看真实大盘");

  useEffect(() => {
    if (!token) {
      setSnapshot(null);
      setStatus("登录后查看真实大盘");
      return;
    }
    let active = true;
    setSnapshot(null);
    setStatus("正在同步大盘快照…");
    getMarketIndex(token).then((next) => {
      if (!active) return;
      setSnapshot(next);
      setStatus("快照已同步");
    }).catch(() => {
      if (active) setStatus("大盘快照同步失败 · 请稍后重试");
    });
    return () => { active = false; };
  }, [token]);

  const change = snapshot?.change_percent ?? 0;
  const changeLabel = snapshot ? (change >= 0 ? "+" : "") + change.toFixed(2) + "%" : "—";
  const sourceLabel = snapshot ? "数据源 " + snapshot.source + " · " + new Date(snapshot.as_of).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : status;
  return <section className="market-index-panel panel"><div className="panel-header compact"><div><div className="section-kicker"><LineChart size={14}/>大盘环境</div><h2>{snapshot?.name ?? "上证指数"} <span className="ticker">{snapshot?.symbol ?? "000001.SH"}</span></h2><p>{sourceLabel}</p></div></div>{!snapshot && <p className="market-index-empty">{status}</p>}{snapshot && <div className="market-index-body"><div><span>指数点位</span><strong>{snapshot.price.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div><div><span>涨跌幅</span><strong className={change >= 0 ? "market-index-positive" : "market-index-negative"}>{changeLabel}</strong></div><div><span>涨跌额</span><strong className={change >= 0 ? "market-index-positive" : "market-index-negative"}>{snapshot.change >= 0 ? "+" : ""}{snapshot.change.toFixed(2)}</strong></div><span className="market-index-status">{snapshot.data_status === "demo" ? "演示数据 · 非实时" : "已接入 Provider"}</span></div>}</section>;
}
