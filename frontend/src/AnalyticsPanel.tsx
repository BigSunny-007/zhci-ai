import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { getAnalyticsOverview, type AnalyticsOverview } from "./api";

type AnalyticsPanelProps = { token: string | null };

function percent(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}

export default function AnalyticsPanel({ token }: AnalyticsPanelProps) {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) {
      setOverview(null);
      return;
    }
    let active = true;
    getAnalyticsOverview(token).then((next) => {
      if (active) {
        setOverview(next);
        setError(false);
      }
    }).catch(() => {
      if (active) setError(true);
    });
    return () => { active = false; };
  }, [token]);

  const dataStatus = overview?.data_status ?? "演示数据：登录后同步你的绩效接口";
  return <section className="analytics-data-panel panel"><div className="panel-header compact"><div><div className="section-kicker"><BarChart3 size={14}/>数据化复盘</div><h2>{overview?.period ?? "组合收益与风险指标"}</h2><p>{dataStatus}</p></div></div>{error && <p className="analytics-empty">绩效同步失败 · 保留现有数据</p>}{!overview && !error && <p className="analytics-empty">{token ? "正在同步绩效指标…" : "登录后查看账户绩效；演示数字不代表真实收益"}</p>}{overview && <><div className="analytics-data-kpis"><div><span>组合收益</span><strong className={overview.portfolio_return >= 0 ? "positive-text" : "negative-text"}>{percent(overview.portfolio_return)}</strong></div><div><span>跑赢基准</span><strong className={overview.excess_return >= 0 ? "positive-text" : "negative-text"}>{percent(overview.excess_return)}</strong></div><div><span>最大回撤</span><strong className="negative-text">{percent(overview.max_drawdown)}</strong></div><div><span>盈亏比</span><strong>{overview.profit_loss_ratio.toFixed(2)}</strong></div></div><div className="analytics-data-foot"><span>{overview.recommendation_accuracy > 0 ? `建议命中率 ${(overview.recommendation_accuracy * 100).toFixed(0)}%` : "暂无已评估建议"}</span><span>{overview.series.length} 个数据点 · {overview.data_status}</span></div></>}</section>;
}
