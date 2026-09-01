import { useEffect, useState } from "react";
import { ExternalLink, Newspaper } from "lucide-react";
import { getNews, NewsItem } from "./api";
import "./news.css";

type NewsPanelProps = { token: string | null; symbol: string };

const demoNews: NewsItem[] = [
  { id: 1, symbol: null, title: "政策预期推动大金融板块走强", summary: "演示资讯仅用于界面预览。", source_name: "演示数据源", source_url: "", published_at: new Date().toISOString(), authority_score: .2, sentiment_score: .1 },
  { id: 2, symbol: null, title: "新能源产业链早盘资金持续回流", summary: "接入正式来源后将显示原文摘要。", source_name: "演示数据源", source_url: "", published_at: new Date().toISOString(), authority_score: .2, sentiment_score: 0 },
];

export default function NewsPanel({ token, symbol }: NewsPanelProps) {
  const [items, setItems] = useState<NewsItem[]>(() => token ? [] : demoNews);
  const [status, setStatus] = useState(token ? "正在同步" : "演示数据");
  const [syncing, setSyncing] = useState(false);

  const refresh = () => {
    if (!token || syncing) return;
    setSyncing(true);
    setStatus("正在同步");
    getNews(token, symbol).then((nextItems) => {
      setItems(nextItems);
      setStatus(nextItems.length ? "权威来源优先" : "暂无相关新闻");
    }).catch(() => setStatus(items.length ? "同步失败 · 保留上次已同步资讯" : "同步失败 · 暂无可核验资讯")).finally(() => setSyncing(false));
  };

  useEffect(() => {
    if (!token) {
      setItems(demoNews);
      setStatus("演示数据");
      return;
    }
    let active = true;
    setItems([]);
    setStatus("正在同步");
    getNews(token, symbol).then((nextItems) => {
      if (!active) return;
      setItems(nextItems);
      setStatus(nextItems.length ? "权威来源优先" : "暂无相关新闻");
    }).catch(() => { if (active) setStatus("同步失败 · 暂无可核验资讯"); });
    return () => { active = false; };
  }, [token, symbol]);

  return <div className="panel news-panel"><div className="panel-header compact"><div><div className="section-kicker"><Newspaper size={14}/>市场情报</div><h2>{status}</h2><p>按权威度加权 · {symbol}</p></div><button className="more-button news-refresh" aria-label="刷新新闻" onClick={refresh} disabled={!token || syncing}>{syncing ? "…" : "↻"}</button></div>{token && items.length === 0 && <p className="news-empty">{status === "正在同步" ? "正在获取可核验新闻…" : status.includes("失败") ? "当前没有可核验资讯，请稍后重试" : "当前标的暂无相关新闻"}</p>}{items.slice(0, 3).map((item) => <div className="news-item" key={item.id}><span className="news-time">{new Date(item.published_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span><div className="news-content"><strong>{item.title}</strong><p>{item.source_name} · <span className={item.sentiment_score > 0 ? "red" : ""}>{item.sentiment_score > 0 ? "偏多" : item.sentiment_score < 0 ? "偏空" : "中性"}</span><span className="authority">权威度 {(item.authority_score * 100).toFixed(0)}%</span></p></div>{item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer" aria-label="打开新闻来源"><ExternalLink size={13}/></a>}</div>)}</div>;
}
