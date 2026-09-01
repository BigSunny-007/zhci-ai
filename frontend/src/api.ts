export type UserProfile = {
  id: string;
  email: string;
  display_name: string;
  risk_profile: string;
  target_return_rate?: number | null;
  investment_horizon?: string | null;
  is_admin: boolean;
  email_verified: boolean;
};

export type MarketQuote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_percent: number;
  volume: number;
  net_inflow: number;
  source: string;
  as_of: string;
};

export type Recommendation = {
  symbol: string;
  horizon: string;
  action: string;
  confidence: number;
  rationale: string;
  evidence: Record<string, unknown>;
  generated_at: string;
  model_version: string;
  is_stale?: boolean;
  delivery_mode?: "generated" | "cached";
};

export type RecommendationHistoryItem = Recommendation & {
  id: string;
  evaluated_at?: string | null;
  realized_return?: number | null;
};

export type AnalyticsOverview = {
  period: string;
  portfolio_return: number;
  benchmark_return: number;
  excess_return: number;
  max_drawdown: number;
  win_rate: number;
  profit_loss_ratio: number;
  recommendation_accuracy: number;
  data_status: string;
  series: Array<{ date: string; portfolio: number; benchmark: number }>;
};

export type AdminOverview = {
  generated_at: string;
  total_users: number;
  active_users: number;
  verified_users: number;
  users_with_holdings: number;
  holdings_cost_basis: number;
  recommendations_count: number;
  evaluated_recommendations: number;
  login_events_24h: number;
  market_net_inflow_24h: number;
  data_scope: string;
  data_status: string;
};

export type ModelPolicy = {
  id: string;
  version: string;
  status: "draft" | "pending_review" | "active" | "retired";
  weights: { fund_flow: number; momentum: number; news_authority_adjusted: number };
  rationale: string;
  review_round: number;
  approval_count: number;
  created_at: string;
  updated_at: string;
};

export type AuditIntegrityReport = {
  checked_events: number;
  valid_events: number;
  invalid_events: number;
  unverifiable_events: number;
  checked_at: string;
  data_scope: string;
};

export type WatchlistItem = {
  id: string;
  symbol: string;
  name: string;
};

export type HoldingItem = {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  cost_price: number;
  target_return?: number | null;
  max_loss?: number | null;
};

export type MarketSession = {
  as_of: string;
  timezone: string;
  is_trading_day: boolean;
  session: "closed" | "morning" | "afternoon" | "pre_open" | string;
  can_generate_recommendation: boolean;
  next_recommendation_at: string | null;
};

export type NewsItem = {
  id: number;
  symbol: string | null;
  title: string;
  summary: string;
  source_name: string;
  source_url: string;
  published_at: string;
  authority_score: number;
  sentiment_score: number;
};

export type TokenSession = {
  accessToken: string;
  refreshToken: string;
  emailVerified: boolean;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000/api/v1";
const SESSION_KEY = "zhice.session";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const body = (await response.json().catch(() => ({}))) as { detail?: string };
  if (!response.ok) {
    throw new ApiError(response.status, body.detail ?? "请求失败，请稍后重试");
  }
  return body as T;
}

type BackendTokenResponse = {
  access_token: string;
  refresh_token: string;
  email_verified: boolean;
};

function mapTokenSession(result: BackendTokenResponse): TokenSession {
  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    emailVerified: result.email_verified,
  };
}

export function loadSession(): TokenSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as TokenSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: TokenSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function login(email: string, password: string): Promise<TokenSession> {
  return request<BackendTokenResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }).then(mapTokenSession);
}

export function register(
  email: string,
  password: string,
  displayName: string,
): Promise<TokenSession & { verificationRequired: boolean; verificationToken?: string }> {
  return request<{
    access_token: string;
    refresh_token: string;
    email_verified: boolean;
    verification_required: boolean;
    verification_token?: string;
  }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, display_name: displayName }),
  }).then((result) => ({
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    emailVerified: result.email_verified,
    verificationRequired: result.verification_required,
    verificationToken: result.verification_token,
  }));
}

export function getMe(token: string): Promise<UserProfile> {
  return request<UserProfile>("/auth/me", {}, token);
}

export function updateProfile(
  token: string,
  changes: { risk_profile?: string; target_return_rate?: number | null; investment_horizon?: string },
): Promise<UserProfile> {
  return request<UserProfile>("/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(changes),
  }, token);
}

export function logout(token: string): Promise<void> {
  return request<void>("/auth/logout", { method: "POST" }, token).then(() => undefined);
}

export function refreshSession(refreshToken: string): Promise<TokenSession> {
  return request<BackendTokenResponse>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  }).then(mapTokenSession);
}

export function getQuote(token: string, symbol: string, name: string): Promise<MarketQuote> {
  const params = new URLSearchParams({ symbol, name });
  return request<MarketQuote>(`/market/quote?${params.toString()}`, {}, token);
}

export function getMarketSession(): Promise<MarketSession> {
  return request<MarketSession>("/market/session");
}

export function getNews(token: string, symbol?: string): Promise<NewsItem[]> {
  const query = symbol ? `?${new URLSearchParams({ symbol }).toString()}` : "";
  return request<NewsItem[]>(`/market/news${query}`, {}, token);
}

export function getRecommendation(
  token: string,
  symbol: string,
  name: string,
  horizon = "1-5d",
): Promise<Recommendation> {
  const params = new URLSearchParams({ symbol, name, horizon });
  return request<Recommendation>(`/market/recommendation?${params.toString()}`, {}, token);
}

export function getRecommendations(token: string, limit = 12): Promise<RecommendationHistoryItem[]> {
  return request<RecommendationHistoryItem[]>(`/market/recommendations?limit=${limit}`, {}, token);
}

export function getAnalyticsOverview(token: string): Promise<AnalyticsOverview> {
  return request<AnalyticsOverview>("/analytics/overview", {}, token);
}

export function getAdminOverview(token: string): Promise<AdminOverview> {
  return request<AdminOverview>("/admin/overview", {}, token);
}

export function getModelPolicies(token: string): Promise<ModelPolicy[]> {
  return request<ModelPolicy[]>("/admin/model-policies", {}, token);
}

export function getAuditIntegrity(token: string): Promise<AuditIntegrityReport> {
  return request<AuditIntegrityReport>("/admin/audit-integrity", {}, token);
}

export function getWatchlist(token: string): Promise<WatchlistItem[]> {
  return request<WatchlistItem[]>("/portfolio/watchlist", {}, token);
}

export function addWatchlist(
  token: string,
  symbol: string,
  name: string,
): Promise<WatchlistItem> {
  return request<WatchlistItem>("/portfolio/watchlist", {
    method: "POST",
    body: JSON.stringify({ symbol, name }),
  }, token);
}

export function removeWatchlist(token: string, symbol: string): Promise<void> {
  return request<void>(`/portfolio/watchlist/${encodeURIComponent(symbol)}`, { method: "DELETE" }, token).then(() => undefined);
}

export function getHoldings(token: string): Promise<HoldingItem[]> {
  return request<HoldingItem[]>("/portfolio/holdings", {}, token);
}

export function addHolding(
  token: string,
  holding: Omit<HoldingItem, "id">,
): Promise<HoldingItem> {
  return request<HoldingItem>("/portfolio/holdings", {
    method: "POST",
    body: JSON.stringify(holding),
  }, token);
}

export function updateHolding(
  token: string,
  symbol: string,
  changes: Partial<Omit<HoldingItem, "id" | "symbol">>,
): Promise<HoldingItem> {
  return request<HoldingItem>(`/portfolio/holdings/${encodeURIComponent(symbol)}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  }, token);
}

export function removeHolding(token: string, symbol: string): Promise<void> {
  return request<void>(`/portfolio/holdings/${encodeURIComponent(symbol)}`, { method: "DELETE" }, token).then(() => undefined);
}
