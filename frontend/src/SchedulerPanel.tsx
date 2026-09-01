import { useEffect, useState } from "react";
import { CalendarClock, CircleCheck, CircleOff } from "lucide-react";
import { getSchedulerStatus, type SchedulerStatus } from "./api";

type SchedulerPanelProps = { token: string | null; isAdmin: boolean };

export default function SchedulerPanel({ token, isAdmin }: SchedulerPanelProps) {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token || !isAdmin) {
      setStatus(null);
      return;
    }
    let active = true;
    getSchedulerStatus(token).then((next) => {
      if (active) {
        setStatus(next);
        setError(false);
      }
    }).catch(() => {
      if (active) setError(true);
    });
    return () => { active = false; };
  }, [token, isAdmin]);

  if (!isAdmin) return null;
  const nextRun = status?.next_run_at ? new Date(status.next_run_at).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "未排期";
  return <section className="scheduler-panel panel"><div className="panel-header compact"><div><div className="section-kicker"><CalendarClock size={14}/>建议调度</div><h2>定时任务状态</h2><p>交易日 10:00、11:00、14:00 生成分析建议</p></div></div>{error && <p className="scheduler-empty">调度状态同步失败 · 请检查后台服务</p>}{!status && !error && <p className="scheduler-empty">正在读取调度状态…</p>}{status && <div className="scheduler-content"><div className="scheduler-status"><span className={status.running ? "scheduler-dot running" : "scheduler-dot"}/><strong>{status.running ? "运行中" : status.enabled ? "已启用但未运行" : "已关闭"}</strong><span>{status.job_id}</span></div><div className="scheduler-meta"><span>{status.enabled ? <CircleCheck size={12}/> : <CircleOff size={12}/>}配置：{status.enabled ? "已启用" : "默认关闭"}</span><span>下一次：{nextRun}</span><span>时区：{status.timezone}</span></div></div>}</section>;
}
