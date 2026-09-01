import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PortfolioValueCard from "../PortfolioValueCard";

describe("组合市值卡片", () => {
  it("认证态无估值时不展示演示资产数字", () => {
    render(<PortfolioValueCard summary={null} authenticated />);
    expect(screen.getByText("暂无可核验组合估值")).toBeTruthy();
    expect(screen.getByText("等待账户估值接口返回，不展示静态资产数字")).toBeTruthy();
    expect(screen.queryByText("¥ 286,480.00")).toBeNull();
    expect(screen.queryByText("+¥ 4,286.20")).toBeNull();
  });

  it("有接口摘要时展示市值、浮盈亏和来源状态", () => {
    render(<PortfolioValueCard summary={{ cost_basis: 100000, market_value: 102345.67, unrealized_pnl: 2345.67, unrealized_pnl_percent: 2.35, positions_count: 2, valued_positions: 2, data_status: "fresh", source: "mock-provider", as_of: "2026-09-02T02:00:00Z" }} authenticated />);
    expect(screen.getByText("¥ 102,345.67")).toBeTruthy();
    expect(screen.getByText("+¥ 2,345.67")).toBeTruthy();
    expect(screen.getByText(/fresh · mock-provider/)).toBeTruthy();
  });
});
