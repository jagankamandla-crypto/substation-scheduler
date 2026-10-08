from datetime import date

from pydantic import BaseModel, ConfigDict


class LoginIn(BaseModel):
    email: str
    password: str


class AssetIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    serial: str
    name: str
    asset_type: str
    substation_id: int
    voltage_kv: int
    criticality: str
    interval_days: int
    install_date: date


class AssignIn(BaseModel):
    """Due date is intentionally absent. BR-03 calculates it."""

    model_config = ConfigDict(extra="ignore")

    technician_id: int


class CompleteIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    completion_date: date
    notes: str = ""
    condition_rating: int
