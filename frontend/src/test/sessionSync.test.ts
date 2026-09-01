import { describe, expect, it, vi } from "vitest";
import { notifySessionLogout, SESSION_EVENT_KEY, subscribeToSessionEvents } from "../sessionSync";

describe("跨标签页会话同步", () => {
  it("广播退出事件时不写入任何令牌", () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    const setItem = vi.fn();
    Object.defineProperty(window, "localStorage", { configurable: true, value: { setItem } });
    notifySessionLogout();
    const payload = JSON.parse(setItem.mock.calls.at(-1)?.[1] ?? "{}");
    if (descriptor) Object.defineProperty(window, "localStorage", descriptor);
    expect(payload.type).toBe("logout");
    expect(payload).not.toHaveProperty("accessToken");
    expect(payload).not.toHaveProperty("refreshToken");
  });

  it("同一事件通过多个通道到达时只通知一次", () => {
    const onEvent = vi.fn();
    const unsubscribe = subscribeToSessionEvents(onEvent);
    const payload = JSON.stringify({ type: "logout", id: "event-1", occurredAt: Date.now() });
    window.dispatchEvent(new StorageEvent("storage", { key: SESSION_EVENT_KEY, newValue: payload }));
    window.dispatchEvent(new StorageEvent("storage", { key: SESSION_EVENT_KEY, newValue: payload }));
    window.dispatchEvent(new StorageEvent("storage", { key: SESSION_EVENT_KEY, newValue: "invalid" }));
    unsubscribe();
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "logout", id: "event-1" }));
  });
});
