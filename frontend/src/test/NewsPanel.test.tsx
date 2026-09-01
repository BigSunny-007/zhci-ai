import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NewsPanel from "../NewsPanel";

describe("市场情报面板", () => {
  it("认证态加载期间不展示演示资讯", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    render(<NewsPanel token="token" symbol="600519.SH" />);
    expect(screen.getByText("正在同步")).toBeTruthy();
    expect(screen.getByText("正在获取可核验新闻…")).toBeTruthy();
    expect(screen.queryByText("政策预期推动大金融板块走强")).toBeNull();
  });

  it("认证态接口失败时只显示可核验空状态", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<NewsPanel token="token" symbol="600519.SH" />);
    await waitFor(() => expect(screen.getByText("同步失败 · 暂无可核验资讯")).toBeTruthy());
    expect(screen.getByText("当前没有可核验资讯，请稍后重试")).toBeTruthy();
    expect(screen.queryByText("新能源产业链早盘资金持续回流")).toBeNull();
  });
});
