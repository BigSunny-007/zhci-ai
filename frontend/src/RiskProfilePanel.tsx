import { useEffect, useState } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { updateProfile, UserProfile } from "./api";
import "./risk.css";

type RiskProfilePanelProps = { token: string | null; profile: UserProfile | null; onProfileUpdated: (profile: UserProfile) => void };

const labels = { conservative: "稳健", balanced: "平衡", aggressive: "进取" } as const;

export default function RiskProfilePanel({ token, profile, onProfileUpdated }: RiskProfilePanelProps) {
  const [risk, setRisk] = useState("balanced");
  const [horizon, setHorizon] = useState("1-5d");
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState(token ? "调整后将影响建议说明" : "登录后保存个人偏好");

  useEffect(() => {
    if (!profile) return;
    setRisk(profile.risk_profile || "balanced");
    setHorizon(profile.investment_horizon || "1-5d");
    setTarget(profile.target_return_rate == null ? "" : String(profile.target_return_rate * 100));
  }, [profile]);

  const save = async () => {
    if (!token) return;
    setStatus("正在保存…");
    try {
      const next = await updateProfile(token, { risk_profile: risk, investment_horizon: horizon, target_return_rate: target === "" ? null : Number(target) / 100 });
      onProfileUpdated(next);
      setStatus("已保存 · 仅作为分析偏好");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "偏好保存失败");
    }
  };

  return <section className="panel risk-panel"><div className="panel-header compact"><div><div className="section-kicker"><SlidersHorizontal size={14}/>分析偏好</div><h2>风险与目标</h2><p>{status}</p></div><button className="risk-save" onClick={save} disabled={!token}><Check size={14}/>保存</button></div><div className="risk-fields"><div><span>风险承受度</span><div className="risk-options">{Object.entries(labels).map(([value, label]) => <button key={value} className={risk === value ? "active" : ""} onClick={() => setRisk(value)} disabled={!token}>{label}</button>)}</div></div><label><span>目标回报（%）</span><input value={target} onChange={(event) => setTarget(event.target.value)} type="number" min="-100" max="1000" step="0.1" placeholder="例如 8" disabled={!token}/></label><label><span>关注周期</span><select value={horizon} onChange={(event) => setHorizon(event.target.value)} disabled={!token}><option value="1d">日内/1 日</option><option value="1-2d">1–2 个交易日</option><option value="1-5d">1–5 个交易日</option><option value="medium">中期</option><option value="long">长期</option></select></label></div><small className="risk-disclaimer">偏好只用于调整分析上下文，不代表适当性评估、收益承诺或交易指令。</small></section>;
}
