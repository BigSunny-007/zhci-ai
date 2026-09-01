ALTER TABLE ai_model_policies
  ADD COLUMN IF NOT EXISTS review_round INT NOT NULL DEFAULT 0;

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
