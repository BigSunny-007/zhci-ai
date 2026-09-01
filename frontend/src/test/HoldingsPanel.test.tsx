import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HoldingsPanel from "../HoldingsPanel";

describe("持仓面板", () => {
  it("未登录时明确提示需要账号同步", () => {
    render(<HoldingsPanel token={null} />);
    expect(screen.getByText("登录后同步你的真实持仓")).toBeTruthy();
    expect(screen.getByRole("button", { name: "添加持仓" })).toBeTruthy();
  });
});
