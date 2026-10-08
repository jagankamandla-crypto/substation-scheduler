from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require
from app.models import Substation, User
from app.present import present_substation, present_user

router = APIRouter(tags=["catalog"])


@router.get("/substations")
def list_substations(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.scalars(select(Substation).order_by(Substation.code)).all()
    return [present_substation(row) for row in rows]


@router.get("/technicians")
def list_technicians(
    db: Session = Depends(get_db),
    _: User = Depends(require("planner", "operations_head")),
):
    rows = db.scalars(select(User).where(User.role == "technician").order_by(User.full_name)).all()
    return [present_user(row) for row in rows]
