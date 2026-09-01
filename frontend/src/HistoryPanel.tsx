import { useEffect, useMemo, useState } from "react";
import { AreaChart } from "lucide-react";
import { getHistory, MarketHistoryPoint } from "./api";
import "./history.css";

type HistoryPanelProps = { token: string | null; symbol: string };
const RANGE_OPTIONS = [5, 30, 90, 180] as const;

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
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(Boolean(token));
  const [status, setStatus] = useState(token ? "正在同步" : "登录后查看");

  useEffect(() => {
    if (!token) { setPoints([]); setStatus("登录后查看"); setLoading(false); return; }
    let active = true;
    setPoints([]);
    setLoading(true);
    setStatus(`正在同步近 ${days} 个交易日`);
    getHistory(token, symbol, days).then((next) => {
      if (!active) return;
      setPoints(next);
      setStatus(next.length ? `近 ${days} 个交易日` : "暂无历史数据");
    }).catch(() => { if (active) setStatus("同步失败 · 请重试"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, symbol, days]);

  const path = useMemo(() => pathFor(points), [points]);
  const hasFlow = points.some((point) => point.net_inflow !== 0);
  const maxVolume = Math.max(...points.map((point) => point.volume), 1);
  const latest = points.at(-1)?.close;
  const first = points[0]?.close;
  const change = latest != null && first ? (latest - first) / first : null;
  return <section className="history-panel panel"><div className="panel-header compact"><div><div className="section-kicker"><AreaChart size={14}/>历史走势</div><h2>{symbol} <span className="ticker">{status}</span></h2><p>收盘价与成交量 · 数据来自当前配置 Provider</p></div><div className="history-range" role="group" aria-label="历史行情区间">{RANGE_OPTIONS.map((option) => <button key={option} type="button" className={days === option ? "active" : ""} aria-pressed={days === option} disabled={!token || loading} onClick={() => setDays(option)}>{option}日</button>)}</div></div>{!token && <p className="history-empty">登录后查看真实历史行情，演示区不绘制虚假曲线。</p>}{token && loading && <p className="history-empty">{status}</p>}{token && !loading && !path && <p className="history-empty">{status}</p>}{path && <><div className="history-meta"><span>最新 <strong>¥{latest?.toFixed(2)}</strong></span><span className={change != null && change >= 0 ? "history-positive" : "history-negative"}>{change != null ? `${change >= 0 ? "+" : ""}${(change * 100).toFixed(2)}%` : "—"} 区间</span><span>资金流 {hasFlow ? "可用" : "未提供"}</span></div><svg className="history-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${symbol} 历史收盘价与成交量曲线`}>{points.map((point, index) => <rect key={`${point.time}-volume`} className="volume-bar" x={(index / points.length * 100).toFixed(2)} y={(100 - point.volume / maxVolume * 28).toFixed(2)} width={(96 / points.length).toFixed(2)} height={(point.volume / maxVolume * 28).toFixed(2)}/>) }<path d={path} fill="none" stroke="#c95750" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg><div className="history-foot"><span>{points.length} 个数据点 · {hasFlow ? "资金流已返回" : "资金流未提供"}</span><span>{new Date(points[0].time).toLocaleDateString("zh-CN")} – {new Date(points.at(-1)!.time).toLocaleDateString("zh-CN")}</span></div></>}</section>;
}
