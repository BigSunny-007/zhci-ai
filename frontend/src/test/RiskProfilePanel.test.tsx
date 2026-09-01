import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RiskProfilePanel from "../RiskProfilePanel";

describe("风险偏好面板", () => {
  it("未登录时禁用保存并说明用途边界", () => {
    render(<RiskProfilePanel token={null} profile={null} onProfileUpdated={() => undefined} />);
    expect(screen.getByText("登录后保存个人偏好")).toBeTruthy();
    expect(screen.getByRole("button", { name: /保存/ })).toBeDisabled();
    expect(screen.getByText(/不代表适当性评估/)).toBeTruthy();
  });
});
