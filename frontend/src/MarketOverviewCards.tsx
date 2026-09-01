import { LineChart, Sparkles } from "lucide-react";
import type { MarketIndexSnapshot, Recommendation } from "./api";

type MarketOverviewCardsProps = {
  authenticated: boolean;
  marketIndex: MarketIndexSnapshot | null;
  recommendation: Recommendation | null;
  onViewRecommendation: () => void;
};

const DEMO_INDEX = { price: "3,387.42", change: "+0.63%", amount: "4,128亿", up: "2,846", down: "1,702" };

function MiniSparkline({ trend = "up" }: { trend?: "up" | "down" }) {
  const points = trend === "up" ? "0,78 18,70 35,73 52,52 68,58 84,28 100,15" : "0,18 18,27 35,25 52,47 68,40 84,70 100,84";
  return <svg className="sparkline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} fill="none" stroke={trend === "up" ? "#d35f58" : "#2c9b80"} strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg>;
}

function temperatureFromRecommendation(recommendation: Recommendation | null): { label: string; score: number } | null {
  if (!recommendation) return null;
  const rawScore = Number(recommendation.evidence.score);
  if (!Number.isFinite(rawScore)) return null;
  const score = Math.round(Math.max(0, Math.min(100, (rawScore + 1) * 50)));
  return { label: score >= 60 ? "偏多" : score <= 40 ? "偏空" : "中性", score };
}

export default function MarketOverviewCards({ authenticated, marketIndex, recommendation, onViewRecommendation }: MarketOverviewCardsProps) {
  const temperature = temperatureFromRecommendation(recommendation);
  const indexChange = marketIndex ? `${marketIndex.change_percent >= 0 ? "+" : ""}${marketIndex.change_percent.toFixed(2)}%` : null;
  const indexChangeAmount = marketIndex ? `${marketIndex.change >= 0 ? "+" : ""}${marketIndex.change.toFixed(2)}` : null;
  return <>
    <div className="stat-card"><div className="card-label">今日大盘 <span className="index-tag">上证</span></div>{marketIndex ? <><div className="market-stat-row"><div><div className="stat-value small">{marketIndex.price.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><div className={`stat-meta ${marketIndex.change_percent >= 0 ? "positive" : "negative"}`}>{indexChange} <span>{indexChangeAmount}</span></div></div><MiniSparkline trend={marketIndex.change_percent >= 0 ? "up" : "down"}/></div><div className="stat-footer"><span>来源 <strong>{marketIndex.source}</strong></span><span>{new Date(marketIndex.as_of).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span><span>{marketIndex.data_status === "demo" ? "非实时" : "已接入"}</span></div></> : authenticated ? <><div className="stat-value small">暂无</div><div className="stat-meta"><span>等待市场快照同步</span></div><div className="stat-footer"><span>不会用静态数字替代真实行情</span></div></> : <><div className="market-stat-row"><div><div className="stat-value small">{DEMO_INDEX.price}</div><div className="stat-meta positive">{DEMO_INDEX.change} <span>+21.10</span></div></div><MiniSparkline/></div><div className="stat-footer"><span>成交额 <strong>{DEMO_INDEX.amount}</strong></span><span>上涨 <strong className="red">{DEMO_INDEX.up}</strong></span><span>下跌 <strong className="green">{DEMO_INDEX.down}</strong></span></div></>}</div>
    <div className="stat-card ai-card"><div className="card-label"><span className="ai-icon"><Sparkles size={13}/></span>AI 市场温度 <span className="info-dot">i</span></div>{temperature ? <><div className="temperature-row"><div className="temperature">{temperature.label}</div><div className="temperature-score">{temperature.score}<span>/100</span></div></div><div className="meter"><div style={{ width: `${temperature.score}%` }}/></div><p>评分来自当前建议证据快照，仅作市场环境参考。</p></> : authenticated ? <><div className="temperature-row"><div className="temperature muted-temperature">暂无</div><div className="temperature-score">—<span>/100</span></div></div><div className="meter"><div style={{ width: "0%" }}/></div><p>等待可核验建议，不展示静态温度结论。</p></> : <><div className="temperature-row"><div className="temperature">偏多</div><div className="temperature-score">72<span>/100</span></div></div><div className="meter"><div style={{ width: "72%" }}/></div><p>演示数据 · 非实时，仅用于界面预览。</p></>}<button onClick={onViewRecommendation}>查看研判依据 <span>→</span></button></div>
  </>;
}
