import { Eye } from "lucide-react";
import type { PortfolioSummary } from "./api";

type PortfolioValueCardProps = {
  summary: PortfolioSummary | null;
  authenticated: boolean;
};

const DEMO_SUMMARY = {
  marketValue: "¥ 286,480.00",
  pnl: "+¥ 4,286.20",
};

function formatCurrency(value: number) {
  return `¥ ${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

export default function PortfolioValueCard({ summary, authenticated }: PortfolioValueCardProps) {
  return <div className="stat-card stat-card-dark">
    <div className="card-label">我的组合市值 <Eye size={15} /></div>
    {summary ? <>
      <div className="stat-value">{formatCurrency(summary.market_value)}</div>
      <div className={`stat-meta ${summary.unrealized_pnl < 0 ? "negative" : "positive"}`}>
        {summary.unrealized_pnl >= 0 ? "+" : "-"}{formatCurrency(Math.abs(summary.unrealized_pnl))}
        <span>浮盈亏</span>
      </div>
      <div className="portfolio-snapshot">
        估值于 {new Date(summary.as_of).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} · {summary.data_status} · {summary.source}
      </div>
    </> : authenticated ? <div className="portfolio-empty">
      <strong>暂无可核验组合估值</strong>
      <span>等待账户估值接口返回，不展示静态资产数字</span>
    </div> : <>
      <div className="stat-value">{DEMO_SUMMARY.marketValue}</div>
      <div className="stat-meta positive">{DEMO_SUMMARY.pnl} <span>演示数据 · 非账户余额</span></div>
      <div className="area-chart">
        <div className="chart-labels"><span>09:30</span><span>10:00</span><span>10:30</span><span>11:30</span></div>
        <svg viewBox="0 0 420 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#c99c69" stopOpacity=".32"/><stop offset="1" stopColor="#c99c69" stopOpacity="0"/></linearGradient></defs><path d="M0 78 C32 74 40 62 66 70 S104 45 135 59 S170 52 198 63 S232 30 260 42 S300 45 320 30 S357 22 380 28 S402 8 420 12 V100 H0 Z" fill="url(#area)"/><path d="M0 78 C32 74 40 62 66 70 S104 45 135 59 S170 52 198 63 S232 30 260 42 S300 45 320 30 S357 22 380 28 S402 8 420 12" fill="none" stroke="#d8ad79" strokeWidth="2"/></svg>
      </div>
    </>}
  </div>;
}
