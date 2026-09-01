import { beforeEach, describe, expect, it, vi } from "vitest";
import { changePassword, clearSession, createAlert, deleteAlert, getAdminOverview, getAlerts, getAnalyticsOverview, getAuditEvents, getAuditIntegrity, getDataExport, getDataProviders, getModelPolicies, getPortfolioSummary, getRecommendationEvaluation, getRecommendations, getSchedulerStatus, loadSession, login, refreshSession, resendVerification, saveSession, updateAlert } from "../api";

describe("API 会话客户端", () => {
  beforeEach(() => {
    clearSession();
    vi.restoreAllMocks();
  });

  it("将后端蛇形命名令牌映射为前端会话并持久化到 sessionStorage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "access-token", refresh_token: "refresh-token", email_verified: true }), { status: 200 }),
    ));
    const session = await login("user@example.com", "password123");
    saveSession(session);
    expect(session).toEqual({ accessToken: "access-token", refreshToken: "refresh-token", emailVerified: true });
    expect(loadSession()).toEqual(session);
  });

  it("支持刷新令牌轮换", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "next-access", refresh_token: "next-refresh", email_verified: true }), { status: 200 }),
    ));
    await expect(refreshSession("refresh-token-value")).resolves.toEqual({
      accessToken: "next-access",
      refreshToken: "next-refresh",
      emailVerified: true,
    });
  });

  it("按上限读取当前用户建议历史", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    ));
    await expect(getRecommendations("access-token", 5)).resolves.toEqual([]);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/market/recommendations?limit=5"), expect.anything());
  });

  it("读取带来源状态的绩效概览", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data_status: "demo" }), { status: 200 }),
    ));
    await expect(getAnalyticsOverview("access-token")).resolves.toEqual({ data_status: "demo" });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/analytics/overview"), expect.anything());
  });

  it("读取管理员匿名聚合概览", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ total_users: 2 }), { status: 200 }),
    ));
    await expect(getAdminOverview("admin-token")).resolves.toEqual({ total_users: 2 });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/admin/overview"), expect.anything());
  });

  it("读取策略版本审批状态", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    ));
    await expect(getModelPolicies("admin-token")).resolves.toEqual([]);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/admin/model-policies"), expect.anything());
  });

  it("读取审计完整性校验报告", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ checked_events: 1 }), { status: 200 }),
    ));
    await expect(getAuditIntegrity("admin-token")).resolves.toEqual({ checked_events: 1 });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/admin/audit-integrity"), expect.anything());
  });

  it("读取建议调度状态", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ enabled: false, running: false }), { status: 200 }),
    ));
    await expect(getSchedulerStatus("admin-token")).resolves.toEqual({ enabled: false, running: false });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/admin/scheduler"), expect.anything());
  });

  it("读取管理员数据源目录", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([{ name: "demo", configured: true }]), { status: 200 })));
    await expect(getDataProviders("admin-token")).resolves.toEqual([{ name: "demo", configured: true }]);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/admin/data-providers"), expect.anything());
  });

  it("读取建议兑现评估", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ evaluated_count: 2, recommendation_accuracy: 0.5 }), { status: 200 })));
    await expect(getRecommendationEvaluation("user-token")).resolves.toEqual({ evaluated_count: 2, recommendation_accuracy: 0.5 });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/analytics/recommendations"), expect.anything());
  });

  it("读取审计操作摘要", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([{ event_id: "e1", action: "alert.created" }]), { status: 200 })));
    await expect(getAuditEvents("admin-token", 8)).resolves.toEqual([{ event_id: "e1", action: "alert.created" }]);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/admin/audit-events?limit=8"), expect.anything());
  });

  it("读取组合估值摘要", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ market_value: 100, unrealized_pnl: 5 }), { status: 200 })));
    await expect(getPortfolioSummary("user-token")).resolves.toEqual({ market_value: 100, unrealized_pnl: 5 });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/portfolio/summary"), expect.anything());
  });

  it("导出当前账号投研数据", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ exported_at: "2026-09-01T00:00:00Z", holdings: [] }), { status: 200 })));
    await expect(getDataExport("user-token")).resolves.toEqual({ exported_at: "2026-09-01T00:00:00Z", holdings: [] });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/auth/data-export"), expect.anything());
  });

  it("轮换当前账号密码", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "密码已更新" }), { status: 200 })));
    await expect(changePassword("user-token", "old-pass", "new-pass")).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/auth/change-password"), expect.objectContaining({ method: "POST" }));
  });

  it("重发邮箱验证邮件", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "验证邮件已重新发送", email_verified: false }), { status: 200 })));
    await expect(resendVerification("user@example.com")).resolves.toEqual({ message: "验证邮件已重新发送", emailVerified: false });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/auth/resend-verification"), expect.objectContaining({ method: "POST" }));
  });

  it("读取、创建并管理站内提醒", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "a1", symbol: "600519.SH" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "a1", is_active: false }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "提醒已删除" }), { status: 200 })));
    await expect(getAlerts("user-token")).resolves.toEqual([]);
    await expect(createAlert("user-token", { symbol: "600519.SH", condition_type: "price_above", threshold: 1800, frequency: "once", message: "关注突破", channel: "in_app" })).resolves.toEqual({ id: "a1", symbol: "600519.SH" });
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining("/alerts"), expect.objectContaining({ method: "POST" }));
    await expect(updateAlert("user-token", "a1", false)).resolves.toEqual({ id: "a1", is_active: false });
    await expect(deleteAlert("user-token", "a1")).resolves.toBeUndefined();
  });
});
