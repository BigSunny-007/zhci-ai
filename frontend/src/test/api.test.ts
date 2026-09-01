import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, getAdminOverview, getAnalyticsOverview, getAuditIntegrity, getModelPolicies, getRecommendations, getSchedulerStatus, loadSession, login, refreshSession, saveSession } from "../api";

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
});
