from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require
from app.models import User
from app.present import present_task
from app.reports import _outcome, build_compliance_report, build_dashboard, overdue_tasks

router = APIRouter(tags=["dashboard"])

READERS = ("operations_head", "asset_manager", "planner")
OUTCOME_LABELS = {"on_time": "On time", "late": "Late", "open": "Still open"}


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), _: User = Depends(require(*READERS))):
    return build_dashboard(db, date.today())


@router.get("/reports/compliance")
def compliance_report(
    month: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require("operations_head")),
):
    today = date.today()
    try:
        report = build_compliance_report(db, month, today)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    def line(task):
        body = present_task(task, today)
        outcome = _outcome(task)
        body["outcome"] = outcome
        body["outcome_label"] = OUTCOME_LABELS[outcome]
        return body

    report["tasks"] = [line(task) for task in report["tasks"]]
    report["later_tasks"] = [present_task(task, today) for task in report["later_tasks"]]
    return report


@router.get("/alerts")
def alerts(db: Session = Depends(get_db), _: User = Depends(require(*READERS))):
    today = date.today()
    rows = overdue_tasks(db, today)
    high = sum(1 for task in rows if task.asset.criticality == "high")
    return {
        "as_of": today.isoformat(),
        "high_count": high,
        "total": len(rows),
        "tasks": [present_task(task, today) for task in rows],
    }
