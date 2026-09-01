import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { getAnalyticsOverview, getRecommendationEvaluation, type AnalyticsOverview, type RecommendationEvaluationOverview } from "./api";

type AnalyticsPanelProps = { token: string | null; compact?: boolean; onOpen?: () => void };
const HORIZON_LABELS: Record<string, string> = { "1-2d": "短期 · 1–2日", "1-5d": "波段 · 1–5日", medium: "中期 · 1–3月" };

function percent(value: number): string {
  return (value >= 0 ? "+" : "") + (value * 100).toFixed(2) + "%";
}

function evaluationPath(evaluation: RecommendationEvaluationOverview): string {
  if (evaluation.series.length < 2) return "";
  const values = evaluation.series.map((point) => point.cumulative_return);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;
  return values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 94 - ((value - min) / range) * 82;
    return (index ? "L" : "M") + x.toFixed(2) + "," + y.toFixed(2);
  }).join(" ");
}

function HorizonBreakdown({ evaluation }: { evaluation: RecommendationEvaluationOverview | null }) {
  if (!evaluation?.by_horizon?.length) return null;
  return <div className="horizon-breakdown"><div className="horizon-breakdown-title"><span>按周期复盘</span><small>仅统计已到期建议</small></div><div className="horizon-breakdown-grid">{evaluation.by_horizon.map((item) => <div className="horizon-breakdown-card" key={item.horizon}><strong>{HORIZON_LABELS[item.horizon] ?? item.horizon}</strong><span>{item.evaluated_count} 个样本</span><em>命中 {percent(item.recommendation_accuracy)}</em><small>回撤 {percent(item.max_drawdown)} · 盈亏比 {item.profit_loss_ratio.toFixed(2)}</small></div>)}</div></div>;
}

export default function AnalyticsPanel({ token, compact = false, onOpen }: AnalyticsPanelProps) {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [evaluation, setEvaluation] = useState<RecommendationEvaluationOverview | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) {
      setOverview(null);
      setEvaluation(null);
      return;
    }
    let active = true;
    const request = compact
      ? getAnalyticsOverview(token).then((next) => [next, null] as const)
      : Promise.all([getAnalyticsOverview(token), getRecommendationEvaluation(token)]);
    request.then(([next, evaluated]) => {
      if (active) { setOverview(next); setEvaluation(evaluated); setError(false); }
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [token]);

  const dataStatus = overview?.data_status ?? "演示数据：登录后同步你的绩效接口";
  const path = evaluation ? evaluationPath(evaluation) : "";
  if (compact) {
    return <section className="dashboard-analytics-card panel"><div className="panel-header compact"><div><div className="section-kicker"><BarChart3 size={14}/>绩效复盘</div><h2>{overview?.period ?? "组合绩效"}</h2><p>{overview ? dataStatus : token ? "正在同步真实绩效指标…" : "登录后查看真实绩效，不展示演示收益"}</p></div><button className="more-button" onClick={onOpen}>···</button></div>{error && <p className="dashboard-analytics-empty">绩效同步失败 · 保留中性状态</p>}{!overview && !error && <p className="dashboard-analytics-empty">{token ? "正在同步绩效指标…" : "暂无可核验绩效"}</p>}{overview && <><div className="dashboard-analytics-kpis"><div><span>组合收益</span><strong className={overview.portfolio_return >= 0 ? "positive-text" : "negative-text"}>{percent(overview.portfolio_return)}</strong></div><div><span>跑赢基准</span><strong className={overview.excess_return >= 0 ? "positive-text" : "negative-text"}>{percent(overview.excess_return)}</strong></div><div><span>最大回撤</span><strong className="negative-text">{percent(overview.max_drawdown)}</strong></div><div><span>盈亏比</span><strong>{overview.profit_loss_ratio.toFixed(2)}</strong></div></div><div className="dashboard-analytics-foot"><span>{overview.recommendation_accuracy > 0 ? `建议命中率 ${(overview.recommendation_accuracy * 100).toFixed(0)}%` : "暂无已评估建议"}</span><span>{overview.series.length} 个数据点</span></div></>}</section>;
  }
  return <section className="analytics-data-panel panel"><div className="panel-header compact"><div><div className="section-kicker"><BarChart3 size={14}/>数据化复盘</div><h2>{overview?.period ?? "组合收益与风险指标"}</h2><p>{dataStatus}</p></div></div>{error && <p className="analytics-empty">绩效同步失败 · 保留现有数据</p>}{!overview && !error && <p className="analytics-empty">{token ? "正在同步绩效指标…" : "登录后查看账户绩效；演示数字不代表真实收益"}</p>}{overview && <><div className="analytics-data-kpis"><div><span>组合收益</span><strong className={overview.portfolio_return >= 0 ? "positive-text" : "negative-text"}>{percent(overview.portfolio_return)}</strong></div><div><span>跑赢基准</span><strong className={overview.excess_return >= 0 ? "positive-text" : "negative-text"}>{percent(overview.excess_return)}</strong></div><div><span>最大回撤</span><strong className="negative-text">{percent(overview.max_drawdown)}</strong></div><div><span>盈亏比</span><strong>{overview.profit_loss_ratio.toFixed(2)}</strong></div></div><div className="evaluation-strip"><span>已评估建议 <strong>{evaluation?.evaluated_count ?? 0}</strong></span><span>实际命中率 <strong>{evaluation ? (evaluation.recommendation_accuracy * 100).toFixed(0) + "%" : "—"}</strong></span><span>评估状态 <strong>{evaluation?.data_status ?? "暂无"}</strong></span></div><HorizonBreakdown evaluation={evaluation}/>{path && <div className="evaluation-chart"><div><span>兑现累计收益</span><small>{evaluation?.series.length} 个评估点</small></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="建议兑现累计收益曲线"><path d={path} fill="none" stroke="#c95750" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg></div>}<div className="analytics-data-foot"><span>{overview.recommendation_accuracy > 0 ? "建议命中率 " + (overview.recommendation_accuracy * 100).toFixed(0) + "%" : "暂无已评估建议"}</span><span>{overview.series.length} 个数据点 · {overview.data_status}</span></div></>}</section>;
}
