"""Fictional operating data. Nothing here is a live substation or a real person."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Asset, Substation, Task, User
from app.security import hash_password

DEMO_PASSWORD = "Demo#2026"


class Codes:
    def __init__(self) -> None:
        self.n = {"PM": 1000, "CM": 1000}

    def take(self, prefix: str, explicit: str | None = None) -> str:
        if explicit:
            self.n[prefix] = max(self.n[prefix], int(explicit.split("-")[1]))
            return explicit
        self.n[prefix] += 1
        return f"{prefix}-{self.n[prefix]}"


def seed_if_empty(db: Session) -> None:
    existing = db.scalar(select(func.count()).select_from(User))
    if existing:
        return
    today = date.today()
    password_hash = hash_password(DEMO_PASSWORD)
    people = [
        User(email="suresh.asset@grid.example", full_name="Suresh Menon", role="asset_manager", password_hash=password_hash),
        User(email="lakshmi.planner@grid.example", full_name="Lakshmi Iyer", role="planner", password_hash=password_hash),
        User(email="ramesh.tech@grid.example", full_name="Ramesh Kumar", role="technician", password_hash=password_hash),
        User(email="divya.tech@grid.example", full_name="Divya Nair", role="technician", password_hash=password_hash),
        User(email="rao.ops@grid.example", full_name="Mr. Rao", role="operations_head", password_hash=password_hash),
    ]
    # One hash is enough for a local demo; give each row its own salt.
    for person in people:
        person.password_hash = hash_password(DEMO_PASSWORD)
    db.add_all(people)
    db.flush()
    by_email = {person.email: person for person in people}
    ramesh = by_email["ramesh.tech@grid.example"]
    divya = by_email["divya.tech@grid.example"]

    yards = [
        Substation(code="SS-A", name="Substation A", voltage_kv=132, region="Kothagudem"),
        Substation(code="SS-B", name="Substation B", voltage_kv=220, region="Warangal"),
        Substation(code="SS-C", name="Substation C", voltage_kv=33, region="Nalgonda"),
        Substation(code="SS-D", name="Substation D", voltage_kv=400, region="Hyderabad North"),
    ]
    db.add_all(yards)
    db.flush()
    yard = {item.code: item for item in yards}
    codes = Codes()

    def shift(days: int) -> date:
        return today + timedelta(days=days)

    def add_asset(
        *,
        yard_code: str,
        serial: str,
        name: str,
        asset_type: str,
        criticality: str,
        interval: int,
        due_on: date,
        status: str = "in_service",
        last_on: date | None = None,
        condition: int | None = None,
    ) -> Asset:
        install = (last_on or due_on) - timedelta(days=interval)
        if last_on is not None:
            install = min(install, last_on - timedelta(days=400))
        asset = Asset(
            serial=serial,
            name=name,
            asset_type=asset_type,
            substation_id=yard[yard_code].id,
            voltage_kv=yard[yard_code].voltage_kv,
            criticality=criticality,
            interval_days=interval,
            install_date=install,
            status=status,
            last_maintenance_on=last_on,
            next_due_on=due_on,
            latest_condition=condition,
        )
        db.add(asset)
        db.flush()
        return asset

    def add_task(
        asset: Asset,
        *,
        prefix: str = "PM",
        explicit: str | None = None,
        task_type: str = "preventive",
        status: str = "scheduled",
        priority: str | None = None,
        due_on: date | None = None,
        created_on: date | None = None,
        assignee: User | None = None,
        completed_on: date | None = None,
        notes: str | None = None,
        rating: int | None = None,
        source_id: int | None = None,
    ) -> Task:
        due = due_on or asset.next_due_on or today
        created = created_on or min(today, due - timedelta(days=5))
        task = Task(
            code=codes.take(prefix, explicit),
            asset_id=asset.id,
            task_type=task_type,
            status=status,
            priority=priority or asset.criticality,
            due_on=due,
            created_on=created,
            assigned_to_id=assignee.id if assignee else None,
            completed_on=completed_on,
            notes=notes,
            condition_rating=rating,
            source_task_id=source_id,
        )
        db.add(task)
        db.flush()
        return task

    # Substation A: exactly 5 High, 3 Medium, 1 Low open overdue tasks.
    overdue_a = [
        ("TRF-10001", "Main transformer 1", "transformer", "high", 180, -11, "in_progress", ramesh, "PM-1001", "under_maintenance"),
        ("TRF-10011", "Main transformer 2", "transformer", "high", 180, -20, "assigned", ramesh, None, "in_service"),
        ("TRF-10012", "Station transformer", "transformer", "high", 90, -18, "assigned", divya, None, "in_service"),
        ("TRF-10013", "Spare transformer", "transformer", "high", 180, -25, "scheduled", None, None, "in_service"),
        ("BRK-10014", "Feeder breaker A", "circuit_breaker", "high", 90, -8, "scheduled", None, None, "in_service"),
        ("BRK-10015", "Feeder breaker B", "circuit_breaker", "medium", 365, -15, "assigned", ramesh, None, "in_service"),
        ("SWG-10016", "Indoor switchboard", "switchgear", "medium", 365, -30, "scheduled", None, None, "in_service"),
        ("SWG-10017", "Incoming switchgear", "switchgear", "medium", 180, -12, "assigned", divya, None, "in_service"),
        ("REL-10018", "Distance relay", "protection_relay", "low", 730, -40, "scheduled", None, None, "in_service"),
    ]
    for serial, name, asset_type, criticality, interval, offset, task_status, assignee, explicit, asset_status in overdue_a:
        due = shift(offset)
        asset = add_asset(
            yard_code="SS-A",
            serial=serial,
            name=name,
            asset_type=asset_type,
            criticality=criticality,
            interval=interval,
            due_on=due,
            status=asset_status,
        )
        add_task(asset, explicit=explicit, status=task_status, due_on=due, assignee=assignee)

    def plant_history(
        *,
        yard_code: str,
        serial: str,
        name: str,
        asset_type: str,
        criticality: str,
        interval: int,
        due_on: date,
        completed_on: date,
        rating: int,
        notes: str,
        cm_overdue: bool = False,
    ) -> None:
        follow_due = completed_on + timedelta(days=interval)
        asset = add_asset(
            yard_code=yard_code,
            serial=serial,
            name=name,
            asset_type=asset_type,
            criticality=criticality,
            interval=interval,
            due_on=follow_due,
            last_on=completed_on,
            condition=rating,
        )
        done = add_task(
            asset,
            status="completed",
            due_on=due_on,
            created_on=due_on - timedelta(days=10),
            completed_on=completed_on,
            assignee=ramesh,
            notes=notes,
            rating=rating,
            priority=criticality,
        )
        add_task(asset, status="scheduled", due_on=follow_due, created_on=completed_on)
        if rating <= 2:
            cm_due = completed_on + timedelta(days=7)
            if cm_overdue:
                cm_due = min(cm_due, shift(-3))
            add_task(
                asset,
                prefix="CM",
                task_type="corrective",
                status="scheduled",
                priority="high",
                due_on=cm_due,
                created_on=completed_on,
                source_id=done.id,
            )

    plant_history(
        yard_code="SS-B",
        serial="TRF-20001",
        name="Auto transformer",
        asset_type="transformer",
        criticality="high",
        interval=180,
        due_on=shift(-40),
        completed_on=shift(-40),
        rating=1,
        notes="Oil acidity high. Buchholz gas observed. Left the unit for a corrective visit.",
        cm_overdue=True,
    )
    plant_history(
        yard_code="SS-B",
        serial="TRF-20002",
        name="Earthing transformer",
        asset_type="transformer",
        criticality="medium",
        interval=90,
        due_on=shift(-1),
        completed_on=shift(-1),
        rating=2,
        notes="Cooling fans noisy and a hot joint on the LV bushing.",
    )
    plant_history(
        yard_code="SS-B",
        serial="BRK-20003",
        name="Bus coupler",
        asset_type="circuit_breaker",
        criticality="low",
        interval=365,
        due_on=shift(-2) if today.day > 2 else today,
        completed_on=shift(-2) if today.day > 2 else today,
        rating=5,
        notes="Mechanism times within the sheet. Contact resistance even across poles.",
    )
    plant_history(
        yard_code="SS-B",
        serial="SWG-20004",
        name="Capacitor bank",
        asset_type="switchgear",
        criticality="medium",
        interval=180,
        due_on=today,
        completed_on=today,
        rating=3,
        notes="One cell warmer than the others. Still in service. Recheck next visit.",
    )

    # Missed preventive task that has come due this month (or today, on the 1st).
    month_start = today.replace(day=1)
    missed_due = month_start if month_start < today else today
    missed = add_asset(
        yard_code="SS-B",
        serial="REL-20005",
        name="Busbar protection",
        asset_type="protection_relay",
        criticality="medium",
        interval=90,
        due_on=missed_due,
    )
    add_task(missed, status="scheduled", due_on=missed_due, created_on=missed_due - timedelta(days=12))

    # On-time completions whose due date has arrived this month.
    arrived = []
    cursor = month_start
    while cursor <= today:
        arrived.append(cursor)
        cursor += timedelta(days=1)
    picked = arrived[:4] if len(arrived) >= 4 else list(arrived)
    while len(picked) < 4:
        picked.append(today)
    on_time_specs = [
        ("TRF-40001", "Interconnecting transformer", "transformer"),
        ("BRK-40002", "Line breaker 1", "circuit_breaker"),
        ("SWG-40003", "GIS bay 2", "switchgear"),
        ("REL-40004", "Overcurrent relay", "protection_relay"),
    ]
    for (serial, name, asset_type), due_on in zip(on_time_specs, picked):
        plant_history(
            yard_code="SS-D",
            serial=serial,
            name=name,
            asset_type=asset_type,
            criticality="medium",
            interval=90,
            due_on=due_on,
            completed_on=due_on,
            rating=4,
            notes="Preventive maintenance completed on the due date.",
        )

    if today.day >= 2:
        late_due = month_start
        late_done = late_due + timedelta(days=1)
        plant_history(
            yard_code="SS-D",
            serial="BRK-40005",
            name="Line breaker 2",
            asset_type="circuit_breaker",
            criticality="medium",
            interval=90,
            due_on=late_due,
            completed_on=late_done,
            rating=4,
            notes="Visit slipped a day because the outage window moved.",
        )

    workload = [
        ("SS-C", "TRF-30001", "Rural transformer", "transformer", "high", 180, 10, ramesh),
        ("SS-C", "TRF-30002", "Town transformer", "transformer", "medium", 365, 40, ramesh),
        ("SS-C", "BRK-30003", "Town feeder", "circuit_breaker", "low", 730, 75, ramesh),
        ("SS-D", "TRF-30004", "400 kV transformer", "transformer", "high", 90, 6, divya),
        ("SS-D", "SWG-30005", "Reactor bay", "switchgear", "medium", 365, 50, divya),
        ("SS-D", "REL-30006", "Bus differential", "protection_relay", "low", 730, 12, None),
    ]
    for yard_code, serial, name, asset_type, criticality, interval, offset, assignee in workload:
        due = shift(offset)
        asset = add_asset(
            yard_code=yard_code,
            serial=serial,
            name=name,
            asset_type=asset_type,
            criticality=criticality,
            interval=interval,
            due_on=due,
        )
        add_task(
            asset,
            status="assigned" if assignee else "scheduled",
            due_on=due,
            assignee=assignee,
            created_on=today,
        )

    retired = add_asset(
        yard_code="SS-D",
        serial="TRF-90001",
        name="Retired transformer",
        asset_type="transformer",
        criticality="low",
        interval=365,
        due_on=shift(-100),
        status="decommissioned",
    )
    add_task(retired, status="cancelled", due_on=shift(-100), notes="Cancelled when the asset left service.")

    db.commit()
