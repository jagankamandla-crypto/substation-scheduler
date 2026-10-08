from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_user, require
from app.domain import AccessDenied, CM_OPEN_QUESTION, NotFound
from app.models import Asset, Task, User
from app.present import present_task
from app.schemas import AssignIn, CompleteIn
from app.services import assign_task, complete_task, start_task

router = APIRouter(tags=["tasks"])


def _present_loaded(task: Task, today: date) -> dict:
    return present_task(task, today)


@router.get("/tasks")
def list_tasks(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in ("planner", "operations_head", "technician"):
        raise HTTPException(status_code=403, detail="You do not have access to this action.")
    today = date.today()
    stmt = select(Task).options(joinedload(Task.asset).joinedload(Asset.substation), joinedload(Task.assignee))
    if user.role == "technician":
        stmt = stmt.where(Task.assigned_to_id == user.id)
    rows = db.scalars(stmt.order_by(Task.due_on, Task.id)).unique().all()
    return [_present_loaded(task, today) for task in rows]


@router.get("/tasks/{task_id}")
def get_task(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in ("planner", "operations_head", "technician"):
        raise HTTPException(status_code=403, detail="You do not have access to this action.")
    task = db.scalar(
        select(Task)
        .options(joinedload(Task.asset).joinedload(Asset.substation), joinedload(Task.assignee))
        .where(Task.id == task_id)
    )
    if task is None:
        raise NotFound("Task not found.")
    if user.role == "technician" and task.assigned_to_id != user.id:
        raise AccessDenied("You can update only tasks assigned to you.")
    return present_task(task, date.today())


@router.post("/tasks/{task_id}/assign")
def post_assign(
    task_id: int,
    body: AssignIn,
    db: Session = Depends(get_db),
    _: User = Depends(require("planner")),
):
    task = assign_task(db, task_id, body.technician_id)
    return present_task(task, date.today())


@router.post("/tasks/{task_id}/start")
def post_start(
    task_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    task = start_task(db, task_id, user)
    return present_task(task, date.today())


@router.post("/tasks/{task_id}/complete")
def post_complete(
    task_id: int,
    body: CompleteIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    outcome = complete_task(
        db,
        task_id,
        user,
        body.completion_date,
        body.notes,
        body.condition_rating,
    )
    today = date.today()
    note = None
    if outcome.corrective is not None:
        note = CM_OPEN_QUESTION
    elif outcome.next_preventive is not None:
        note = "The next preventive task was calculated from this completion date plus the asset interval."
    return {
        "task": present_task(outcome.task, today),
        "next_preventive": present_task(outcome.next_preventive, today) if outcome.next_preventive else None,
        "corrective": present_task(outcome.corrective, today) if outcome.corrective else None,
        "note": note,
    }
