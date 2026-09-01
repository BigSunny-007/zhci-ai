CREATE TABLE IF NOT EXISTS alert_triggers (
  id CHAR(36) NOT NULL PRIMARY KEY,
  alert_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  symbol VARCHAR(24) NOT NULL,
  condition_type VARCHAR(32) NOT NULL,
  threshold DECIMAL(18,4) NOT NULL,
  observed_value DECIMAL(24,6) NOT NULL,
  message VARCHAR(240) NOT NULL,
  source VARCHAR(40) NOT NULL,
  evidence JSON NOT NULL,
  triggered_at DATETIME(6) NOT NULL,
  KEY ix_alert_triggers_alert (alert_id),
  KEY ix_alert_triggers_user (user_id),
  KEY ix_alert_triggers_triggered_at (triggered_at),
  CONSTRAINT fk_alert_triggers_alert FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE,
  CONSTRAINT fk_alert_triggers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
