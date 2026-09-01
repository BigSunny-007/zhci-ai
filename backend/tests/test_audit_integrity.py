from datetime import UTC, datetime
from uuid import uuid4

from app.models import AuditLog, calculate_audit_integrity_hash


def test_audit_integrity_hash_changes_when_event_changes():
    event = AuditLog(
        id=7,
        event_id=uuid4(),
        actor_user_id=uuid4(),
        action="model_policy.approve",
        resource_type="ai_model_policy",
        resource_id=str(uuid4()),
        metadata_json={"to": "active", "approval_count": 2},
        created_at=datetime.now(UTC),
    )
    original = calculate_audit_integrity_hash(event, "test-secret")
    event.metadata_json = {"to": "retired", "approval_count": 2}
    assert original != calculate_audit_integrity_hash(event, "test-secret")
