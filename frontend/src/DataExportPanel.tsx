import { useState } from "react";
import { Download, FileJson } from "lucide-react";
import { getDataExport } from "./api";

type DataExportPanelProps = { token: string | null };

export default function DataExportPanel({ token }: DataExportPanelProps) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const exportData = async () => {
    if (!token) return;
    setState("loading");
    try {
      const data = await getDataExport(token);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `zhice-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setState("idle");
    } catch {
      setState("error");
    }
  };

  return <section className="data-export-panel panel"><div className="panel-header compact"><div><div className="section-kicker"><FileJson size={14}/>数据权利</div><h2>导出我的投研数据</h2><p>下载当前账号的持仓、自选、建议和审计摘要</p></div><button className="export-button" onClick={() => void exportData()} disabled={!token || state === "loading"}><Download size={14}/>{state === "loading" ? "生成中…" : "下载 JSON"}</button></div>{!token && <p className="export-empty">登录后可导出当前账号数据。</p>}{state === "error" && <p className="export-empty">导出失败，请稍后重试。</p>}{token && state === "idle" && <div className="export-foot">导出由服务端按账号隔离生成，不包含其他用户数据。</div>}</section>;
}
