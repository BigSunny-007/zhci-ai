import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AuthView from "../AuthView";

describe("认证入口", () => {
  it("默认展示登录表单并提供注册切换", () => {
    render(<AuthView onAuthenticated={() => undefined} />);
    expect(screen.getByRole("heading", { name: "让每个判断，都有依据。" })).toBeTruthy();
    expect(screen.getByLabelText("邮箱地址")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "注册账号" })).toBeTruthy();
  });
});
