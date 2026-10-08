from datetime import date

from app.domain import (
    COMPLETION_BEFORE_CREATED,
    COMPLETION_FUTURE,
    HIGH_INTERVAL_MESSAGE,
    INSTALL_MESSAGE,
    INTERVAL_MESSAGE,
    NOTES_MESSAGE,
    RATING_MESSAGE,
    SERIAL_MESSAGE,
    VOLTAGE_MESSAGE,
    compute_next_due,
    corrective_due,
    is_overdue,
    opens_corrective,
    validate_asset,
    validate_completion,
)

TODAY = date(2026, 10, 1)


def asset_errors(**overrides):
    payload = dict(
        serial="TRF-10002",
        name="New transformer",
        asset_type="transformer",
        substation_id=1,
        voltage_kv=132,
        criticality="medium",
        interval_days=90,
        install_date=date(2026, 9, 15),
        today=TODAY,
        serial_taken=False,
    )
    payload.update(overrides)
    return dict(validate_asset(**payload))


def test_serial_and_install_messages_match_the_brief():
    assert asset_errors(serial_taken=True)["serial"] == SERIAL_MESSAGE
    assert asset_errors(install_date=date(2026, 10, 10))["install_date"] == INSTALL_MESSAGE
    assert "install_date" not in asset_errors(install_date=date(2026, 9, 15))


def test_voltage_and_interval_examples():
    assert asset_errors(voltage_kv=500)["voltage_kv"] == VOLTAGE_MESSAGE
    for voltage in (11, 33, 66, 132, 220, 400):
        assert "voltage_kv" not in asset_errors(voltage_kv=voltage)
    for interval in (30, 90, 365, 730):
        assert "interval_days" not in asset_errors(interval_days=interval, criticality="medium")
    assert asset_errors(interval_days=29)["interval_days"] == INTERVAL_MESSAGE
    assert asset_errors(interval_days=731)["interval_days"] == INTERVAL_MESSAGE
    assert "interval_days" not in asset_errors(interval_days=180, criticality="high")
    assert asset_errors(interval_days=365, criticality="high")["interval_days"] == HIGH_INTERVAL_MESSAGE


def test_next_due_is_calculated_from_last_maintenance_or_install():
    assert compute_next_due(date(2026, 1, 1), date(2020, 1, 1), 180) == date(2026, 6, 30)
    assert compute_next_due(None, date(2026, 1, 1), 90) == date(2026, 4, 1)


def test_overdue_is_a_flag_not_a_status():
    assert is_overdue("in_progress", date(2026, 9, 25), TODAY) is True
    assert is_overdue("assigned", date(2026, 10, 5), TODAY) is False
    assert is_overdue("completed", date(2026, 9, 25), TODAY) is False
    assert is_overdue("cancelled", date(2026, 9, 25), TODAY) is False


def test_completion_dates_notes_and_poor_condition():
    created = date(2026, 9, 20)

    def errors(**overrides):
        payload = dict(
            completion_date=date(2026, 10, 1),
            notes="Preventive maintenance successfully completed",
            rating=4,
            created_on=created,
            today=TODAY,
        )
        payload.update(overrides)
        return dict(validate_completion(**payload))

    assert errors(completion_date=date(2026, 9, 28)) == {}
    assert errors(completion_date=date(2026, 9, 15))["completion_date"] == COMPLETION_BEFORE_CREATED
    assert errors(completion_date=date(2026, 10, 5))["completion_date"] == COMPLETION_FUTURE
    assert errors(notes="  ")["notes"] == NOTES_MESSAGE
    assert errors(rating=0)["condition_rating"] == RATING_MESSAGE
    assert errors(rating=6)["condition_rating"] == RATING_MESSAGE
    assert opens_corrective(1) is True
    assert opens_corrective(2) is True
    assert opens_corrective(3) is False
    assert corrective_due(date(2026, 10, 1)) == date(2026, 10, 8)
