from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain import (
    ASSET_STATUS_LABELS,
    ASSET_TYPE_LABELS,
    CM_OPEN_QUESTION,
    COMPLIANCE_FORMULA,
    CONDITION_LABELS,
    CRITICALITY_LABELS,
    HOME,
    ROLE_LABELS,
    TASK_STATUS_LABELS,
    TASK_TYPE_LABELS,
    is_overdue,
)
from app.models import Asset, Task, User


def iso(value: date | None) -> str | None:
    return value.isoformat() if value else None


def present_user(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "role_label": ROLE_LABELS.get(user.role, user.role),
        "home": HOME.get(user.role, "/"),
    }


def present_substation(sub) -> dict:
    return {
        "id": sub.id,
        "code": sub.code,
        "name": sub.name,
        "voltage_kv": sub.voltage_kv,
        "region": sub.region,
    }


def present_task(task: Task, today: date) -> dict:
    asset = task.asset
    sub = asset.substation
    overdue = is_overdue(task.status, task.due_on, today)
    return {
        "id": task.id,
        "code": task.code,
        "task_type": task.task_type,
        "task_type_label": TASK_TYPE_LABELS.get(task.task_type, task.task_type),
        "status": task.status,
        "status_label": TASK_STATUS_LABELS.get(task.status, task.status),
        "priority": task.priority,
        "priority_label": CRITICALITY_LABELS.get(task.priority, task.priority),
        "due_on": iso(task.due_on),
        "created_on": iso(task.created_on),
        "completed_on": iso(task.completed_on),
        "notes": task.notes,
        "condition_rating": task.condition_rating,
        "condition_label": CONDITION_LABELS.get(task.condition_rating) if task.condition_rating else None,
        "overdue": overdue,
        "days_overdue": (today - task.due_on).days if overdue else 0,
        "asset_id": asset.id,
        "asset_serial": asset.serial,
        "asset_name": asset.name,
        "asset_type_label": ASSET_TYPE_LABELS.get(asset.asset_type, asset.asset_type),
        "criticality": asset.criticality,
        "criticality_label": CRITICALITY_LABELS.get(asset.criticality, asset.criticality),
        "voltage_kv": asset.voltage_kv,
        "asset_status": asset.status,
        "asset_status_label": ASSET_STATUS_LABELS.get(asset.status, asset.status),
        "substation_id": sub.id,
        "substation_code": sub.code,
        "substation_name": sub.name,
        "assignee_id": task.assigned_to_id,
        "assignee_name": task.assignee.full_name if task.assignee else None,
        "source_task_id": task.source_task_id,
        "spawned_reason": (
            "Opened because the condition rating was 1 or 2. "
            + CM_OPEN_QUESTION
            if task.task_type == "corrective" and task.source_task_id
            else None
        ),
    }


def present_asset(asset: Asset, today: date, overdue: bool, open_task_count: int) -> dict:
    sub = asset.substation
    return {
        "id": asset.id,
        "serial": asset.serial,
        "name": asset.name,
        "asset_type": asset.asset_type,
        "asset_type_label": ASSET_TYPE_LABELS.get(asset.asset_type, asset.asset_type),
        "substation_id": sub.id,
        "substation_code": sub.code,
        "substation_name": sub.name,
        "substation_region": sub.region,
        "voltage_kv": asset.voltage_kv,
        "criticality": asset.criticality,
        "criticality_label": CRITICALITY_LABELS.get(asset.criticality, asset.criticality),
        "interval_days": asset.interval_days,
        "install_date": iso(asset.install_date),
        "status": asset.status,
        "status_label": ASSET_STATUS_LABELS.get(asset.status, asset.status),
        "last_maintenance_on": iso(asset.last_maintenance_on),
        "next_due_on": iso(asset.next_due_on),
        "latest_condition": asset.latest_condition,
        "condition_label": CONDITION_LABELS.get(asset.latest_condition) if asset.latest_condition else None,
        "overdue": overdue,
        "open_task_count": open_task_count,
    }


def task_flags(db: Session, today: date) -> tuple[set[int], dict[int, int]]:
    overdue_ids: set[int] = set()
    open_counts: dict[int, int] = {}
    rows = db.scalars(select(Task)).all()
    for task in rows:
        if task.status in ("completed", "cancelled"):
            continue
        open_counts[task.asset_id] = open_counts.get(task.asset_id, 0) + 1
        if is_overdue(task.status, task.due_on, today):
            overdue_ids.add(task.asset_id)
    return overdue_ids, open_counts
