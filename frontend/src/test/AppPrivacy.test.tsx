import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { clearSession, saveSession } from "../api";

const profile = { id: "user-a", email: "a@example.com", display_name: "用户 A", risk_profile: "balanced", target_return_rate: null, investment_horizon: "1-5d", is_admin: false, email_verified: true };
const quote = { symbol: "688001.SH", name: "账户私有标的", price: 42.5, change: 1.2, change_percent: 2.9, volume: 1200000, net_inflow: 8600000, source: "account-provider", as_of: "2026-09-02T02:00:00Z", fund_flow_status: "available" };
const recommendation = { symbol: "688001.SH", horizon: "1-5d", action: "持有观察", confidence: 0.65, rationale: "ACCOUNT_PRIVATE_RATIONALE", evidence: { score: "0.3" }, generated_at: "2026-09-02T02:00:00Z", model_version: "test" };
const summary = { cost_basis: 10000, market_value: 10500, unrealized_pnl: 500, unrealized_pnl_percent: 0.05, positions_count: 1, valued_positions: 1, data_status: "fresh", source: "account-provider", as_of: "2026-09-02T02:00:00Z" };
const risk = { total_positions: 1, valued_positions: 1, unavailable_positions: 0, top_position_weight: 1, concentration_index: 1, concentration_level: "high", single_position_limit: 0.3, loss_limit_breached_count: 0, target_reached_count: 0, positions: [] };
const analytics = { period: "近 30 日", portfolio_return: 0.05, benchmark_return: 0.03, excess_return: 0.02, max_drawdown: -0.01, win_rate: 0.6, profit_loss_ratio: 1.5, recommendation_accuracy: 0.5, data_status: "fresh", series: [] };
const evaluation = { period: "近 30 日", evaluated_count: 0, win_rate: 0, max_drawdown: 0, profit_loss_ratio: 0, recommendation_accuracy: 0, data_status: "暂无", series: [] };

afterEach(() => {
  clearSession();
  vi.restoreAllMocks();
});

describe("工作台会话隔离", () => {
  it("退出后清除上一账号的建议和自选标的", async () => {
    saveSession({ accessToken: "account-token", refreshToken: "refresh-token", emailVerified: true });
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      let body: unknown = [];
      if (url.includes("/auth/me")) body = profile;
      else if (url.includes("/market/quote")) body = quote;
      else if (url.includes("/market/recommendation")) body = recommendation;
      else if (url.includes("/market/index")) body = { symbol: "000001.SH", name: "上证指数", price: 3387.42, change: 21.1, change_percent: 0.63, source: "account-provider", as_of: "2026-09-02T02:00:00Z", data_status: "available" };
      else if (url.includes("/portfolio/summary")) body = summary;
      else if (url.includes("/portfolio/risk")) body = risk;
      else if (url.includes("/portfolio/watchlist")) body = [{ id: "watch-a", symbol: "688001.SH", name: "账户私有标的" }];
      else if (url.includes("/analytics/recommendations")) body = evaluation;
      else if (url.includes("/analytics/overview")) body = analytics;
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    }));
    render(<App />);
    await waitFor(() => expect(screen.getByText("ACCOUNT_PRIVATE_RATIONALE")).toBeTruthy());
    expect(screen.getByText("688001.SH")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "退出" }));
    expect(screen.queryByText("ACCOUNT_PRIVATE_RATIONALE")).toBeNull();
    expect(screen.queryByText("688001.SH")).toBeNull();
    expect(screen.getByText("演示工作区")).toBeTruthy();
  });
});
