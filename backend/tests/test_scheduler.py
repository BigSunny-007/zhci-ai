from datetime import UTC, datetime

from app.services.scheduler import recommendation_scheduler, recommendation_trigger


def test_recommendation_trigger_uses_shanghai_slots():
    trigger = recommendation_trigger()
    next_fire = trigger.get_next_fire_time(
        None, datetime(2026, 9, 1, 9, 59, tzinfo=UTC)
    )
    assert next_fire is not None
    assert next_fire.hour == 10
    assert next_fire.minute == 0
    assert str(next_fire.tzinfo) == "Asia/Shanghai"


def test_scheduler_is_safe_and_disabled_by_default():
    status = recommendation_scheduler.status()
    assert status["enabled"] is False
    assert status["running"] is False
    assert status["job_id"] == "hourly-recommendations"
