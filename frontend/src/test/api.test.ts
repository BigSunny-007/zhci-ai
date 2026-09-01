import { beforeEach, describe, expect, it, vi } from "vitest";
import { addHolding, changePassword, checkAlerts, clearSession, createAlert, deleteAlert, getAdminOverview, getAlertTriggers, getAlerts, getAnalyticsOverview, getAuditEvents, getAuditIntegrity, getDataExport, getDataProviderHealth, getDataProviderHealthHistory, getDataProviders, getHistory, getMarketIndex, getModelPolicies, getPortfolioRisk, getPortfolioSummary, getRecommendationEvaluation, getRecommendations, getSchedulerStatus, loadSession, login, refreshSession, resendVerification, saveSession, updateAlert } from "../api";

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

  it("读取管理员数据源健康探测", async () => {
    const health = [{ name: "demo", status: "demo", latency_ms: 2, snapshot_age_seconds: 0 }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(health), { status: 200 })));
    await expect(getDataProviderHealth("admin-token")).resolves.toEqual(health);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/admin/data-providers/health"), expect.anything());
  });

  it("读取管理员数据源健康历史", async () => {
    const history = [{ event_id: "e1", name: "demo", status: "demo", latency_ms: 2 }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(history), { status: 200 })));
    await expect(getDataProviderHealthHistory("admin-token", "demo", 8)).resolves.toEqual(history);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/admin/data-providers/health/history?limit=8&provider=demo"), expect.anything());
  });

  it("读取建议兑现评估", async () => {
    const byHorizon = [{ horizon: "1-2d", evaluated_count: 2, win_rate: 0.5, max_drawdown: -0.1, profit_loss_ratio: 1.4, recommendation_accuracy: 0.5 }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ evaluated_count: 2, recommendation_accuracy: 0.5, by_horizon: byHorizon }), { status: 200 })));
    await expect(getRecommendationEvaluation("user-token")).resolves.toEqual({ evaluated_count: 2, recommendation_accuracy: 0.5, by_horizon: byHorizon });
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

  it("读取组合风险预算与持仓权重", async () => {
    const risk = { concentration_level: "watch", top_position_weight: 0.32, positions: [] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(risk), { status: 200 })));
    await expect(getPortfolioRisk("user-token")).resolves.toEqual(risk);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/portfolio/risk"), expect.anything());
  });

  it("保存持仓级目标回报与最大亏损", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "h1", symbol: "600519.SH" }), { status: 201 })));
    await expect(addHolding("user-token", { symbol: "600519.SH", name: "贵州茅台", quantity: 100, cost_price: 1500, target_return: 0.08, max_loss: 0.05 })).resolves.toEqual({ id: "h1", symbol: "600519.SH" });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/portfolio/holdings"), expect.objectContaining({ method: "POST", body: expect.stringContaining('"max_loss":0.05') }));
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

  it("读取历史行情及成交量字段", async () => {
    const history = [{ time: "2026-09-01T00:00:00Z", close: 10, volume: 1200000, net_inflow: 35000 }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(history), { status: 200 })));
    await expect(getHistory("user-token", "600519.SH", 30)).resolves.toEqual(history);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/market/history?symbol=600519.SH&days=30"), expect.anything());
  });

  it("读取带来源和时间戳的大盘快照", async () => {
    const index = { symbol: "000001.SH", name: "上证指数", price: 3387.42, change: 21.1, change_percent: 0.63, source: "demo", as_of: "2026-09-02T01:00:00Z", data_status: "demo" as const };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(index), { status: 200 })));
    await expect(getMarketIndex("user-token")).resolves.toEqual(index);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/market/index"), expect.objectContaining({ headers: expect.anything() }));
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

  it("检查提醒并读取触发历史", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ checked_count: 1, suppressed_count: 0, failed_count: 0, checked_at: "2026-09-02T02:00:00Z", data_status: "发现 1 条触发提醒，已写入历史", triggers: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 })));
    await expect(checkAlerts("user-token")).resolves.toMatchObject({ checked_count: 1 });
    await expect(getAlertTriggers("user-token", 8)).resolves.toEqual([]);
    expect(fetch).toHaveBeenNthCalledWith(1, expect.stringContaining("/alerts/check"), expect.objectContaining({ method: "POST" }));
    expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining("/alerts/triggers?limit=8"), expect.anything());
  });
});
