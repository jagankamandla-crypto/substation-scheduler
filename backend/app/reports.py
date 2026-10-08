from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.domain import CM_OPEN_QUESTION, COMPLIANCE_FORMULA, OPEN_TASK_STATUSES, is_overdue
from app.models import Asset, Substation, Task, User

OPEN_QUESTIONS = [
    "Condition 1 is shown as Very Poor and 5 as Very Good. Confirm that scale with the business analyst.",
    "Overdue work is shown to the Operations Head on the Alerts page only. Nothing is emailed or texted.",
    CM_OPEN_QUESTION,
    "No daily limit is applied to how many tasks a technician can carry.",
]


def build_dashboard(db: Session, today: date | None = None) -> dict:
    today = today or date.today()
    tasks = db.scalars(
        select(Task).options(joinedload(Task.asset).joinedload(Asset.substation), joinedload(Task.assignee))
    ).unique().all()
    substations = db.scalars(select(Substation).order_by(Substation.code)).all()
    assets = db.scalars(select(Asset)).all()
    technicians = db.scalars(select(User).where(User.role == "technician").order_by(User.full_name)).all()

    grouped: dict[int, dict[str, int]] = {
        sub.id: {"high": 0, "medium": 0, "low": 0} for sub in substations
    }
    overdue_total = 0
    for task in tasks:
        if not is_overdue(task.status, task.due_on, today):
            continue
        overdue_total += 1
        bucket = grouped.get(task.asset.substation_id)
        if bucket is not None and task.asset.criticality in bucket:
            bucket[task.asset.criticality] += 1

    overdue_rows = []
    for sub in substations:
        counts = grouped[sub.id]
        overdue_rows.append(
            {
                "substation_id": sub.id,
                "code": sub.code,
                "name": sub.name,
                "region": sub.region,
                "high": counts["high"],
                "medium": counts["medium"],
                "low": counts["low"],
                "total": counts["high"] + counts["medium"] + counts["low"],
            }
        )

    def window(owned: list[Task], days: int) -> int:
        end = today + timedelta(days=days)
        return sum(1 for task in owned if task.status in OPEN_TASK_STATUSES and today <= task.due_on <= end)

    workload = []
    for tech in technicians:
        owned = [task for task in tasks if task.assigned_to_id == tech.id]
        workload.append(
            {
                "technician_id": tech.id,
                "name": tech.full_name,
                "overdue": sum(1 for task in owned if is_overdue(task.status, task.due_on, today)),
                "d30": window(owned, 30),
                "d60": window(owned, 60),
                "d90": window(owned, 90),
            }
        )
    unassigned = [task for task in tasks if task.assigned_to_id is None]
    if unassigned:
        workload.append(
            {
                "technician_id": None,
                "name": "Unassigned",
                "overdue": sum(1 for task in unassigned if is_overdue(task.status, task.due_on, today)),
                "d30": window(unassigned, 30),
                "d60": window(unassigned, 60),
                "d90": window(unassigned, 90),
            }
        )

    arrived = [
        task
        for task in tasks
        if task.task_type == "preventive"
        and task.status != "cancelled"
        and task.due_on.year == today.year
        and task.due_on.month == today.month
        and task.due_on <= today
    ]
    on_time = [
        task
        for task in arrived
        if task.status == "completed" and task.completed_on is not None and task.completed_on <= task.due_on
    ]
    percent = round(100 * len(on_time) / len(arrived), 1) if arrived else None

    health = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "unrated": 0}
    in_service = 0
    for asset in assets:
        if asset.status == "decommissioned":
            continue
        if asset.status == "in_service":
            in_service += 1
        if asset.latest_condition in (1, 2, 3, 4, 5):
            health[str(asset.latest_condition)] += 1
        else:
            health["unrated"] += 1

    due_30 = sum(
        1
        for task in tasks
        if task.status in OPEN_TASK_STATUSES and today <= task.due_on <= today + timedelta(days=30)
    )
    return {
        "as_of": today.isoformat(),
        "compliance": {
            "period_label": today.strftime("%B %Y"),
            "arrived": len(arrived),
            "on_time": len(on_time),
            "percent": percent,
            "formula": COMPLIANCE_FORMULA,
        },
        "overdue_by_substation": overdue_rows,
        "overdue_total": overdue_total,
        "workload": workload,
        "asset_health": health,
        "counts": {
            "assets": len(assets),
            "in_service": in_service,
            "open_tasks": sum(1 for task in tasks if task.status in OPEN_TASK_STATUSES),
            "due_30": due_30,
        },
        "open_questions": OPEN_QUESTIONS,
    }


def _month_bounds(month: str) -> tuple[date, date]:
    try:
        year_text, month_text = month.split("-")
        year, month_number = int(year_text), int(month_text)
        start = date(year, month_number, 1)
    except (TypeError, ValueError):
        raise ValueError("Choose a month as YYYY-MM.") from None
    if month_number == 12:
        end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(year, month_number + 1, 1) - timedelta(days=1)
    return start, end


def _blank_counts() -> dict[str, int]:
    return {"arrived": 0, "on_time": 0, "late": 0, "open": 0}


def _outcome(task: Task) -> str:
    if task.status == "completed" and task.completed_on is not None and task.completed_on <= task.due_on:
        return "on_time"
    if task.status == "completed" and task.completed_on is not None and task.completed_on > task.due_on:
        return "late"
    return "open"


def build_compliance_report(db: Session, month: str | None = None, today: date | None = None) -> dict:
    """Preventive tasks whose due date has arrived in the month.

    On time, late, and still open use the same rule as the dashboard percentage.
    Tasks due later in the month are listed apart so they do not lower the percentage.
    """
    today = today or date.today()
    month = month or f"{today.year:04d}-{today.month:02d}"
    start, end = _month_bounds(month)
    tasks = db.scalars(
        select(Task).options(joinedload(Task.asset).joinedload(Asset.substation), joinedload(Task.assignee))
    ).unique().all()
    substations = db.scalars(select(Substation).order_by(Substation.code)).all()

    def in_month(task: Task) -> bool:
        return task.task_type == "preventive" and task.status != "cancelled" and start <= task.due_on <= end

    arrived = [task for task in tasks if in_month(task) and task.due_on <= today]
    later = [task for task in tasks if in_month(task) and task.due_on > today]
    grouped = {
        sub.id: {"high": _blank_counts(), "medium": _blank_counts(), "low": _blank_counts()}
        for sub in substations
    }
    summary = _blank_counts()
    for task in arrived:
        outcome = _outcome(task)
        summary["arrived"] += 1
        summary[outcome] += 1
        bucket = grouped.get(task.asset.substation_id)
        if bucket is None or task.asset.criticality not in bucket:
            continue
        cell = bucket[task.asset.criticality]
        cell["arrived"] += 1
        cell[outcome] += 1

    def with_percent(counts: dict[str, int]) -> dict:
        percent = round(100 * counts["on_time"] / counts["arrived"], 1) if counts["arrived"] else None
        return {**counts, "percent": percent}

    rows = []
    for sub in substations:
        counts = grouped[sub.id]
        total = _blank_counts()
        for name in ("high", "medium", "low"):
            for key in total:
                total[key] += counts[name][key]
        rows.append(
            {
                "substation_id": sub.id,
                "code": sub.code,
                "name": sub.name,
                "region": sub.region,
                "high": with_percent(counts["high"]),
                "medium": with_percent(counts["medium"]),
                "low": with_percent(counts["low"]),
                "total": with_percent(total),
            }
        )

    rank = {"open": 0, "late": 1, "on_time": 2}
    arrived.sort(key=lambda task: (rank[_outcome(task)], task.asset.substation.code, task.due_on, task.code))
    later.sort(key=lambda task: (task.due_on, task.code))
    return {
        "as_of": today.isoformat(),
        "month": month,
        "period_label": start.strftime("%B %Y"),
        "formula": COMPLIANCE_FORMULA,
        "summary": with_percent(summary),
        "due_later": len(later),
        "by_substation": rows,
        "tasks": arrived,
        "later_tasks": later,
    }


def overdue_tasks(db: Session, today: date | None = None) -> list[Task]:
    today = today or date.today()
    tasks = db.scalars(
        select(Task).options(joinedload(Task.asset).joinedload(Asset.substation), joinedload(Task.assignee))
    ).unique().all()
    rows = [task for task in tasks if is_overdue(task.status, task.due_on, today)]
    rank = {"high": 0, "medium": 1, "low": 2}
    rows.sort(key=lambda task: (rank.get(task.asset.criticality, 9), -((today - task.due_on).days), task.due_on))
    return rows
