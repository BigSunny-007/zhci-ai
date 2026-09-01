import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AnalyticsPanel from "../AnalyticsPanel";

describe("数据化复盘面板", () => {
  it("按周期展示已兑现建议的复盘指标", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ period: "近30日组合", data_status: "demo", portfolio_return: 0.08, excess_return: 0.02, max_drawdown: -0.04, profit_loss_ratio: 1.8, recommendation_accuracy: 0.67, series: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ period: "已到期建议", evaluated_count: 3, win_rate: 0.67, max_drawdown: -0.04, profit_loss_ratio: 1.8, recommendation_accuracy: 0.67, data_status: "demo", series: [], by_horizon: [
        { horizon: "1-2d", evaluated_count: 1, win_rate: 1, max_drawdown: 0, profit_loss_ratio: 2, recommendation_accuracy: 1 },
        { horizon: "1-5d", evaluated_count: 1, win_rate: 0, max_drawdown: -0.08, profit_loss_ratio: 0.5, recommendation_accuracy: 0 },
        { horizon: "medium", evaluated_count: 1, win_rate: 1, max_drawdown: 0, profit_loss_ratio: 1.5, recommendation_accuracy: 1 },
      ] }), { status: 200 })));

    render(<AnalyticsPanel token="user-token" />);
    expect(await screen.findByText("按周期复盘")).toBeTruthy();
    expect(screen.getByText("短期 · 1–2日")).toBeTruthy();
    expect(screen.getByText("波段 · 1–5日")).toBeTruthy();
    expect(screen.getByText("中期 · 1–3月")).toBeTruthy();
    expect(screen.getAllByText("1 个样本")).toHaveLength(3);
  });

  it("总览紧凑卡片只展示接口返回的真实指标", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ period: "近30日组合", data_status: "来自账户接口", portfolio_return: 0.12, excess_return: 0.03, max_drawdown: -0.05, profit_loss_ratio: 1.6, recommendation_accuracy: 0.8, series: [] }), { status: 200 })));
    render(<AnalyticsPanel token="user-token" compact />);
    expect(await screen.findByText("+12.00%")).toBeTruthy();
    expect(screen.getByText("+3.00%")).toBeTruthy();
    expect(screen.getByText("-5.00%")).toBeTruthy();
    expect(screen.getByText("1.60")).toBeTruthy();
    expect(screen.queryByText("+8.42%")).toBeNull();
  });
});
