import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AlertsPanel from "../AlertsPanel";

describe("智能提醒面板", () => {
  it("支持立即检查并展示触发历史", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ checked_count: 1, suppressed_count: 0, failed_count: 0, checked_at: "2026-09-02T02:00:00Z", data_status: "发现 1 条触发提醒，已写入历史", triggers: [{ id: "t1", alert_id: "a1", symbol: "600519.SH", condition_type: "price_above", threshold: 1600, observed_value: 1680, message: "达到预设条件", source: "demo", evidence: {}, triggered_at: "2026-09-02T02:00:00Z" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AlertsPanel token="user-token" symbol="600519.SH" />);
    expect(await screen.findByText("还没有提醒。可针对当前自选股设置第一个条件。")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /立即检查/ }));
    expect(await screen.findByText("最近触发")).toBeTruthy();
    expect(screen.getByText("价格高于 1680 · 10:00")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
