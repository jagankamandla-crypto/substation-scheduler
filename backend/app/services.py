from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.domain import (
    OPEN_TASK_STATUSES,
    AccessDenied,
    NotFound,
    RuleError,
    compute_next_due,
    corrective_due,
    opens_corrective,
    validate_asset,
    validate_completion,
)
from app.models import Asset, Substation, Task, User
from app.schemas import AssetIn


def _today(today: date | None) -> date:
    return today or date.today()


def next_code(db: Session, prefix: str) -> str:
    codes = list(db.scalars(select(Task.code).where(Task.code.like(f"{prefix}-%"))).all())
    highest = 1000
    for code in codes:
        part = code.split("-", 1)[-1]
        if part.isdigit():
            highest = max(highest, int(part))
    return f"{prefix}-{highest + 1}"


def _serial_taken(db: Session, serial: str, ignore_id: int | None = None) -> bool:
    stmt = select(Asset.id).where(func.lower(Asset.serial) == serial.lower())
    if ignore_id is not None:
        stmt = stmt.where(Asset.id != ignore_id)
    return db.scalar(stmt) is not None


def _load_task(db: Session, task_id: int) -> Task:
    task = db.scalar(
        select(Task)
        .options(joinedload(Task.asset).joinedload(Asset.substation), joinedload(Task.assignee))
        .where(Task.id == task_id)
    )
    if task is None:
        raise NotFound("Task not found.")
    return task


def _after_write(db: Session) -> None:
    db.commit()
    # The session keeps already-loaded relationships. Expire them so the
    # reload below sees the technician, due date, and status just written.
    db.expire_all()


def _load_asset(db: Session, asset_id: int) -> Asset:
    asset = db.scalar(select(Asset).options(joinedload(Asset.substation)).where(Asset.id == asset_id))
    if asset is None:
        raise NotFound("Asset not found.")
    return asset


def assert_assignee(user: User, task: Task) -> None:
    if user.role == "technician" and task.assigned_to_id == user.id:
        return
    if user.role == "technician":
        raise AccessDenied("You can update only tasks assigned to you.")
    raise AccessDenied()


def create_asset(db: Session, data: AssetIn, today: date | None = None) -> Asset:
    today = _today(today)
    serial = data.serial.strip()
    if db.get(Substation, data.substation_id) is None:
        raise RuleError([("substation_id", "Choose a substation.")])
    errors = validate_asset(
        serial=serial,
        name=data.name,
        asset_type=data.asset_type,
        substation_id=data.substation_id,
        voltage_kv=data.voltage_kv,
        criticality=data.criticality,
        interval_days=data.interval_days,
        install_date=data.install_date,
        today=today,
        serial_taken=_serial_taken(db, serial),
    )
    if errors:
        raise RuleError(errors)
    due = compute_next_due(None, data.install_date, data.interval_days)
    asset = Asset(
        serial=serial,
        name=data.name.strip(),
        asset_type=data.asset_type,
        substation_id=data.substation_id,
        voltage_kv=data.voltage_kv,
        criticality=data.criticality,
        interval_days=data.interval_days,
        install_date=data.install_date,
        status="in_service",
        last_maintenance_on=None,
        next_due_on=due,
        latest_condition=None,
    )
    db.add(asset)
    db.flush()
    db.add(
        Task(
            code=next_code(db, "PM"),
            asset_id=asset.id,
            task_type="preventive",
            status="scheduled",
            priority=data.criticality,
            due_on=due,
            created_on=today,
        )
    )
    asset_id = asset.id
    _after_write(db)
    return _load_asset(db, asset_id)


def update_asset(db: Session, asset_id: int, data: AssetIn, today: date | None = None) -> Asset:
    today = _today(today)
    asset = _load_asset(db, asset_id)
    if asset.status == "decommissioned":
        raise RuleError([("status", "Decommissioned assets cannot be edited.")])
    serial = data.serial.strip()
    if db.get(Substation, data.substation_id) is None:
        raise RuleError([("substation_id", "Choose a substation.")])
    errors = validate_asset(
        serial=serial,
        name=data.name,
        asset_type=data.asset_type,
        substation_id=data.substation_id,
        voltage_kv=data.voltage_kv,
        criticality=data.criticality,
        interval_days=data.interval_days,
        install_date=data.install_date,
        today=today,
        serial_taken=_serial_taken(db, serial, ignore_id=asset.id),
    )
    if errors:
        raise RuleError(errors)
    asset.serial = serial
    asset.name = data.name.strip()
    asset.asset_type = data.asset_type
    asset.substation_id = data.substation_id
    asset.voltage_kv = data.voltage_kv
    asset.criticality = data.criticality
    asset.interval_days = data.interval_days
    asset.install_date = data.install_date
    asset.next_due_on = compute_next_due(asset.last_maintenance_on, asset.install_date, asset.interval_days)
    open_pms = db.scalars(
        select(Task).where(
            Task.asset_id == asset.id,
            Task.task_type == "preventive",
            Task.status.in_(OPEN_TASK_STATUSES),
        )
    ).all()
    for task in open_pms:
        task.due_on = asset.next_due_on
        task.priority = asset.criticality
    asset_id = asset.id
    _after_write(db)
    return _load_asset(db, asset_id)


def decommission_asset(db: Session, asset_id: int) -> Asset:
    asset = _load_asset(db, asset_id)
    if asset.status == "decommissioned":
        raise RuleError([("status", "This asset is already decommissioned.")])
    asset.status = "decommissioned"
    open_tasks = db.scalars(
        select(Task).where(Task.asset_id == asset.id, Task.status.in_(OPEN_TASK_STATUSES))
    ).all()
    for task in open_tasks:
        task.status = "cancelled"
    asset_id = asset.id
    _after_write(db)
    return _load_asset(db, asset_id)


def assign_task(db: Session, task_id: int, technician_id: int) -> Task:
    task = _load_task(db, task_id)
    if task.status not in ("scheduled", "assigned"):
        raise RuleError([("status", "Only scheduled or assigned tasks can be assigned.")])
    if task.asset.status == "decommissioned":
        raise RuleError([("asset", "Decommissioned assets cannot take new assignments.")])
    technician = db.get(User, technician_id)
    if technician is None or technician.role != "technician":
        raise RuleError([("technician_id", "Choose a technician.")])
    due_before = task.due_on
    task.assigned_to_id = technician.id
    task.assignee = technician
    task.status = "assigned"
    if task.due_on != due_before:
        raise RuntimeError("Assignment must not change the calculated due date.")
    task_id = task.id
    _after_write(db)
    return _load_task(db, task_id)


def start_task(db: Session, task_id: int, user: User) -> Task:
    task = _load_task(db, task_id)
    assert_assignee(user, task)
    if task.status != "assigned":
        raise RuleError([("status", "Start work from an assigned task.")])
    if task.asset.status == "decommissioned":
        raise RuleError([("asset", "Decommissioned assets cannot take new assignments.")])
    task.status = "in_progress"
    if task.asset.status == "in_service":
        task.asset.status = "under_maintenance"
    task_id = task.id
    _after_write(db)
    return _load_task(db, task_id)


@dataclass
class CompleteOutcome:
    task: Task
    next_preventive: Task | None
    corrective: Task | None


def complete_task(
    db: Session,
    task_id: int,
    user: User,
    completion_date: date,
    notes: str,
    rating: int,
    today: date | None = None,
) -> CompleteOutcome:
    today = _today(today)
    task = _load_task(db, task_id)
    assert_assignee(user, task)
    if task.status != "in_progress":
        raise RuleError([("status", "Mark the task in progress before completing it.")])
    if task.asset.status == "decommissioned":
        raise RuleError([("asset", "Decommissioned assets cannot take new assignments.")])
    errors = validate_completion(
        completion_date=completion_date,
        notes=notes,
        rating=rating,
        created_on=task.created_on,
        today=today,
    )
    if errors:
        raise RuleError(errors)

    asset = task.asset
    task.status = "completed"
    task.completed_on = completion_date
    task.notes = notes.strip()
    task.condition_rating = rating
    asset.latest_condition = rating

    still_open = db.scalar(
        select(func.count())
        .select_from(Task)
        .where(Task.asset_id == asset.id, Task.status == "in_progress", Task.id != task.id)
    )
    if not still_open and asset.status == "under_maintenance":
        asset.status = "in_service"

    corrective = None
    nxt = None
    if task.task_type == "preventive":
        asset.last_maintenance_on = completion_date
        new_due = compute_next_due(completion_date, asset.install_date, asset.interval_days)
        asset.next_due_on = new_due
        nxt = Task(
            code=next_code(db, "PM"),
            asset_id=asset.id,
            task_type="preventive",
            status="scheduled",
            priority=asset.criticality,
            due_on=new_due,
            created_on=today,
            source_task_id=task.id,
        )
        db.add(nxt)
        db.flush()
    if opens_corrective(rating):
        corrective = Task(
            code=next_code(db, "CM"),
            asset_id=asset.id,
            task_type="corrective",
            status="scheduled",
            priority="high",
            due_on=corrective_due(completion_date),
            created_on=today,
            source_task_id=task.id,
        )
        db.add(corrective)
        db.flush()
    task_id = task.id
    next_id = nxt.id if nxt is not None else None
    corrective_id = corrective.id if corrective is not None else None
    _after_write(db)
    return CompleteOutcome(
        task=_load_task(db, task_id),
        next_preventive=_load_task(db, next_id) if next_id is not None else None,
        corrective=_load_task(db, corrective_id) if corrective_id is not None else None,
    )
