import { useEffect, useState } from "react";
import { Clock3, TrendingDown, TrendingUp } from "lucide-react";
import { getRecommendations, type RecommendationHistoryItem } from "./api";

type RecommendationTimelineProps = { token: string | null };

function formatDate(value: string): string {
  return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function RecommendationTimeline({ token }: RecommendationTimelineProps) {
  const [items, setItems] = useState<RecommendationHistoryItem[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) {
      setItems([]);
      return;
    }
    let active = true;
    getRecommendations(token).then((next) => {
      if (active) {
        setItems(next);
        setError(false);
      }
    }).catch(() => {
      if (active) setError(true);
    });
    return () => { active = false; };
  }, [token]);

  return <section className="timeline-panel panel"><div className="panel-header compact"><div><div className="section-kicker"><Clock3 size={14}/>建议时间线</div><h2>每次研判都可回看</h2><p>{token ? "按生成时间保存的个人建议快照" : "登录后查看你的建议历史"}</p></div></div>{error && <p className="timeline-empty">历史同步失败 · 保留本地页面</p>}{token && !error && items.length === 0 && <p className="timeline-empty">暂无已保存的建议</p>}{!token && <p className="timeline-empty">登录后可查看动作、依据版本和兑现结果</p>}{items.length > 0 && <div className="timeline-list">{items.map((item) => { const positive = item.action === "买入观察"; const realized = item.realized_return; return <article className="timeline-item" key={item.id}><span className={positive ? "timeline-icon positive" : "timeline-icon"}>{positive ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}</span><div className="timeline-main"><strong>{item.symbol} · {item.action}</strong><span>{formatDate(item.generated_at)} · {item.horizon} · {item.delivery_mode === "cached" ? "缓存" : "新生成"}</span></div><span className={realized === null || realized === undefined ? "timeline-result pending" : realized >= 0 ? "timeline-result positive-text" : "timeline-result negative-text"}>{realized === null || realized === undefined ? "待评估" : `${realized >= 0 ? "+" : ""}${(realized * 100).toFixed(2)}%`}</span></article>; })}</div>}</section>;
}
