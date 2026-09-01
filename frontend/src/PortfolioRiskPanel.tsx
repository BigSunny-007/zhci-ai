import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { getPortfolioRisk, type PortfolioRiskOverview } from "./api";
import "./portfolio-risk.css";

type PortfolioRiskPanelProps = { token: string | null };

const levelLabels: Record<PortfolioRiskOverview["concentration_level"], string> = {
  empty: "暂无暴露",
  balanced: "集中度可接受",
  watch: "接近观察线",
  high: "集中度偏高",
  unavailable: "暂不可判断",
};

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function PortfolioRiskPanel({ token }: PortfolioRiskPanelProps) {
  const [overview, setOverview] = useState<PortfolioRiskOverview | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) {
      setOverview(null);
      setError(false);
      return;
    }
    let active = true;
    getPortfolioRisk(token).then((next) => {
      if (active) {
        setOverview(next);
        setError(false);
      }
    }).catch(() => {
      if (active) setError(true);
    });
    return () => { active = false; };
  }, [token]);

  return <section className="portfolio-risk-panel panel">
    <div className="panel-header compact"><div><div className="section-kicker"><ShieldAlert size={14}/>组合风险预算</div><h2>持仓集中度与仓位</h2><p>{overview?.data_status ?? (token ? "正在同步组合风险…" : "登录后检查真实持仓风险")}</p></div></div>
    {error && <p className="portfolio-risk-empty">组合风险同步失败 · 请稍后重试</p>}
    {!overview && !error && <p className="portfolio-risk-empty">{token ? "正在读取已估值持仓…" : "未登录不展示演示风险结论"}</p>}
    {overview && <>
      <div className="portfolio-risk-kpis"><div><span>风险状态</span><strong className={`risk-level ${overview.concentration_level}`}>{levelLabels[overview.concentration_level]}</strong></div><div><span>最大单票占比</span><strong>{percent(overview.top_position_weight)}</strong></div><div><span>个人单票上限</span><strong>{percent(overview.single_position_limit)}</strong></div><div><span>集中度指数</span><strong>{overview.concentration_index.toFixed(2)}</strong></div></div>
      {overview.positions.length > 0 && <div className="portfolio-risk-list">{overview.positions.slice(0, 5).map((position) => <div className="portfolio-risk-row" key={position.symbol}><div className="portfolio-risk-name"><strong>{position.name}</strong><small>{position.symbol}</small></div><div className="portfolio-risk-bar"><span style={{ width: `${Math.min(100, position.weight * 100)}%` }}/></div><strong className="portfolio-risk-weight">{position.quote_status === "valued" ? percent(position.weight) : "未估值"}</strong></div>)}</div>}
      <div className="portfolio-risk-foot"><span>已估值 {overview.valued_positions}/{overview.total_positions} 个持仓</span><span>仅用于风险复核，不构成交易指令</span></div>
    </>}
  </section>;
}
