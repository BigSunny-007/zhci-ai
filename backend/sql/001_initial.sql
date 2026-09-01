CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(80) NOT NULL DEFAULT '投资者',
  risk_profile VARCHAR(24) NOT NULL DEFAULT 'balanced',
  target_return_rate DECIMAL(8,4) NULL,
  investment_horizon VARCHAR(16) NOT NULL DEFAULT '1-5d',
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_token_hash CHAR(64) NULL,
  verification_expires_at TIMESTAMP NULL,
  session_version INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS holdings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  symbol VARCHAR(24) NOT NULL,
  name VARCHAR(80) NOT NULL,
  quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  cost_price DECIMAL(18,4) NOT NULL DEFAULT 0,
  target_return DECIMAL(8,4) NULL,
  max_loss DECIMAL(8,4) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_holdings_user_symbol (user_id, symbol),
  KEY ix_holdings_symbol (symbol),
  CONSTRAINT fk_holdings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS watchlist_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  symbol VARCHAR(24) NOT NULL,
  name VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_watchlist_user_symbol (user_id, symbol),
  CONSTRAINT fk_watchlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS market_bars (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(24) NOT NULL,
  market VARCHAR(16) NOT NULL DEFAULT 'CN',
  bar_time DATETIME(6) NOT NULL,
  interval_name VARCHAR(8) NOT NULL DEFAULT '1d',
  open_price DECIMAL(18,4) NOT NULL,
  high_price DECIMAL(18,4) NOT NULL,
  low_price DECIMAL(18,4) NOT NULL,
  close_price DECIMAL(18,4) NOT NULL,
  volume DECIMAL(24,4) NOT NULL DEFAULT 0,
  net_inflow DECIMAL(24,4) NOT NULL DEFAULT 0,
  source VARCHAR(40) NOT NULL DEFAULT 'demo',
  UNIQUE KEY uq_market_bar (symbol, bar_time, interval_name),
  KEY ix_market_bars_symbol_time (symbol, bar_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS news_items (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(24) NULL,
  title VARCHAR(500) NOT NULL,
  summary TEXT NOT NULL,
  source_name VARCHAR(120) NOT NULL,
  source_url VARCHAR(1000) NOT NULL,
  published_at DATETIME(6) NOT NULL,
  authority_score DECIMAL(5,4) NOT NULL DEFAULT 0.5,
  sentiment_score DECIMAL(5,4) NOT NULL DEFAULT 0,
  KEY ix_news_symbol_time (symbol, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  symbol VARCHAR(24) NOT NULL,
  horizon VARCHAR(16) NOT NULL,
  action VARCHAR(24) NOT NULL,
  confidence DECIMAL(5,4) NOT NULL,
  suggested_position DECIMAL(5,4) NOT NULL DEFAULT 0,
  rationale TEXT NOT NULL,
  evidence JSON NOT NULL,
  model_version VARCHAR(64) NOT NULL DEFAULT 'rule-based-v1',
  generated_at DATETIME(6) NOT NULL,
  evaluated_at DATETIME(6) NULL,
  realized_return DECIMAL(10,6) NULL,
  KEY ix_recommendations_user_time (user_id, generated_at),
  KEY ix_recommendations_symbol_time (symbol, generated_at),
  CONSTRAINT fk_recommendations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ai_model_policies (
  id CHAR(36) NOT NULL PRIMARY KEY,
  version VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  weights JSON NOT NULL,
  rules JSON NOT NULL,
  rationale TEXT NOT NULL,
  created_by CHAR(36) NOT NULL,
  review_round INT NOT NULL DEFAULT 0,
  submitted_at DATETIME(6) NULL,
  approved_by CHAR(36) NULL,
  approved_at DATETIME(6) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_ai_model_policies_status (status),
  CONSTRAINT fk_ai_model_policies_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_ai_model_policies_approved_by FOREIGN KEY (approved_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ai_model_policy_approvals (
  id CHAR(36) NOT NULL PRIMARY KEY,
  policy_id CHAR(36) NOT NULL,
  approver_user_id CHAR(36) NOT NULL,
  review_round INT NOT NULL,
  decision VARCHAR(16) NOT NULL,
  comment VARCHAR(1000) NOT NULL DEFAULT '',
  created_at DATETIME(6) NOT NULL,
  UNIQUE KEY uq_policy_approval_reviewer_round (policy_id, review_round, approver_user_id),
  KEY ix_policy_approvals_policy_round (policy_id, review_round),
  CONSTRAINT fk_policy_approvals_policy FOREIGN KEY (policy_id) REFERENCES ai_model_policies(id) ON DELETE CASCADE,
  CONSTRAINT fk_policy_approvals_user FOREIGN KEY (approver_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_id CHAR(36) NULL,
  actor_user_id CHAR(36) NULL,
  action VARCHAR(120) NOT NULL,
  resource_type VARCHAR(80) NOT NULL,
  resource_id VARCHAR(80) NULL,
  metadata_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  integrity_hash CHAR(64) NULL,
  KEY ix_audit_event_id (event_id),
  KEY ix_audit_created_at (created_at),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS alerts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  symbol VARCHAR(24) NOT NULL,
  condition_type VARCHAR(32) NOT NULL,
  threshold DECIMAL(18,4) NOT NULL,
  frequency VARCHAR(16) NOT NULL DEFAULT 'once',
  expires_at DATETIME(6) NULL,
  message VARCHAR(240) NOT NULL DEFAULT '智策提醒',
  channel VARCHAR(16) NOT NULL DEFAULT 'in_app',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_alert_rule (user_id, symbol, condition_type),
  CONSTRAINT fk_alerts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
