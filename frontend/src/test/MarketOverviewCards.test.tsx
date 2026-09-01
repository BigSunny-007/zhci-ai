import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MarketOverviewCards from "../MarketOverviewCards";

describe("总览市场快照卡片", () => {
  it("登录后用快照和建议证据渲染大盘与温度", () => {
    render(<MarketOverviewCards authenticated marketIndex={{ symbol: "000001.SH", name: "上证指数", price: 3387.42, change: 21.1, change_percent: 0.63, source: "demo", as_of: "2026-09-02T02:00:00Z", data_status: "demo" }} recommendation={{ symbol: "600519.SH", horizon: "1-5d", action: "买入观察", confidence: 0.7, rationale: "测试", evidence: { score: "0.44" }, generated_at: "2026-09-02T02:00:00Z", model_version: "test" }} onViewRecommendation={() => undefined} />);
    expect(screen.getByText("3,387.42")).toBeTruthy();
    expect(screen.getByText("偏多")).toBeTruthy();
    expect(screen.getByText("72")).toBeTruthy();
  });

  it("登录后没有快照时不展示静态大盘数字", () => {
    render(<MarketOverviewCards authenticated marketIndex={null} recommendation={null} onViewRecommendation={() => undefined} />);
    expect(screen.getAllByText("暂无")).toHaveLength(2);
    expect(screen.getByText("等待市场快照同步")).toBeTruthy();
    expect(screen.queryByText("3,387.42")).toBeNull();
  });
});
