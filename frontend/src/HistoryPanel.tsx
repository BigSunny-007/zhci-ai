import { useEffect, useMemo, useState } from "react";
import { AreaChart } from "lucide-react";
import { getHistory, MarketHistoryPoint } from "./api";
import "./history.css";

type HistoryPanelProps = { token: string | null; symbol: string };

function pathFor(points: MarketHistoryPoint[]): string {
  if (points.length < 2) return "";
  const values = points.map((point) => point.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((value, index) => ` ${index ? "L" : "M"}${(index / (values.length - 1) * 100).toFixed(2)},${(94 - (value - min) / range * 82).toFixed(2)}`).join("");
}

export default function HistoryPanel({ token, symbol }: HistoryPanelProps) {
  const [points, setPoints] = useState<MarketHistoryPoint[]>([]);
  const [status, setStatus] = useState(token ? "正在同步" : "登录后查看");

  useEffect(() => {
    if (!token) { setPoints([]); setStatus("登录后查看"); return; }
    let active = true;
    setStatus("正在同步");
    getHistory(token, symbol).then((next) => {
      if (!active) return;
      setPoints(next);
      setStatus(next.length ? "近 30 个交易日" : "暂无历史数据");
    }).catch(() => { if (active) setStatus("同步失败 · 保留上次走势"); });
    return () => { active = false; };
  }, [token, symbol]);

  const path = useMemo(() => pathFor(points), [points]);
  const latest = points.at(-1)?.close;
  const first = points[0]?.close;
  const change = latest != null && first ? (latest - first) / first : null;
  return <section className="history-panel panel"><div className="panel-header compact"><div><div className="section-kicker"><AreaChart size={14}/>历史走势</div><h2>{symbol} <span className="ticker">{status}</span></h2><p>收盘价曲线 · 数据来自当前配置 Provider</p></div></div>{!token && <p className="history-empty">登录后查看真实历史行情，演示区不绘制虚假曲线。</p>}{token && !path && <p className="history-empty">{status}</p>}{path && <><div className="history-meta"><span>最新 <strong>¥{latest?.toFixed(2)}</strong></span><span className={change != null && change >= 0 ? "history-positive" : "history-negative"}>{change != null ? `${change >= 0 ? "+" : ""}${(change * 100).toFixed(2)}%` : "—"} 区间</span></div><svg className="history-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${symbol} 历史收盘价曲线`}><path d={path} fill="none" stroke="#c95750" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg><div className="history-foot"><span>{points.length} 个数据点</span><span>{new Date(points[0].time).toLocaleDateString("zh-CN")} – {new Date(points.at(-1)!.time).toLocaleDateString("zh-CN")}</span></div></>}</section>;
}
