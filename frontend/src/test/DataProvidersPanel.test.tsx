import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DataProvidersPanel from "../DataProvidersPanel";

describe("管理员数据源健康面板", () => {
  it("展示探测状态、延迟和快照年龄", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
      { name: "demo", kind: "演示", description: "本地数据", configured: true, status: "demo", latency_ms: 2, snapshot_as_of: "2026-09-02T02:00:00Z", snapshot_age_seconds: 0, source: "demo", message: "指数快照探测成功", checked_at: "2026-09-02T02:00:00Z" },
      { name: "akshare", kind: "免费开源适配", description: "公开接口", configured: false, status: "unavailable", latency_ms: null, snapshot_as_of: null, snapshot_age_seconds: null, source: null, message: "依赖未安装或当前不可用", checked_at: "2026-09-02T02:00:00Z" },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { event_id: "e1", name: "demo", kind: "演示", description: "本地数据", configured: true, status: "demo", latency_ms: 2, snapshot_as_of: "2026-09-02T02:00:00Z", snapshot_age_seconds: 0, source: "demo", message: "指数快照探测成功", checked_at: "2026-09-02T02:00:00Z" },
        { event_id: "e2", name: "demo", kind: "演示", description: "本地数据", configured: true, status: "demo", latency_ms: 4, snapshot_as_of: "2026-09-02T01:00:00Z", snapshot_age_seconds: 3600, source: "demo", message: "指数快照探测成功", checked_at: "2026-09-02T01:00:00Z" },
      ]), { status: 200 })));
    render(<DataProvidersPanel token="admin-token" isAdmin />);
    await waitFor(() => expect(screen.getByText("demo · 演示")).toBeTruthy());
    expect(screen.getByText("2 ms · 0s")).toBeTruthy();
    expect(screen.getByText("akshare · 不可用")).toBeTruthy();
    expect(screen.getByText("最近 2 次探测：2 次成功 · 平均延迟 3 ms")).toBeTruthy();
    expect(screen.getByRole("button", { name: "立即探测" })).toBeTruthy();
  });
});
