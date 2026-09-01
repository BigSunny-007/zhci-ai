import { useEffect, useState } from "react";
import { GitBranch, ShieldCheck } from "lucide-react";
import { getModelPolicies, type ModelPolicy } from "./api";

type PolicyPanelProps = { token: string | null; isAdmin: boolean };
const statusLabels: Record<ModelPolicy["status"], string> = { draft: "草稿", pending_review: "待双人审核", active: "生效中", retired: "已退役" };

export default function PolicyPanel({ token, isAdmin }: PolicyPanelProps) {
  const [policies, setPolicies] = useState<ModelPolicy[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token || !isAdmin) {
      setPolicies([]);
      return;
    }
    let active = true;
    getModelPolicies(token).then((next) => {
      if (active) {
        setPolicies(next);
        setError(false);
      }
    }).catch(() => {
      if (active) setError(true);
    });
    return () => { active = false; };
  }, [token, isAdmin]);

  if (!isAdmin) return null;
  const current = policies.find((policy) => policy.status === "active") ?? policies[0];
  return <section className="policy-panel panel"><div className="panel-header compact"><div><div className="section-kicker"><GitBranch size={14}/>模型治理</div><h2>策略版本与审批</h2><p>规则和权重变更必须经过人工确认</p></div></div>{error && <p className="policy-empty">策略同步失败 · 保留安全状态</p>}{!current && !error && <p className="policy-empty">正在同步策略版本…</p>}{current && <div className="policy-content"><div className="policy-status"><ShieldCheck size={15}/><strong>{current.version}</strong><span className={`policy-pill ${current.status}`}>{statusLabels[current.status]}</span><span>第 {current.review_round} 轮 · {current.approval_count} 次同意</span></div><div className="policy-weights"><span>资金流 {Math.round(current.weights.fund_flow * 100)}%</span><span>动量 {Math.round(current.weights.momentum * 100)}%</span><span>新闻权威度 {Math.round(current.weights.news_authority_adjusted * 100)}%</span></div><p className="policy-rationale">{current.rationale}</p></div>}</section>;
}
