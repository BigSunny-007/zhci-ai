import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PortfolioRiskPanel from "../PortfolioRiskPanel";

describe("组合风险预算面板", () => {
  it("展示集中度状态和已估值持仓权重", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      risk_profile: "balanced",
      single_position_limit: 0.2,
      market_value: 1000,
      total_positions: 2,
      valued_positions: 2,
      top_position_weight: 0.7,
      concentration_index: 0.58,
      concentration_level: "high",
      data_status: "组合集中度超过当前风险偏好的观察阈值",
      as_of: "2026-09-02T02:00:00Z",
      positions: [
        { symbol: "600519.SH", name: "贵州茅台", market_value: 700, weight: 0.7, unrealized_pnl: 20, quote_status: "valued", source: "demo", as_of: "2026-09-02T02:00:00Z" },
        { symbol: "300750.SZ", name: "宁德时代", market_value: 300, weight: 0.3, unrealized_pnl: -10, quote_status: "valued", source: "demo", as_of: "2026-09-02T02:00:00Z" },
      ],
    }), { status: 200 })));
    render(<PortfolioRiskPanel token="user-token" />);
    expect(await screen.findByText("组合风险预算")).toBeTruthy();
    expect(screen.getByText("集中度偏高")).toBeTruthy();
    expect(screen.getByText("贵州茅台")).toBeTruthy();
    expect(screen.getAllByText("70.0%")).toHaveLength(2);
    expect(screen.getByText("已估值 2/2 个持仓")).toBeTruthy();
  });
});
