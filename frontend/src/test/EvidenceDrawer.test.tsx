import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EvidenceDrawer from "../EvidenceDrawer";

describe("建议证据抽屉持仓规则", () => {
  it("展示持仓目标、止损和触发信号", () => {
    render(<EvidenceDrawer recommendation={{ symbol: "600519.SH", horizon: "1-5d", action: "减仓观察", confidence: 0.5, rationale: "测试", evidence: { holding_risk: { cost_price: "100", target_return: "0.2", max_loss: "0.05", unrealized_return: "-0.1", signal: "loss_limit_breached" } }, generated_at: "2026-09-02T02:00:00Z", model_version: "test" }} quote={null} onClose={() => undefined} />);
    expect(screen.getByText("持仓级规则")).toBeTruthy();
    expect(screen.getByText("100.00")).toBeTruthy();
    expect(screen.getByText("+20.0%")).toBeTruthy();
    expect(screen.getByText("5.0%")).toBeTruthy();
    expect(screen.getByText("已触发最大亏损")).toBeTruthy();
  });

  it("未配置持仓规则时明确展示未配置", () => {
    render(<EvidenceDrawer recommendation={{ symbol: "600519.SH", horizon: "1-5d", action: "持有观察", confidence: 0.5, rationale: "测试", evidence: {}, generated_at: "2026-09-02T02:00:00Z", model_version: "test" }} quote={null} onClose={() => undefined} />);
    expect(screen.getByText("持仓级规则")).toBeTruthy();
    expect(screen.getAllByText("未配置").length).toBeGreaterThanOrEqual(4);
  });
});
