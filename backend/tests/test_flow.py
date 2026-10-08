from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.domain import HIGH_INTERVAL_MESSAGE, SERIAL_MESSAGE, RuleError
from app.models import Asset, Substation, Task, User
from app.schemas import AssetIn
from app.services import assign_task, complete_task, create_asset, start_task


def _sub(db) -> Substation:
    return db.scalar(select(Substation).where(Substation.code == "SS-A"))


def _ramesh(db) -> User:
    return db.scalar(select(User).where(User.email == "ramesh.tech@grid.example"))


def _prepare(db, serial: str, interval: int = 180, criticality: str = "high") -> Task:
    asset = create_asset(
        db,
        AssetIn(
            serial=serial,
            name="Flow transformer",
            asset_type="transformer",
            substation_id=_sub(db).id,
            voltage_kv=132,
            criticality=criticality,
            interval_days=interval,
            install_date=date(2025, 6, 1),
        ),
        today=date(2026, 10, 1),
    )
    task = db.scalar(select(Task).where(Task.asset_id == asset.id, Task.task_type == "preventive"))
    task.created_on = date(2026, 9, 20)
    db.commit()
    assign_task(db, task.id, _ramesh(db).id)
    return start_task(db, task.id, _ramesh(db))


def test_create_rejects_duplicate_serial_and_high_interval(db):
    sub_id = _sub(db).id
    with pytest.raises(RuleError) as duplicate:
        create_asset(
            db,
            AssetIn(
                serial="TRF-10001",
                name="Duplicate",
                asset_type="transformer",
                substation_id=sub_id,
                voltage_kv=132,
                criticality="medium",
                interval_days=90,
                install_date=date(2026, 9, 15),
            ),
        )
    assert duplicate.value.errors[0] == ("serial", SERIAL_MESSAGE)

    with pytest.raises(RuleError) as high:
        create_asset(
            db,
            AssetIn(
                serial="TRF-10002",
                name="Too long",
                asset_type="transformer",
                substation_id=sub_id,
                voltage_kv=132,
                criticality="high",
                interval_days=365,
                install_date=date(2026, 9, 15),
            ),
        )
    assert high.value.errors[0] == ("interval_days", HIGH_INTERVAL_MESSAGE)


def test_install_date_drives_the_first_due_date(db):
    asset = create_asset(
        db,
        AssetIn(
            serial="TRF-10002",
            name="New transformer",
            asset_type="transformer",
            substation_id=_sub(db).id,
            voltage_kv=132,
            criticality="medium",
            interval_days=90,
            install_date=date(2026, 1, 1),
        ),
        today=date(2026, 10, 1),
    )
    assert asset.next_due_on == date(2026, 4, 1)
    task = db.scalar(select(Task).where(Task.asset_id == asset.id))
    assert task.due_on == date(2026, 4, 1)
    assert task.status == "scheduled"


def test_completing_pm_creates_the_next_pm_and_a_poor_rating_opens_cm(db):
    task = _prepare(db, "TRF-50001")
    today = date(2026, 10, 1)
    outcome = complete_task(
        db,
        task.id,
        _ramesh(db),
        date(2026, 10, 1),
        "Preventive maintenance successfully completed",
        2,
        today=today,
    )
    assert outcome.task.status == "completed"
    assert outcome.next_preventive is not None
    assert outcome.next_preventive.task_type == "preventive"
    assert outcome.next_preventive.due_on == date(2026, 10, 1) + timedelta(days=180)
    assert outcome.next_preventive.status == "scheduled"
    assert outcome.corrective is not None
    assert outcome.corrective.task_type == "corrective"
    assert outcome.corrective.priority == "high"
    assert outcome.corrective.due_on == date(2026, 10, 8)
    asset = db.get(Asset, task.asset_id)
    assert asset.last_maintenance_on == date(2026, 10, 1)
    assert asset.next_due_on == outcome.next_preventive.due_on
    assert asset.latest_condition == 2


def test_rating_three_does_not_open_corrective_work(db):
    task = _prepare(db, "TRF-50002", interval=90, criticality="medium")
    outcome = complete_task(
        db,
        task.id,
        _ramesh(db),
        date(2026, 9, 28),
        "Preventive maintenance successfully completed",
        3,
        today=date(2026, 10, 1),
    )
    assert outcome.corrective is None
    assert outcome.next_preventive is not None
    assert outcome.next_preventive.due_on == date(2026, 9, 28) + timedelta(days=90)


def test_other_technician_cannot_complete(db):
    task = _prepare(db, "TRF-50003")
    divya = db.scalar(select(User).where(User.email == "divya.tech@grid.example"))
    from app.domain import AccessDenied

    with pytest.raises(AccessDenied):
        complete_task(
            db,
            task.id,
            divya,
            date(2026, 10, 1),
            "Preventive maintenance successfully completed",
            4,
            today=date(2026, 10, 1),
        )
