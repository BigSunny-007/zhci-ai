import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, WalletCards, X } from "lucide-react";
import { addHolding, getHoldings, getPortfolioSummary, HoldingItem, PortfolioSummary, removeHolding } from "./api";
import "./holdings.css";

type HoldingsPanelProps = { token: string | null };

export default function HoldingsPanel({ token }: HoldingsPanelProps) {
  const [holdings, setHoldings] = useState<HoldingItem[]>([]);
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [status, setStatus] = useState("登录后同步你的真实持仓");
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);

  useEffect(() => {
    if (!token) return;
    setStatus("正在同步持仓…");
    Promise.all([getHoldings(token), getPortfolioSummary(token)]).then(([items, nextSummary]) => {
      setHoldings(items);
      setSummary(nextSummary);
      setStatus(items.length ? `${nextSummary.data_status} · 仅当前账号可见` : "还没有持仓，添加第一笔记录");
    }).catch(() => setStatus("持仓同步失败 · 请稍后重试"));
  }, [token]);

  const costBasis = useMemo(() => holdings.reduce((total, item) => total + item.quantity * item.cost_price, 0), [holdings]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    try {
      const saved = await addHolding(token, { symbol: symbol.trim().toUpperCase(), name: name.trim() || "自选股", quantity: Number(quantity), cost_price: Number(costPrice) });
      setHoldings((current) => [saved, ...current]);
      setStatus("持仓已保存 · AI 将优先关注");
      setSymbol(""); setName(""); setQuantity(""); setCostPrice(""); setOpen(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "持仓保存失败");
    }
  };

  const remove = async (item: HoldingItem) => {
    if (!token || !window.confirm(`确认删除 ${item.name} 的持仓记录？`)) return;
    try {
      await removeHolding(token, item.symbol);
      setHoldings((current) => current.filter((holding) => holding.id !== item.id));
      setStatus("持仓已删除 · 建议历史仍会保留");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "持仓删除失败");
    }
  };

  const displaySummary = summary ?? { cost_basis: costBasis, market_value: 0, unrealized_pnl: 0, unrealized_pnl_percent: 0, positions_count: holdings.length, valued_positions: 0, data_status: "未登录不估值", source: "—", as_of: "" };
  return <section className="panel holdings-panel">
    <div className="panel-header compact"><div><div className="section-kicker"><WalletCards size={14}/>我的持仓</div><h2>组合市值 <span className="holdings-total">¥{displaySummary.market_value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}</span></h2><p>{status}</p></div><button className="add-holding-button" onClick={() => setOpen((visible) => !visible)} aria-label={open ? "关闭持仓表单" : "添加持仓"}>{open ? <X size={16}/> : <Plus size={16}/>}</button></div>
    {summary && <div className="holdings-summary"><span>成本 ¥{summary.cost_basis.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}</span><strong className={summary.unrealized_pnl >= 0 ? "holding-positive" : "holding-negative"}>{summary.unrealized_pnl >= 0 ? "+" : ""}¥{summary.unrealized_pnl.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}（{summary.unrealized_pnl_percent >= 0 ? "+" : ""}{(summary.unrealized_pnl_percent * 100).toFixed(2)}%）</strong><small>已估值 {summary.valued_positions}/{summary.positions_count}</small><small>{summary.as_of ? `估值于 ${new Date(summary.as_of).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}` : "估值时间未知"}</small></div>}
    {open && <form className="holding-form" onSubmit={submit}><input value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="股票代码" required minLength={2}/><input value={name} onChange={(event) => setName(event.target.value)} placeholder="名称（可选）"/><input value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="持仓数量" type="number" min="0" step="any" required/><input value={costPrice} onChange={(event) => setCostPrice(event.target.value)} placeholder="成本价" type="number" min="0.01" step="any" required/><button className="holding-submit" disabled={!token}>保存持仓</button></form>}
    {holdings.length > 0 && <div className="holdings-list">{holdings.slice(0, 4).map((item) => <div className="holding-row" key={item.id}><span><strong>{item.name}</strong><small>{item.symbol}</small></span><span>{item.quantity.toLocaleString("zh-CN")} 股</span><strong>¥{(item.quantity * item.cost_price).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}</strong><button className="holding-remove" onClick={() => remove(item)}>删除</button></div>)}</div>}
  </section>;
}
