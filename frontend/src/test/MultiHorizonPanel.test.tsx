import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MultiHorizonPanel from "../MultiHorizonPanel";

describe("多周期研判面板", () => {
  it("按当前标的展示三个已保存周期", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { id: "short", symbol: "600519.SH", horizon: "1-2d", action: "买入观察", confidence: 0.7, rationale: "短期动量转强", evidence: {}, generated_at: "2026-09-02T01:00:00Z", model_version: "v1", delivery_mode: "generated" },
      { id: "swing", symbol: "600519.SH", horizon: "1-5d", action: "持有观察", confidence: 0.6, rationale: "等待量能确认", evidence: {}, generated_at: "2026-09-02T01:00:00Z", model_version: "v1", delivery_mode: "cached" },
      { id: "medium", symbol: "600519.SH", horizon: "medium", action: "减仓观察", confidence: 0.5, rationale: "中期估值偏高", evidence: {}, generated_at: "2026-09-02T01:00:00Z", model_version: "v1", delivery_mode: "generated" },
      { id: "other", symbol: "300750.SZ", horizon: "1-2d", action: "减仓观察", confidence: 0.9, rationale: "其他标的", evidence: {}, generated_at: "2026-09-02T01:00:00Z", model_version: "v1", delivery_mode: "generated" },
    ]), { status: 200 })));
    render(<MultiHorizonPanel token="user-token" symbol="600519.SH" name="贵州茅台" />);
    expect(await screen.findByText("买入观察")).toBeTruthy();
    expect(screen.getByText("持有观察")).toBeTruthy();
    expect(screen.getByText("减仓观察")).toBeTruthy();
    expect(screen.getByText("已加载保存快照")).toBeTruthy();
    expect(screen.getByText("刷新三周期")).toBeTruthy();
  });
});
