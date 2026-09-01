import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HistoryPanel from "../HistoryPanel";

describe("历史行情面板", () => {
  it("切换区间时按选择重新请求并清理旧曲线", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { time: "2026-08-01T00:00:00Z", close: 10, volume: 100, net_inflow: 4 },
        { time: "2026-08-02T00:00:00Z", close: 11, volume: 120, net_inflow: 5 },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { time: "2026-06-01T00:00:00Z", close: 8, volume: 90, net_inflow: 0 },
        { time: "2026-08-02T00:00:00Z", close: 11, volume: 120, net_inflow: 0 },
      ]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<HistoryPanel token="token" symbol="600519.SH" />);
    await waitFor(() => expect(screen.getByText("近 30 个交易日")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "90日" }));
    expect(screen.getAllByText("正在同步近 90 个交易日")).toHaveLength(2);
    await waitFor(() => expect(screen.getByText("近 90 个交易日")).toBeTruthy());
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("days=90"), expect.anything());
    expect(screen.getByRole("img", { name: "600519.SH 历史收盘价与成交量曲线" })).toBeTruthy();
  });
});
