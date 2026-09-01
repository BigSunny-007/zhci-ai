import { fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getByText("不同周期结论存在冲突，请分别复核各周期证据，不要合并为单一交易信号。")).toBeTruthy();
  });

  it("刷新时独立请求三个周期并允许部分失败", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ action: "买入观察", confidence: 0.7, rationale: "短期", symbol: "600519.SH", horizon: "1-2d", evidence: {}, generated_at: "2026-09-02T01:00:00Z", model_version: "v1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "当前不在建议槽位" }), { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ action: "持有观察", confidence: 0.6, rationale: "中期", symbol: "600519.SH", horizon: "medium", evidence: {}, generated_at: "2026-09-02T01:00:00Z", model_version: "v1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<MultiHorizonPanel token="user-token" symbol="600519.SH" name="贵州茅台" />);
    await screen.findByText("已加载保存快照");
    fireEvent.click(screen.getByRole("button", { name: "刷新三周期" }));
    expect(await screen.findByText("部分周期暂不可用 · 仅展示已返回结果")).toBeTruthy();
    expect(screen.getByText("买入观察")).toBeTruthy();
    expect(screen.getByText("持有观察")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[1][0]).toContain("horizon=1-2d");
    expect(fetchMock.mock.calls[2][0]).toContain("horizon=1-5d");
    expect(fetchMock.mock.calls[3][0]).toContain("horizon=medium");
  });
});
