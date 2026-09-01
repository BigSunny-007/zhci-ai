import { FormEvent, useEffect, useState } from "react";
import { Bell, Plus, RefreshCw } from "lucide-react";
import { Alert, AlertTrigger, checkAlerts, createAlert, deleteAlert, getAlertTriggers, getAlerts, updateAlert } from "./api";

type AlertsPanelProps = { token: string | null; symbol: string };

const conditionLabels: Record<Alert["condition_type"], string> = {
  price_above: "价格高于",
  price_below: "价格低于",
  inflow_above: "净流入高于（元）",
  change_percent_above: "涨幅高于（%）",
};

const frequencyLabels: Record<Alert["frequency"], string> = {
  once: "触发一次",
  hourly: "每小时",
  daily: "每日",
};

export default function AlertsPanel({ token, symbol }: AlertsPanelProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [triggers, setTriggers] = useState<AlertTrigger[]>([]);
  const [open, setOpen] = useState(false);
  const [condition, setCondition] = useState<Alert["condition_type"]>("price_above");
  const [threshold, setThreshold] = useState(0);
  const [frequency, setFrequency] = useState<Alert["frequency"]>("once");
  const [message, setMessage] = useState("达到预设条件，请复核 AI 依据");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!token) {
      setAlerts([]);
      return;
    }
    let active = true;
    setState("loading");
    Promise.all([getAlerts(token), getAlertTriggers(token, 8)]).then(([next, recentTriggers]) => {
      if (active) {
        setAlerts(next);
        setTriggers(recentTriggers);
        setState("idle");
      }
    }).catch(() => {
      if (active) setState("error");
    });
    return () => { active = false; };
  }, [token]);

  const checkNow = async () => {
    if (!token || checking) return;
    setChecking(true);
    try {
      const result = await checkAlerts(token);
      setTriggers((current) => [...result.triggers, ...current].slice(0, 8));
      setState("idle");
    } catch {
      setState("error");
    } finally {
      setChecking(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !symbol || !Number.isFinite(threshold) || threshold <= 0) return;
    setState("loading");
    try {
      const created = await createAlert(token, { symbol, condition_type: condition, threshold, frequency, message, channel: "in_app" });
      setAlerts((current) => [created, ...current]);
      setOpen(false);
      setState("idle");
    } catch {
      setState("error");
    }
  };

  const toggle = async (alert: Alert) => {
    if (!token) return;
    try {
      const updated = await updateAlert(token, alert.id, !alert.is_active);
      setAlerts((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch {
      setState("error");
    }
  };

  const remove = async (alert: Alert) => {
    if (!token || !window.confirm(`删除 ${alert.symbol} 的提醒？`)) return;
    try {
      await deleteAlert(token, alert.id);
      setAlerts((current) => current.filter((item) => item.id !== alert.id));
    } catch {
      setState("error");
    }
  };

  return <section className="alerts-panel panel">
    <div className="panel-header compact">
      <div><div className="section-kicker"><Bell size={14}/>智能提醒</div><h2>守住关键价位</h2><p>提醒只负责通知，不会自动交易</p></div>
      {token && <div className="alert-header-actions"><button className="check-alert-button" onClick={() => void checkNow()} disabled={checking}><RefreshCw size={13} className={checking ? "spinning" : ""}/> {checking ? "检查中" : "立即检查"}</button><button className="add-alert-button" onClick={() => setOpen((current) => !current)}><Plus size={14}/>新建提醒</button></div>}
    </div>
    {open && token && <form className="alert-form" onSubmit={submit}>
      <div className="alert-form-title">为 {symbol} 设置条件</div>
      <div className="alert-form-row"><select aria-label="提醒条件" value={condition} onChange={(event) => setCondition(event.target.value as Alert["condition_type"])}>{Object.entries(conditionLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><input aria-label="阈值" type="number" min="0" step="0.01" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))}/><select aria-label="提醒频率" value={frequency} onChange={(event) => setFrequency(event.target.value as Alert["frequency"])}>{Object.entries(frequencyLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
      <input aria-label="提醒内容" value={message} maxLength={240} onChange={(event) => setMessage(event.target.value)}/>
      <div className="alert-form-actions"><span>数据触发后将在站内通知</span><button type="submit" className="primary-button" disabled={state === "loading"}>{state === "loading" ? "保存中…" : "保存提醒"}</button></div>
    </form>}
    {!token && <p className="alerts-empty">登录后可创建价格、资金流和涨跌幅提醒。</p>}
    {token && state === "loading" && !open && <p className="alerts-empty">正在同步提醒…</p>}
    {token && state === "error" && <p className="alerts-empty">提醒同步失败，请稍后重试。</p>}
    {token && state !== "error" && state !== "loading" && alerts.length === 0 && <p className="alerts-empty">还没有提醒。可针对当前自选股设置第一个条件。</p>}
    {token && alerts.length > 0 && <div className="alerts-list">{alerts.slice(0, 4).map((alert) => <div className="alert-row" key={alert.id}><span className="alert-symbol">{alert.symbol}</span><span>{conditionLabels[alert.condition_type]} <strong>{alert.threshold}</strong></span><small>{frequencyLabels[alert.frequency]} · {alert.is_active ? "运行中" : "已暂停"}</small><div className="alert-actions"><button onClick={() => void toggle(alert)}>{alert.is_active ? "暂停" : "恢复"}</button><button onClick={() => void remove(alert)}>删除</button></div></div>)}</div>}
    {token && triggers.length > 0 && <div className="alert-trigger-history"><span>最近触发</span>{triggers.slice(0, 3).map((trigger) => <div key={trigger.id}><strong>{trigger.symbol}</strong><small>{conditionLabels[trigger.condition_type]} {trigger.observed_value} · {new Date(trigger.triggered_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</small></div>)}</div>}
  </section>;
}
