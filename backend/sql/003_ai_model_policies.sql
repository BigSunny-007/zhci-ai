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
