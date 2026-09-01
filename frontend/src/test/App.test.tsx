import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";

describe("智策 AI 工作台", () => {
  it("renders the portfolio dashboard and primary stock", () => {
    render(<App />);
    expect(screen.getByText("智策 AI")).toBeTruthy();
    expect(screen.getAllByText("贵州茅台").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("AI 研判").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("演示行情 · 非实时")).toBeTruthy();
  });

  it("opens the evidence drawer from the freshness controls", () => {
    render(<App />);
    fireEvent.click(screen.getByText("查看本次建议数据依据"));
    expect(screen.getByRole("dialog", { name: "AI 建议完整依据" })).toBeTruthy();
    expect(within(screen.getByRole("dialog", { name: "AI 建议完整依据" })).getByText("演示工作区")).toBeTruthy();
  });
});
