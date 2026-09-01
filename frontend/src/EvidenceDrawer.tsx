import { X, ShieldCheck } from "lucide-react";
import type { MarketQuote, Recommendation } from "./api";

type EvidenceDrawerProps = {
  recommendation: Recommendation | null;
  quote: MarketQuote | null;
  onClose: () => void;
};

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatInflow(value: unknown): string {
  const parsed = asNumber(value);
  if (parsed === null) return "暂无数据";
  const sign = parsed >= 0 ? "+" : "";
  return `${sign}${(parsed / 100000000).toFixed(2)} 亿`;
}

export default function EvidenceDrawer({ recommendation, quote, onClose }: EvidenceDrawerProps) {
  const evidence = recommendation?.evidence ?? {};
  const quoteEvidence = (evidence.quote ?? {}) as Record<string, unknown>;
  const weights = (evidence.weights ?? {}) as Record<string, unknown>;
  const freshness = evidence.quote_freshness === "stale" ? "已过期" : recommendation ? "正常" : "演示";
  const age = asNumber(evidence.quote_age_seconds);
  const limit = asNumber(evidence.position_limit);
  const currentPosition = asNumber(evidence.current_position);
  const newsItems = Array.isArray(evidence.news) ? evidence.news : [];

  return (
    <div className="evidence-overlay" role="presentation" onClick={onClose}>
      <aside className="evidence-drawer" role="dialog" aria-modal="true" aria-label="AI 建议完整依据" onClick={(event) => event.stopPropagation()}>
        <header className="evidence-header">
          <div><span className="section-kicker"><ShieldCheck size={14}/>证据链</span><h2>{recommendation?.symbol ?? quote?.symbol ?? "当前标的"} · 完整依据</h2><p>仅展示生成时保存的快照，不代表实时交易指令</p></div>
          <button className="evidence-close" aria-label="关闭证据依据" onClick={onClose}><X size={18}/></button>
        </header>
        <div className="evidence-body">
          <section className="evidence-summary"><span>当前结论</span><strong>{recommendation?.action ?? "演示工作区"}</strong><em>{recommendation ? `信心度 ${(recommendation.confidence * 100).toFixed(0)}%` : "未生成账户建议"}</em></section>
          <section className="evidence-section"><h3>行情与资金</h3><div className="evidence-grid"><div><span>最新价</span><strong>{asNumber(quoteEvidence.price ?? quote?.price)?.toFixed(2) ?? "暂无数据"}</strong></div><div><span>涨跌幅</span><strong>{asNumber(quoteEvidence.change_percent ?? quote?.change_percent)?.toFixed(2) ?? "暂无数据"}%</strong></div><div><span>净流入</span><strong>{formatInflow(quoteEvidence.net_inflow ?? quote?.net_inflow)}</strong></div><div><span>数据源</span><strong>{String(quoteEvidence.source ?? quote?.source ?? "演示")}</strong></div></div></section>
          <section className="evidence-section"><h3>评分权重</h3><div className="evidence-grid"><div><span>资金流</span><strong>{String(weights.fund_flow ?? "未提供")}</strong></div><div><span>价格动量</span><strong>{String(weights.momentum ?? "未提供")}</strong></div><div><span>新闻权威度</span><strong>{String(weights.news_authority_adjusted ?? "未提供")}</strong></div><div><span>策略版本</span><strong>{String(evidence.policy_version ?? recommendation?.model_version ?? "未提供")}</strong></div></div></section>
          <section className="evidence-section"><h3>风险约束</h3><div className="evidence-grid"><div><span>风险档位</span><strong>{String(evidence.risk_profile ?? "未提供")}</strong></div><div><span>当前仓位</span><strong>{currentPosition === null ? "暂无数据" : `${(currentPosition * 100).toFixed(1)}%`}</strong></div><div><span>仓位上限</span><strong>{limit === null ? "暂无数据" : `${(limit * 100).toFixed(0)}%`}</strong></div><div><span>超配状态</span><strong className={evidence.risk_breach ? "warning" : ""}>{evidence.risk_breach ? "已超限" : "未超限"}</strong></div></div></section>
          <section className="evidence-section"><h3>数据质量</h3><div className="evidence-quality"><span className={freshness === "已过期" ? "warning-dot" : "ok-dot"}/><strong>{freshness}</strong><span>{age === null ? "快照年龄未知" : `快照年龄 ${Math.round(age / 60)} 分钟`}</span><span>阈值 {asNumber(evidence.quote_max_age_seconds) ?? "—"} 秒</span></div></section>
          <section className="evidence-section"><h3>相关新闻 <small>{newsItems.length} 条</small></h3>{newsItems.slice(0, 5).map((item, index) => { const news = item as Record<string, unknown>; return <div className="evidence-news" key={String(news.id ?? index)}><strong>{String(news.title ?? "未命名资讯")}</strong><span>{String(news.source_name ?? "未知来源")} · 权威度 {String(news.authority_score ?? "—")}</span></div>; })}</section>
          <p className="evidence-limit">{String((evidence.limitations as string[] | undefined)?.join("；") ?? "证据仅用于投研辅助，请独立判断")}</p>
        </div>
      </aside>
    </div>
  );
}
