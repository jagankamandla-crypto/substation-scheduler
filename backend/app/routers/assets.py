from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require
from app.domain import NotFound
from app.models import Asset, Task, User
from app.present import present_asset, present_task, task_flags
from app.schemas import AssetIn
from app.services import create_asset, decommission_asset, update_asset

router = APIRouter(tags=["assets"])

READ_ROLES = ("asset_manager", "planner", "operations_head", "technician")
WRITE_ROLES = ("asset_manager",)


@router.get("/assets")
def list_assets(
    db: Session = Depends(get_db),
    _: User = Depends(require("asset_manager", "planner", "operations_head")),
):
    today = date.today()
    overdue_ids, open_counts = task_flags(db, today)
    assets = db.scalars(select(Asset).options(joinedload(Asset.substation)).order_by(Asset.serial)).unique().all()
    return [
        present_asset(asset, today, asset.id in overdue_ids, open_counts.get(asset.id, 0))
        for asset in assets
    ]


@router.post("/assets", status_code=201)
def post_asset(
    body: AssetIn,
    db: Session = Depends(get_db),
    _: User = Depends(require(*WRITE_ROLES)),
):
    today = date.today()
    asset = create_asset(db, body, today)
    overdue_ids, open_counts = task_flags(db, today)
    return present_asset(asset, today, asset.id in overdue_ids, open_counts.get(asset.id, 0))


@router.get("/assets/{asset_id}")
def get_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require(*READ_ROLES)),
):
    today = date.today()
    asset = db.scalar(select(Asset).options(joinedload(Asset.substation)).where(Asset.id == asset_id))
    if asset is None:
        raise NotFound("Asset not found.")
    overdue_ids, open_counts = task_flags(db, today)
    tasks = db.scalars(
        select(Task)
        .options(joinedload(Task.asset).joinedload(Asset.substation), joinedload(Task.assignee))
        .where(Task.asset_id == asset.id)
        .order_by(Task.due_on.desc(), Task.id.desc())
    ).unique().all()
    if user.role == "technician":
        tasks = [task for task in tasks if task.assigned_to_id == user.id]
    body = present_asset(asset, today, asset.id in overdue_ids, open_counts.get(asset.id, 0))
    body["tasks"] = [present_task(task, today) for task in tasks]
    return body


@router.put("/assets/{asset_id}")
def put_asset(
    asset_id: int,
    body: AssetIn,
    db: Session = Depends(get_db),
    _: User = Depends(require(*WRITE_ROLES)),
):
    today = date.today()
    asset = update_asset(db, asset_id, body, today)
    overdue_ids, open_counts = task_flags(db, today)
    return present_asset(asset, today, asset.id in overdue_ids, open_counts.get(asset.id, 0))


@router.post("/assets/{asset_id}/decommission")
def post_decommission(
    asset_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require(*WRITE_ROLES)),
):
    today = date.today()
    asset = decommission_asset(db, asset_id)
    overdue_ids, open_counts = task_flags(db, today)
    return present_asset(asset, today, asset.id in overdue_ids, open_counts.get(asset.id, 0))
