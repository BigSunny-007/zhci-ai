import { useEffect, useMemo, useState } from "react";
import {
  Activity, Bell, BookOpen, ChevronDown, CircleHelp, Command, Eye, LayoutDashboard,
  LineChart, Menu, Newspaper, Plus, Search, Settings2, ShieldCheck, Sparkles,
  TrendingUp, WalletCards, X,
} from "lucide-react";
import AuthView from "./AuthView";
import HoldingsPanel from "./HoldingsPanel";
import NewsPanel from "./NewsPanel";
import RiskProfilePanel from "./RiskProfilePanel";
import EvidenceDrawer from "./EvidenceDrawer";
import RecommendationTimeline from "./RecommendationTimeline";
import AnalyticsPanel from "./AnalyticsPanel";
import "./freshness.css";
import "./evidence.css";
import "./timeline.css";
import "./analytics-data.css";
import { addWatchlist, ApiError, clearSession, getMarketSession, getMe, getQuote, getRecommendation, getWatchlist, loadSession, logout, refreshSession, saveSession, TokenSession, UserProfile, MarketQuote, Recommendation, MarketSession } from "./api";

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
  const [syncState, setSyncState] = useState("演示数据");
  const [activeNav, setActiveNav] = useState("总览");
  const [watchlist, setWatchlist] = useState(baseWatchlist);
  const [selected, setSelected] = useState(baseWatchlist[0]);
  const [searchValue, setSearchValue] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
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
      setSyncState(`已同步 · ${quote.source} · ${new Date(quote.as_of).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`);
      const sign = quote.change_percent >= 0 ? "+" : "";
      const updated = { ...selected, name: quote.name, price: quote.price.toFixed(2), change: `${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)}`, percent: `${sign}${quote.change_percent.toFixed(2)}%`, inflow: `${quote.net_inflow >= 0 ? "+" : ""}${(quote.net_inflow / 100000000).toFixed(2)}亿`, status: quote.change_percent >= 0 ? "up" as const : "down" as const };
      setSelected(updated);
      setWatchlist((current) => current.map((item) => item.symbol === updated.symbol ? updated : item));
    }).catch(() => {
      if (active) setSyncState("同步失败 · 保留上次数据");
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

  const sessionLabel = marketSession?.session === "morning" || marketSession?.session === "afternoon" ? "沪深市场交易中" : marketSession?.is_trading_day ? "沪深市场休市" : "非交易日";
  const nextSlotLabel = marketSession?.next_recommendation_at ? new Date(marketSession.next_recommendation_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "下个交易日";
  const asOfLabel = marketSession?.as_of ? new Date(marketSession.as_of).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }) : "2026年09月01日";
  const quoteFreshness = liveRecommendation?.evidence?.quote_freshness === "stale" ? "stale" : liveRecommendation ? "fresh" : "demo";
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
        <section className="hero-row"><div><div className="eyebrow"><span className="live-dot"/>{marketSession?.can_generate_recommendation ? "建议槽位 · 当前可更新" : `市场状态 · 下次建议 ${nextSlotLabel}`}</div><h1>早上好，林先生<span className="wave">✦</span></h1><p className="hero-subtitle">把复杂的市场信息，变成每一次决策前都看得懂的依据。</p></div><div className="hero-actions"><button className="secondary-button"><Command size={16}/>快捷键 <kbd>⌘ K</kbd></button><button className="primary-button" onClick={() => setNotice("正在生成最新 AI 研判…")}><Sparkles size={16}/>生成本次研判</button></div></section>
        <section className="overview-grid"><div className="stat-card stat-card-dark"><div className="card-label">我的组合总资产 <Eye size={15}/></div><div className="stat-value">¥ 286,480.00</div><div className="stat-meta positive">+¥ 4,286.20 <span>+1.52% 今日</span></div><div className="area-chart"><div className="chart-labels"><span>09:30</span><span>10:00</span><span>10:30</span><span>11:30</span></div><svg viewBox="0 0 420 100" preserveAspectRatio="none"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#c99c69" stopOpacity=".32"/><stop offset="1" stopColor="#c99c69" stopOpacity="0"/></linearGradient></defs><path d="M0 78 C32 74 40 62 66 70 S104 45 135 59 S170 52 198 63 S232 30 260 42 S300 45 320 30 S357 22 380 28 S402 8 420 12 V100 H0 Z" fill="url(#area)"/><path d="M0 78 C32 74 40 62 66 70 S104 45 135 59 S170 52 198 63 S232 30 260 42 S300 45 320 30 S357 22 380 28 S402 8 420 12" fill="none" stroke="#d8ad79" strokeWidth="2"/></svg></div></div><div className="stat-card"><div className="card-label">今日大盘 <span className="index-tag">上证</span></div><div className="market-stat-row"><div><div className="stat-value small">3,387.42</div><div className="stat-meta positive">+0.63% <span>+21.10</span></div></div><MiniSparkline/></div><div className="stat-footer"><span>成交额 <strong>4,128亿</strong></span><span>上涨 <strong className="red">2,846</strong></span><span>下跌 <strong className="green">1,702</strong></span></div></div><div className="stat-card ai-card"><div className="card-label"><span className="ai-icon"><Sparkles size={13}/></span>AI 市场温度 <span className="info-dot">i</span></div><div className="temperature-row"><div className="temperature">偏多</div><div className="temperature-score">72<span>/100</span></div></div><div className="meter"><div style={{width:"72%"}}/></div><p>资金与情绪共振，关注午后量能是否延续。</p><button onClick={() => setActiveNav("AI 研判")}>查看研判依据 <span>→</span></button></div></section>
        <section className="content-grid"><div className="panel watch-panel"><div className="panel-header"><div><h2>我的自选 <span className="count">{watchlist.length}</span></h2><p>优先关注你已持有的标的</p></div><div className="panel-tools"><div className="search-box"><Search size={15}/><input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="搜索代码 / 名称" onKeyDown={(event) => { if (event.key === "Enter") addWatch(); }}/></div><button className="add-button" onClick={addWatch}><Plus size={16}/></button></div></div><div className="watch-table"><div className="table-head"><span>股票</span><span>最新价</span><span>涨跌幅</span><span>资金流向</span><span>走势</span></div>{filtered.map((item) => <button className={selected.symbol === item.symbol ? "watch-row selected" : "watch-row"} key={item.symbol} onClick={() => setSelected(item)}><span className="stock-name"><span className={item.status === "up" ? "stock-badge red-bg" : "stock-badge green-bg"}>{item.name.slice(0,1)}</span><span><strong>{item.name}</strong><small>{item.symbol}</small></span></span><strong>{item.price}</strong><span className={item.status === "up" ? "red" : "green"}>{item.percent}<small>{item.change}</small></span><span className={item.status === "up" ? "red" : "green"}>{item.inflow}</span><span className="row-spark"><MiniSparkline trend={item.status}/></span></button>)}</div><button className="view-all" onClick={() => setActiveNav("自选与持仓")}>查看全部自选 <span>→</span></button></div><div className="right-column"><div className="panel recommendation-panel"><div className="panel-header compact"><div><div className="section-kicker"><Sparkles size={14}/>AI 研判</div><h2>{selected.name} <span className="ticker">{selected.symbol}</span></h2></div><button className="more-button">···</button></div><div className="recommendation-badge"><span className="pulse"/>{liveRecommendation?.action ?? "建议持有"} <strong>·</strong> 信心度 {liveRecommendation ? `${(liveRecommendation.confidence * 100).toFixed(0)}%` : "78%"}</div>{liveRecommendation?.is_stale && <div className="stale-notice">缓存建议 · 非当前槽位生成，仅供复核</div>}<p className="recommendation-copy">{liveRecommendation?.rationale ?? "短期资金仍在流入，但上方套牢盘压力明显。建议维持当前仓位，等待量能确认后再做加仓决策。"}</p><div className="reason-list"><div><span className="reason-icon flow"><TrendingUp size={14}/></span><span><strong>资金流向</strong><small>近 1 小时主力净流入 <b className="red">{liveQuote ? `${liveQuote.net_inflow >= 0 ? "+" : ""}${(liveQuote.net_inflow / 100000000).toFixed(2)} 亿` : "+2.64 亿"}</b></small></span><em>有利</em></div><div><span className="reason-icon market"><LineChart size={14}/></span><span><strong>大盘环境</strong><small>上证指数 <b className="red">+0.63%</b>，市场温度偏多</small></span><em>中性偏多</em></div><div><span className="reason-icon news"><Newspaper size={14}/></span><span><strong>新闻情报</strong><small>2 条相关资讯，权威度加权情绪 <b>+0.18</b></small></span><em>中性</em></div></div><div className="recommendation-footer"><span>更新于 {liveRecommendation ? new Date(liveRecommendation.generated_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "10:00"} · {liveRecommendation?.model_version ?? "rule-based-v1"}</span><button onClick={() => setNotice("已打开完整证据链（演示）")}>查看完整依据 <span>→</span></button></div></div><div className="panel analytics-panel"><div className="panel-header compact"><div><div className="section-kicker"><TrendingUp size={14}/>绩效复盘</div><h2>组合跑赢基准 <span className="outperform">+3.21%</span></h2><p>近 30 个交易日 · AI 建议兑现率 71%</p></div><button className="more-button" onClick={() => setActiveNav("绩效复盘")}>···</button></div><div className="analytics-kpis"><div><span>组合收益</span><strong className="red">+8.42%</strong></div><div><span>最大回撤</span><strong>-2.68%</strong></div><div><span>盈亏比</span><strong>1.74</strong></div></div><div className="analytics-chart"><svg viewBox="0 0 420 90" preserveAspectRatio="none"><path d="M0 72 C55 70 80 65 110 62 S165 49 205 54 S260 35 290 40 S345 19 420 12" fill="none" stroke="#c95750" strokeWidth="2"/><path d="M0 78 C55 76 80 72 110 70 S165 62 205 64 S260 52 290 56 S345 43 420 38" fill="none" stroke="#b8c1bd" strokeWidth="1.5" strokeDasharray="4 4"/></svg><div><span>组合</span><span>沪深 300</span></div></div></div><NewsPanel token={session?.accessToken ?? null} symbol={selected.symbol}/></div></section>
        <HoldingsPanel token={session?.accessToken ?? null} />
        <RiskProfilePanel token={session?.accessToken ?? null} profile={profile} onProfileUpdated={setProfile} />
        <RecommendationTimeline token={session?.accessToken ?? null} />
        <AnalyticsPanel token={session?.accessToken ?? null} />
        {evidenceOpen && <EvidenceDrawer recommendation={liveRecommendation} quote={liveQuote} onClose={() => setEvidenceOpen(false)} />}
        <section className="disclaimer"><ShieldCheck size={16}/><span>智策 AI 仅提供数据整理与投研辅助，不构成任何投资建议。市场有风险，投资需谨慎。</span><a href="#risk">了解数据与模型边界</a></section>
      </div>
    </main>
    {authVisible && <div className="auth-overlay"><AuthView onAuthenticated={handleAuthenticated} onDemo={() => setAuthVisible(false)} /></div>}
  </div>;
}

export default App;
