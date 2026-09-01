import { useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { getRecommendation, getRecommendations, type Recommendation, type RecommendationHistoryItem } from "./api";
import "./multi-horizon.css";

type MultiHorizonPanelProps = { token: string | null; symbol: string; name: string };
const HORIZONS = [
  { value: "1-2d", label: "短期 · 1–2日" },
  { value: "1-5d", label: "波段 · 1–5日" },
  { value: "medium", label: "中期 · 1–3月" },
] as const;
type HorizonValue = (typeof HORIZONS)[number]["value"];
type HorizonItems = Record<HorizonValue, Recommendation | null>;

function emptyItems(): HorizonItems {
  return { "1-2d": null, "1-5d": null, medium: null };
}

function latestItems(history: RecommendationHistoryItem[], symbol: string): HorizonItems {
  const result = emptyItems();
  history.filter((item) => item.symbol === symbol).forEach((item) => {
    if (item.horizon in result && !result[item.horizon as HorizonValue]) result[item.horizon as HorizonValue] = item;
  });
  return result;
}

export default function MultiHorizonPanel({ token, symbol, name }: MultiHorizonPanelProps) {
  const [items, setItems] = useState<HorizonItems>(emptyItems);
  const [status, setStatus] = useState(token ? "正在读取已保存周期…" : "登录后查看三周期建议");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setItems(emptyItems());
      setStatus("登录后查看三周期建议");
      return;
    }
    let active = true;
    setStatus("正在读取已保存周期…");
    getRecommendations(token, 100).then((history) => {
      if (!active) return;
      setItems(latestItems(history, symbol));
      setStatus("已加载保存快照");
    }).catch(() => {
      if (active) setStatus("周期历史同步失败 · 可重试");
    });
    return () => { active = false; };
  }, [token, symbol]);

  const refresh = async () => {
    if (!token || busy) return;
    setBusy(true);
    setStatus("正在刷新三周期建议…");
    const results = await Promise.all(HORIZONS.map(async ({ value }) => {
      try {
        return [value, await getRecommendation(token, symbol, name, value)] as const;
      } catch {
        return [value, null] as const;
      }
    }));
    const next = emptyItems();
    results.forEach(([value, recommendation]) => { next[value] = recommendation; });
    setItems(next);
    setStatus(results.every(([, recommendation]) => recommendation) ? "三周期已刷新并留档" : "部分周期暂不可用 · 仅展示已返回结果");
    setBusy(false);
  };

  const populated = Object.values(items).filter((item): item is Recommendation => item !== null);
  const hasConflict = populated.some((item) => item.action === "买入观察") && populated.some((item) => item.action === "减仓观察");
  return <section className="multi-horizon-panel panel"><div className="panel-header compact"><div><div className="section-kicker"><Sparkles size={14}/>多周期研判</div><h2>同一标的，三种时间尺度</h2><p>{token ? "每个周期独立留档，依据来自对应生成时点" : "登录后查看短期、波段与中期建议"}</p></div><button className="horizon-refresh" type="button" onClick={() => void refresh()} disabled={!token || busy}><RefreshCw size={13} className={busy ? "spinning" : ""}/>刷新三周期</button></div><div className="horizon-status">{status}</div>{hasConflict && <div className="horizon-conflict" role="status">不同周期结论存在冲突，请分别复核各周期证据，不要合并为单一交易信号。</div>}<div className="horizon-grid">{HORIZONS.map(({ value, label }) => { const item = items[value]; const positive = item?.action === "买入观察"; return <article className="horizon-card" key={value}><span>{label}</span><strong className={item ? positive ? "horizon-positive" : "horizon-neutral" : ""}>{item?.action ?? "暂无已保存建议"}</strong><small>{item ? "信心度 " + (item.confidence * 100).toFixed(0) + "% · " + (item.delivery_mode === "cached" ? "缓存快照" : "已生成") : "在建议槽位生成后可查看"}</small>{item && <p>{item.rationale}</p>}</article>; })}</div></section>;
}
