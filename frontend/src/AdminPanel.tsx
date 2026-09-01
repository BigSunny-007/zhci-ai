import { useEffect, useState } from "react";
import { Shield, Users } from "lucide-react";
import { getAdminOverview, type AdminOverview } from "./api";

type AdminPanelProps = { token: string | null; isAdmin: boolean };

export default function AdminPanel({ token, isAdmin }: AdminPanelProps) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token || !isAdmin) {
      setOverview(null);
      return;
    }
    let active = true;
    getAdminOverview(token).then((next) => {
      if (active) {
        setOverview(next);
        setError(false);
      }
    }).catch(() => {
      if (active) setError(true);
    });
    return () => { active = false; };
  }, [token, isAdmin]);

  if (!isAdmin) return null;
  return <section className="admin-panel panel"><div className="panel-header compact"><div><div className="section-kicker"><Shield size={14}/>管理员中心</div><h2>平台运行概览</h2><p>仅展示匿名聚合指标，不读取用户持仓明细</p></div></div>{error && <p className="admin-empty">管理员数据同步失败 · 请稍后重试</p>}{!overview && !error && <p className="admin-empty">正在同步平台指标…</p>}{overview && <><div className="admin-kpis"><div><span>注册用户</span><strong>{overview.total_users.toLocaleString("zh-CN")}</strong></div><div><span>活跃用户</span><strong>{overview.active_users.toLocaleString("zh-CN")}</strong></div><div><span>已验证用户</span><strong>{overview.verified_users.toLocaleString("zh-CN")}</strong></div><div><span>建议样本</span><strong>{overview.recommendations_count.toLocaleString("zh-CN")}</strong></div></div><div className="admin-foot"><span><Users size={12}/>近 24 小时登录 {overview.login_events_24h}</span><span>{overview.data_status}</span></div></>}</section>;
}
