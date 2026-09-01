import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MarketIndexPanel from "../MarketIndexPanel";

describe("大盘环境面板", () => {
  it("展示带来源与时间的大盘快照", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      symbol: "000001.SH",
      name: "上证指数",
      price: 3387.42,
      change: 21.1,
      change_percent: 0.63,
      source: "demo",
      as_of: "2026-09-02T01:00:00Z",
      data_status: "demo",
    }), { status: 200 })));
    render(<MarketIndexPanel token="user-token" />);
    expect(await screen.findByText("3,387.42")).toBeTruthy();
    expect(screen.getByText("+0.63%")).toBeTruthy();
    expect(screen.getByText("演示数据 · 非实时")).toBeTruthy();
  });
});
