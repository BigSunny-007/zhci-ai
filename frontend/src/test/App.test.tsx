import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";

describe("智策 AI 工作台", () => {
  it("renders the portfolio dashboard and primary stock", () => {
    render(<App />);
    expect(screen.getByText("智策 AI")).toBeTruthy();
    expect(screen.getAllByText("贵州茅台").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("AI 研判").length).toBeGreaterThanOrEqual(2);
  });
});
