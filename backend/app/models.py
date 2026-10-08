from __future__ import annotations

from datetime import date

from sqlalchemy import Date, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(32), index=True)
    password_hash: Mapped[str] = mapped_column(String(200))

    tasks: Mapped[list[Task]] = relationship(back_populates="assignee")


class Substation(Base):
    __tablename__ = "substations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    voltage_kv: Mapped[int] = mapped_column(Integer)
    region: Mapped[str] = mapped_column(String(120))

    assets: Mapped[list[Asset]] = relationship(back_populates="substation")


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    serial: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    asset_type: Mapped[str] = mapped_column(String(32))
    substation_id: Mapped[int] = mapped_column(ForeignKey("substations.id"), index=True)
    voltage_kv: Mapped[int] = mapped_column(Integer)
    criticality: Mapped[str] = mapped_column(String(16), index=True)
    interval_days: Mapped[int] = mapped_column(Integer)
    install_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(32), default="in_service", index=True)
    last_maintenance_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    next_due_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    latest_condition: Mapped[int | None] = mapped_column(Integer, nullable=True)

    substation: Mapped[Substation] = relationship(back_populates="assets")
    tasks: Mapped[list[Task]] = relationship(back_populates="asset")


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (Index("ix_tasks_status_due", "status", "due_on"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), index=True)
    task_type: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(32), index=True)
    priority: Mapped[str] = mapped_column(String(16))
    due_on: Mapped[date] = mapped_column(Date, index=True)
    created_on: Mapped[date] = mapped_column(Date)
    assigned_to_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    completed_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    condition_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id"), nullable=True)

    asset: Mapped[Asset] = relationship(back_populates="tasks")
    assignee: Mapped[User | None] = relationship(back_populates="tasks")
