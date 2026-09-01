export const SESSION_EVENT_KEY = "zhice.session.event";

const CHANNEL_NAME = "zhice-session-events";

export type SessionEvent = {
  type: "logout";
  id: string;
  occurredAt: number;
};

function parseSessionEvent(value: unknown): SessionEvent | null {
  if (typeof value === "string") {
    try {
      return parseSessionEvent(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<SessionEvent>;
  if (candidate.type !== "logout" || typeof candidate.id !== "string" || typeof candidate.occurredAt !== "number") return null;
  return candidate as SessionEvent;
}

function eventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function notifySessionLogout(): void {
  const event: SessionEvent = { type: "logout", id: eventId(), occurredAt: Date.now() };
  try {
    window.localStorage.setItem(SESSION_EVENT_KEY, JSON.stringify(event));
  } catch {}
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage(event);
      channel.close();
    }
  } catch {}
}

export function subscribeToSessionEvents(onEvent: (event: SessionEvent) => void): () => void {
  const seenIds = new Set<string>();
  const deliver = (value: unknown) => {
    const event = parseSessionEvent(value);
    if (!event || seenIds.has(event.id)) return;
    seenIds.add(event.id);
    onEvent(event);
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === SESSION_EVENT_KEY) deliver(event.newValue);
  };
  window.addEventListener("storage", handleStorage);
  let channel: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.addEventListener("message", (event: MessageEvent) => deliver(event.data));
    }
  } catch { channel = null; }
  return () => {
    window.removeEventListener("storage", handleStorage);
    channel?.close();
  };
}
