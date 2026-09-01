import { useEffect, useMemo, useState } from "react";
import {
  Activity, Bell, BookOpen, ChevronDown, CircleHelp, Command, LayoutDashboard,
  LineChart, Menu, Newspaper, Plus, Search, Settings2, ShieldCheck, Sparkles,
  TrendingUp, WalletCards, X,
} from "lucide-react";
import AuthView from "./AuthView";
import HoldingsPanel from "./HoldingsPanel";
import NewsPanel from "./NewsPanel";
import RiskProfilePanel from "./RiskProfilePanel";
import EvidenceDrawer from "./EvidenceDrawer";
import RecommendationTimeline from "./RecommendationTimeline";
import MultiHorizonPanel from "./MultiHorizonPanel";
import AnalyticsPanel from "./AnalyticsPanel";
import AdminPanel from "./AdminPanel";
import PolicyPanel from "./PolicyPanel";
import AuditPanel from "./AuditPanel";
import SchedulerPanel from "./SchedulerPanel";
import AlertsPanel from "./AlertsPanel";
import DataProvidersPanel from "./DataProvidersPanel";
import DataExportPanel from "./DataExportPanel";
import SecurityPanel from "./SecurityPanel";
import HistoryPanel from "./HistoryPanel";
import MarketIndexPanel from "./MarketIndexPanel";
import MarketOverviewCards from "./MarketOverviewCards";
import PortfolioValueCard from "./PortfolioValueCard";
import PortfolioRiskPanel from "./PortfolioRiskPanel";
import "./freshness.css";
import "./evidence.css";
import "./timeline.css";
import "./analytics-data.css";
import "./admin.css";
import "./policy.css";
import "./audit.css";
import "./scheduler.css";
import "./alerts.css";
import "./providers.css";
import "./data-export.css";
import "./security.css";
import { addWatchlist, ApiError, clearSession, getMarketIndex, getMarketSession, getMe, getPortfolioSummary, getQuote, getRecommendation, getWatchlist, loadSession, logout, refreshSession, saveSession, TokenSession, UserProfile, MarketQuote, Recommendation, MarketSession, MarketIndexSnapshot, PortfolioSummary } from "./api";

type WatchItem = { symbol: string; name: string; price: string; change: string; percent: string; inflow: string; status: "up" | "down" };

const baseWatchlist: WatchItem[] = [
  { symbol: "600519.SH", name: "贵州茅台", price: "1,682.00", change: "+18.00", percent: "+1.08%", inflow: "+2.64亿", status: "up" },
  { symbol: "300750.SZ", name: "宁德时代", price: "201.88", change: "+3.82", percent: "+1.93%", inflow: "+1.18亿", status: "up" },
  { symbol: "601318.SH", name: "中国平安", price: "47.31", change: "-0.42", percent: "-0.88%", inflow: "-4,806万", status: "down" },
  { symbol: "000858.SZ", name: "五粮液", price: "128.60", change: "+0.86", percent: "+0.67%", inflow: "+3,180万", status: "up" },
];

const points = [38, 44, 41, 50, 46, 56, 52, 61, 58, 66, 62, 74, 68, 76, 73, 86, 82, 91, 87, 100, 94, 109, 104, 118, 112, 125, 121, 132, 128, 140, 136, 150, 146, 159, 153, 165];
const REQUIRE_AUTH = (import.meta.env.VITE_REQUIRE_AUTH as string | undefined) === "true";

function MiniSparkline({ trend = "up" }: { trend?: "up" | "down" }) {
  const values = trend === "up" ? points : points.map((point, i) => 170 - point + (i % 3) * 3);
  const path = values.map((point, index) => `${index ? "L" : "M"}${(index / (values.length - 1)) * 100},${100 - point / 2}`).join(" ");
  return <svg className="sparkline" viewBox="0 0 100 100" preserveAspectRatio="none"><path d={path} fill="none" stroke={trend === "up" ? "#d35f58" : "#2c9b80"} strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg>;
}

function App() {
  const [session, setSession] = useState<TokenSession | null>(() => loadSession());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [authVisible, setAuthVisible] = useState(REQUIRE_AUTH && !session);
  const [liveQuote, setLiveQuote] = useState<MarketQuote | null>(null);
  const [liveRecommendation, setLiveRecommendation] = useState<Recommendation | null>(null);
  const [marketSession, setMarketSession] = useState<MarketSession | null>(null);
  const [marketIndex, setMarketIndex] = useState<MarketIndexSnapshot | null>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [syncState, setSyncState] = useState("演示数据");
  const [activeNav, setActiveNav] = useState("总览");
  const [watchlist, setWatchlist] = useState(baseWatchlist);
  const [selected, setSelected] = useState(baseWatchlist[0]);
  const [searchValue, setSearchValue] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [recommendationUnavailable, setRecommendationUnavailable] = useState(false);
  const [recommendationBusy, setRecommendationBusy] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const filtered = useMemo(() => watchlist.filter((item) => `${item.symbol}${item.name}`.includes(searchValue)), [watchlist, searchValue]);

  useEffect(() => {
    let active = true;
    getMarketSession().then((next) => {
      if (active) setMarketSession(next);
    }).catch(() => {
      if (active) setMarketSession(null);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!session) {
      setMarketIndex(null);
      return;
    }
    let active = true;
    getMarketIndex(session.accessToken).then((next) => {
      if (active) setMarketIndex(next);
    }).catch(() => {
      if (active) setMarketIndex(null);
    });
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    getMe(session.accessToken).then(setProfile).catch((error) => {
      if (error instanceof ApiError && error.status === 401) {
        refreshSession(session.refreshToken).then((nextSession) => {
          saveSession(nextSession);
          setSession(nextSession);
        }).catch(() => {
          clearSession();
          setSession(null);
          setProfile(null);
          if (REQUIRE_AUTH) setAuthVisible(true);
        });
        return;
      }
      clearSession();
      setSession(null);
      setProfile(null);
      if (REQUIRE_AUTH) setAuthVisible(true);
    });
  }, [session]);

  useEffect(() => {
    if (!session) {
      setPortfolioSummary(null);
      return;
    }
    let active = true;
    getPortfolioSummary(session.accessToken).then((next) => {
      if (active) setPortfolioSummary(next);
    }).catch(() => {
      if (active) setPortfolioSummary(null);
    });
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    if (!session) {
      setSyncState("演示数据");
      return;
    }
    let active = true;
    setSyncState("正在同步行情与 AI 依据…");
    Promise.all([
      getQuote(session.accessToken, selected.symbol, selected.name),
      getRecommendation(session.accessToken, selected.symbol, selected.name),
    ]).then(([quote, recommendation]) => {
      if (!active) return;
      setLiveQuote(quote);
      setLiveRecommendation(recommendation);
      setRecommendationUnavailable(false);
      setSyncState(`已同步 · ${quote.source} · ${new Date(quote.as_of).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`);
      const sign = quote.change_percent >= 0 ? "+" : "";
      const updated = { ...selected, name: quote.name, price: quote.price.toFixed(2), change: `${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)}`, percent: `${sign}${quote.change_percent.toFixed(2)}%`, inflow: `${quote.net_inflow >= 0 ? "+" : ""}${(quote.net_inflow / 100000000).toFixed(2)}亿`, status: quote.change_percent >= 0 ? "up" as const : "down" as const };
      setSelected(updated);
      setWatchlist((current) => current.map((item) => item.symbol === updated.symbol ? updated : item));
    }).catch(() => {
      if (active) {
        setSyncState("同步失败 · 保留上次数据");
        setRecommendationUnavailable(true);
      }
    });
    return () => { active = false; };
  }, [session, selected.symbol]);

  useEffect(() => {
    if (!session) return;
    getWatchlist(session.accessToken).then((items) => {
      if (!items.length) return;
      const mapped = items.map((item) => {
        const cached = baseWatchlist.find((candidate) => candidate.symbol === item.symbol);
        return cached ? { ...cached, name: item.name } : { symbol: item.symbol, name: item.name, price: "—", change: "—", percent: "—", inflow: "待同步", status: "up" as const };
      });
      setWatchlist(mapped);
      setSelected((current) => mapped.find((item) => item.symbol === current.symbol) ?? mapped[0]);
    }).catch(() => setSyncState("自选同步失败 · 保留本地列表"));
  }, [session]);

  const handleAuthenticated = (nextSession: TokenSession) => {
    setSession(nextSession);
    setDemoMode(false);
    setAuthVisible(false);
  };

  const handleLogout = () => {
    const activeSession = session;
    clearSession();
    setSession(null);
    setProfile(null);
    if (REQUIRE_AUTH) setAuthVisible(true);
    if (activeSession) void logout(activeSession.accessToken).catch(() => undefined);
  };

  const generateRecommendation = async () => {
    if (!session) {
      setNotice("登录后才能生成真实研判，演示工作区不会请求接口");
      return;
    }
    setRecommendationBusy(true);
    try {
      const next = await getRecommendation(session.accessToken, selected.symbol, selected.name);
      setLiveRecommendation(next);
      setRecommendationUnavailable(false);
      setNotice(next.delivery_mode === "cached" ? "当前返回最近一条已保存研判" : "已生成最新研判并保存证据");
    } catch (error) {
      setRecommendationUnavailable(true);
      setNotice(error instanceof ApiError ? error.message : "研判生成失败，请稍后重试");
    } finally {
      setRecommendationBusy(false);
    }
  };

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => {
      getRecommendation(session.accessToken, selected.symbol, selected.name).then((next) => {
        setLiveRecommendation(next);
        setRecommendationUnavailable(false);
        setSyncState(next.delivery_mode === "cached" ? "已同步 · 使用最近保存研判" : "已同步 · 生成最新研判");
      }).catch(() => setRecommendationUnavailable(true));
    }, 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [session, selected.symbol, selected.name]);

  const sessionLabel = marketSession?.session === "morning" || marketSession?.session === "afternoon" ? "沪深市场交易中" : marketSession?.is_trading_day ? "沪深市场休市" : "非交易日";
  const nextSlotLabel = marketSession?.next_recommendation_at ? new Date(marketSession.next_recommendation_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "下个交易日";
  const asOfLabel = marketSession?.as_of ? new Date(marketSession.as_of).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }) : "2026年09月01日";
  const quoteFreshness = liveRecommendation?.evidence?.quote_freshness === "stale" ? "stale" : liveRecommendation ? "fresh" : "demo";
  const fundFlowUnavailable = liveQuote?.fund_flow_status === "unavailable" || liveRecommendation?.evidence?.fund_flow_status === "unavailable";
  const quoteAge = Number(liveRecommendation?.evidence?.quote_age_seconds);
  const freshnessLabel = quoteFreshness === "stale"
    ? `行情快照已延迟 ${Number.isFinite(quoteAge) ? Math.max(0, Math.round(quoteAge / 60)) : "较久"} 分钟`
    : quoteFreshness === "fresh"
      ? `行情快照正常 · ${Number.isFinite(quoteAge) ? Math.max(0, Math.round(quoteAge / 60)) : 0} 分钟前`
      : "演示行情 · 非实时";
  if (REQUIRE_AUTH && !session && !demoMode) {
    return <AuthView onAuthenticated={handleAuthenticated} onDemo={() => setDemoMode(true)} />;
  }

  const addWatch = async () => {
    const symbol = searchValue.trim().toUpperCase();
    if (!symbol) return;
    const exists = watchlist.find((item) => item.symbol === symbol);
    if (exists) { setSelected(exists); setNotice("该股票已经在自选列表中"); return; }
    let item: WatchItem = { symbol, name: "新加入自选", price: "—", change: "—", percent: "—", inflow: "待同步", status: "up" };
    if (session) {
      try {
        const saved = await addWatchlist(session.accessToken, symbol, "新加入自选");
        item = { ...item, name: saved.name };
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "自选保存失败");
        return;
      }
    }
    setWatchlist((current) => [item, ...current]); setSelected(item); setSearchValue(""); setNotice("已加入自选，等待行情同步");
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Activity size={17} /></div><div><strong>智策 AI</strong><span>ZHICE INTELLIGENCE</span></div></div>
      <div className="workspace-label">个人工作区 <ChevronDown size={13} /></div>
      <nav className="main-nav">
        {[{label:"总览", icon:LayoutDashboard},{label:"自选与持仓", icon:WalletCards},{label:"市场雷达", icon:LineChart},{label:"新闻情报", icon:Newspaper},{label:"AI 研判", icon:Sparkles},{label:"绩效复盘", icon:TrendingUp}].map(({label, icon:Icon}) => <button key={label} className={activeNav === label ? "nav-item active" : "nav-item"} onClick={() => setActiveNav(label)}><Icon size={18} />{label}{label === "AI 研判" && <span className="nav-badge">3</span>}</button>)}
      </nav>
      <div className="sidebar-bottom"><button className="nav-item"><BookOpen size={18}/>投研笔记</button><button className="nav-item"><Settings2 size={18}/>设置</button><div className="user-card"><div className="avatar">{(profile?.display_name ?? "林").slice(0, 1)}</div><div><strong>{profile?.display_name ?? "林先生"}</strong><span>{session ? "已连接账户" : "演示工作区"}</span></div>{session ? <button className="session-action" onClick={handleLogout}>退出</button> : <button className="session-action" onClick={() => setAuthVisible(true)}>登录</button>}</div></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="breadcrumb"><Menu className="mobile-menu" size={19}/><span>工作台</span><span className="slash">/</span><strong>{activeNav}</strong></div><div className="top-actions"><span className="market-status"><i className={marketSession?.session === "morning" || marketSession?.session === "afternoon" ? "" : "muted"}/>{sessionLabel}</span><button className="icon-button" aria-label="帮助"><CircleHelp size={18}/></button><button className="icon-button" aria-label="通知"><Bell size={18}/><i className="notification-dot"/></button>{!session && <button className="login-link" onClick={() => setAuthVisible(true)}>登录同步数据</button>}<div className="date-chip">{asOfLabel} <ChevronDown size={14}/></div></div></header>
      {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice(null)}><X size={15}/></button></div>}
      <div className={session ? "sync-strip connected" : "sync-strip"}><span className="sync-dot"/>{syncState}{liveQuote && <span> · {liveQuote.symbol} {liveQuote.change_percent >= 0 ? "上涨" : "下跌"} {Math.abs(liveQuote.change_percent).toFixed(2)}%</span>}</div>
      <div className={`freshness-banner ${quoteFreshness}`} role="status"><ShieldCheck size={13}/><span>{freshnessLabel}</span>{quoteFreshness === "stale" && <em>暂停新增仓位</em>}</div>
      <button className="evidence-trigger" onClick={() => setEvidenceOpen(true)}><ShieldCheck size={13}/>查看本次建议数据依据</button>
      <div className="page-wrap">
        <section className="hero-row"><div><div className="eyebrow"><span className="live-dot"/>{marketSession?.can_generate_recommendation ? "建议槽位 · 当前可更新" : `市场状态 · 下次建议 ${nextSlotLabel}`}</div><h1>早上好，林先生<span className="wave">✦</span></h1><p className="hero-subtitle">把复杂的市场信息，变成每一次决策前都看得懂的依据。</p></div><div className="hero-actions"><button className="secondary-button"><Command size={16}/>快捷键 <kbd>⌘ K</kbd></button><button className="primary-button" onClick={() => void generateRecommendation()} disabled={recommendationBusy}>{recommendationBusy ? "生成中…" : <><Sparkles size={16}/>生成本次研判</>}</button></div></section>
        <section className="overview-grid"><PortfolioValueCard summary={portfolioSummary} authenticated={Boolean(session)} /><MarketOverviewCards authenticated={Boolean(session)} marketIndex={marketIndex} recommendation={liveRecommendation} onViewRecommendation={() => setActiveNav("AI 研判")}/></section>
      <section className="content-grid"><div className="panel watch-panel"><div className="panel-header"><div><h2>我的自选 <span className="count">{watchlist.length}</span></h2><p>优先关注你已持有的标的</p></div><div className="panel-tools"><div className="search-box"><Search size={15}/><input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="搜索代码 / 名称" onKeyDown={(event) => { if (event.key === "Enter") addWatch(); }}/></div><button className="add-button" onClick={addWatch}><Plus size={16}/></button></div></div><div className="watch-table"><div className="table-head"><span>股票</span><span>最新价</span><span>涨跌幅</span><span>资金流向</span><span>走势</span></div>{filtered.map((item) => <button className={selected.symbol === item.symbol ? "watch-row selected" : "watch-row"} key={item.symbol} onClick={() => setSelected(item)}><span className="stock-name"><span className={item.status === "up" ? "stock-badge red-bg" : "stock-badge green-bg"}>{item.name.slice(0,1)}</span><span><strong>{item.name}</strong><small>{item.symbol}</small></span></span><strong>{item.price}</strong><span className={item.status === "up" ? "red" : "green"}>{item.percent}<small>{item.change}</small></span><span className={item.status === "up" ? "red" : "green"}>{item.inflow}</span><span className="row-spark"><MiniSparkline trend={item.status}/></span></button>)}</div><button className="view-all" onClick={() => setActiveNav("自选与持仓")}>查看全部自选 <span>→</span></button></div><div className="right-column"><div className="panel recommendation-panel"><div className="panel-header compact"><div><div className="section-kicker"><Sparkles size={14}/>AI 研判</div><h2>{selected.name} <span className="ticker">{selected.symbol}</span></h2></div><button className="more-button">···</button></div>{recommendationUnavailable && session && <div className="stale-notice">当前没有可用的真实建议 · 请等待下一个建议槽位或检查数据源</div>}{fundFlowUnavailable && <div className="stale-notice">当前数据源未提供资金流，AI 不据此给出方向判断</div>}<div className="recommendation-badge"><span className="pulse"/>{liveRecommendation?.action ?? (session ? "暂无建议" : "建议持有")} <strong>·</strong> 信心度 {liveRecommendation ? `${(liveRecommendation.confidence * 100).toFixed(0)}%` : session ? "—" : "78%"}</div>{liveRecommendation?.is_stale && <div className="stale-notice">缓存建议 · 非当前槽位生成，仅供复核</div>}<p className="recommendation-copy">{liveRecommendation?.rationale ?? (session ? "当前没有可展示的建议依据；系统不会用演示文案替代真实数据。" : "短期资金仍在流入，但上方套牢盘压力明显。建议维持当前仓位，等待量能确认后再做加仓决策。")}</p><div className="reason-list">{liveRecommendation || !session ? <><div><span className="reason-icon flow"><TrendingUp size={14}/></span><span><strong>资金流向</strong><small>{fundFlowUnavailable ? "当前 Provider 未提供，暂不纳入判断" : `近 1 小时主力净流入 ${liveQuote ? `${liveQuote.net_inflow >= 0 ? "+" : ""}${(liveQuote.net_inflow / 100000000).toFixed(2)} 亿` : "+2.64 亿"}`}</small></span><em>{fundFlowUnavailable ? "不可用" : "有利"}</em></div><div><span className="reason-icon market"><LineChart size={14}/></span><span><strong>大盘环境</strong><small>上证指数 <b className="red">+0.63%</b>，市场温度偏多</small></span><em>中性偏多</em></div><div><span className="reason-icon news"><Newspaper size={14}/></span><span><strong>新闻情报</strong><small>2 条相关资讯，权威度加权情绪 <b>+0.18</b></small></span><em>中性</em></div></> : <div className="reasons-unavailable">暂无可核验依据</div>}</div><div className="recommendation-footer"><span>{liveRecommendation ? `更新于 ${new Date(liveRecommendation.generated_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} · ${liveRecommendation.model_version}` : session ? "等待真实建议数据" : "演示工作区 · 非实时"}</span><button onClick={() => setNotice(liveRecommendation ? "已打开完整证据链（演示）" : "当前没有可查看的建议证据")}>查看完整依据 <span>→</span></button></div></div><AnalyticsPanel token={session?.accessToken ?? null} compact onOpen={() => setActiveNav("绩效复盘")} /><NewsPanel token={session?.accessToken ?? null} symbol={selected.symbol}/></div></section>
        <HoldingsPanel token={session?.accessToken ?? null} />
        <PortfolioRiskPanel token={session?.accessToken ?? null} />
        <RiskProfilePanel token={session?.accessToken ?? null} profile={profile} onProfileUpdated={setProfile} />
        <RecommendationTimeline token={session?.accessToken ?? null} />
        <MultiHorizonPanel token={session?.accessToken ?? null} symbol={selected.symbol} name={selected.name} />
        <AnalyticsPanel token={session?.accessToken ?? null} />
        <AdminPanel token={session?.accessToken ?? null} isAdmin={profile?.is_admin === true} />
        <PolicyPanel token={session?.accessToken ?? null} isAdmin={profile?.is_admin === true} />
        <AuditPanel token={session?.accessToken ?? null} isAdmin={profile?.is_admin === true} />
        <SchedulerPanel token={session?.accessToken ?? null} isAdmin={profile?.is_admin === true} />
        <AlertsPanel token={session?.accessToken ?? null} symbol={selected.symbol} />
        <DataProvidersPanel token={session?.accessToken ?? null} isAdmin={profile?.is_admin === true} />
        <DataExportPanel token={session?.accessToken ?? null} />
        <SecurityPanel token={session?.accessToken ?? null} onSessionInvalidated={handleLogout} />
        <HistoryPanel token={session?.accessToken ?? null} symbol={selected.symbol} />
        <MarketIndexPanel token={session?.accessToken ?? null} />
        {evidenceOpen && <EvidenceDrawer recommendation={liveRecommendation} quote={liveQuote} onClose={() => setEvidenceOpen(false)} />}
        <section className="disclaimer"><ShieldCheck size={16}/><span>智策 AI 仅提供数据整理与投研辅助，不构成任何投资建议。市场有风险，投资需谨慎。</span><a href="#risk">了解数据与模型边界</a></section>
      </div>
    </main>
    {authVisible && <div className="auth-overlay"><AuthView onAuthenticated={handleAuthenticated} onDemo={() => setAuthVisible(false)} /></div>}
  </div>;
}

export default App;
