"""Business rules BR-01 through BR-10.

Three validation messages are the business analyst's exact wording:
serial uniqueness, future install date, and the High-criticality 180-day cap.
The 30–730 day sentence is the draft wording for a message the brief did not supply.
Corrective work due seven days later is still an open question; the date is
calculated and labelled as such.
"""

from __future__ import annotations

from datetime import date, timedelta

VOLTAGES = (11, 33, 66, 132, 220, 400)
ASSET_TYPES = ("transformer", "circuit_breaker", "switchgear", "protection_relay")
CRITICALITIES = ("high", "medium", "low")
ASSET_STATUSES = ("in_service", "under_maintenance", "decommissioned")
TASK_TYPES = ("preventive", "corrective")
TASK_STATUSES = ("scheduled", "assigned", "in_progress", "completed", "cancelled")
OPEN_TASK_STATUSES = ("scheduled", "assigned", "in_progress")
ROLES = ("asset_manager", "planner", "technician", "operations_head")

INTERVAL_MIN = 30
INTERVAL_MAX = 730
HIGH_INTERVAL_MAX = 180
# Open BA question: corrective tasks are due this many days after a poor visit.
CM_DUE_DAYS = 7
POOR_RATING_AT_OR_BELOW = 2

SERIAL_MESSAGE = "Serial number already exists. Enter a unique serial number."
SERIAL_REQUIRED = "Serial number is required."
INSTALL_MESSAGE = "Install date cannot be a future date."
INSTALL_REQUIRED = "Install date is required."
HIGH_INTERVAL_MESSAGE = "Maintenance interval for High-criticality assets cannot exceed 180 days."
INTERVAL_MESSAGE = "Maintenance interval must be between 30 and 730 days."
VOLTAGE_MESSAGE = "Voltage must be one of 11, 33, 66, 132, 220, or 400 kV."
NAME_REQUIRED = "Asset name is required."
TYPE_MESSAGE = "Choose an equipment type."
SUBSTATION_MESSAGE = "Choose a substation."
CRITICALITY_MESSAGE = "Choose High, Medium, or Low criticality."
NOTES_MESSAGE = "Work notes are required."
RATING_MESSAGE = "Condition rating must be between 1 and 5."
COMPLETION_FUTURE = "Completion date cannot be a future date."
COMPLETION_BEFORE_CREATED = "Completion date cannot be before the task was created."
COMPLETION_REQUIRED = "Completion date is required."
DECOMMISSIONED_EDIT = "Decommissioned assets cannot be edited."
ALREADY_DECOMMISSIONED = "This asset is already decommissioned."

ROLE_LABELS = {
    "asset_manager": "Asset Manager",
    "planner": "Maintenance Planner",
    "technician": "Technician",
    "operations_head": "Operations Head",
}
HOME = {
    "asset_manager": "/assets",
    "planner": "/tasks",
    "technician": "/my-work",
    "operations_head": "/dashboard",
}
ASSET_TYPE_LABELS = {
    "transformer": "Transformer",
    "circuit_breaker": "Circuit breaker",
    "switchgear": "Switchgear",
    "protection_relay": "Protection relay",
}
CRITICALITY_LABELS = {"high": "High", "medium": "Medium", "low": "Low"}
ASSET_STATUS_LABELS = {
    "in_service": "In Service",
    "under_maintenance": "Under Maintenance",
    "decommissioned": "Decommissioned",
}
TASK_STATUS_LABELS = {
    "scheduled": "Scheduled",
    "assigned": "Assigned",
    "in_progress": "In Progress",
    "completed": "Completed",
    "cancelled": "Cancelled",
}
TASK_TYPE_LABELS = {"preventive": "Preventive", "corrective": "Corrective"}
CONDITION_LABELS = {
    1: "Very Poor",
    2: "Poor",
    3: "Fair",
    4: "Good",
    5: "Very Good",
}

COMPLIANCE_FORMULA = (
    "Preventive tasks completed on or before the due date, divided by preventive "
    "tasks whose due date has arrived this month. Cancelled tasks are excluded."
)
CM_OPEN_QUESTION = (
    "A condition rating of 1 or 2 opens a corrective task at High priority, due "
    "7 days later. That 7-day due date is still an open question with the business analyst."
)


class RuleError(Exception):
    def __init__(self, errors: list[tuple[str, str]]):
        self.errors = errors
        super().__init__(errors[0][1] if errors else "Invalid")


class AccessDenied(Exception):
    def __init__(self, message: str = "You do not have access to this action."):
        self.message = message
        super().__init__(message)


class NotFound(Exception):
    def __init__(self, message: str = "Not found."):
        self.message = message
        super().__init__(message)


def compute_next_due(last_maintenance: date | None, install_date: date, interval_days: int) -> date:
    """BR-03. The due date is calculated. Callers do not accept a typed due date."""
    base = last_maintenance or install_date
    return base + timedelta(days=interval_days)


def is_overdue(status: str, due_on: date, today: date) -> bool:
    """BR-10. Overdue is a flag, not a status."""
    return status not in ("completed", "cancelled") and due_on < today


def validate_asset(
    *,
    serial: str,
    name: str,
    asset_type: str,
    substation_id: int,
    voltage_kv: int,
    criticality: str,
    interval_days: int,
    install_date: date | None,
    today: date,
    serial_taken: bool,
) -> list[tuple[str, str]]:
    errors: list[tuple[str, str]] = []
    if not serial.strip():
        errors.append(("serial", SERIAL_REQUIRED))
    elif serial_taken:
        errors.append(("serial", SERIAL_MESSAGE))
    if not name.strip():
        errors.append(("name", NAME_REQUIRED))
    if asset_type not in ASSET_TYPES:
        errors.append(("asset_type", TYPE_MESSAGE))
    if not substation_id:
        errors.append(("substation_id", SUBSTATION_MESSAGE))
    if voltage_kv not in VOLTAGES:
        errors.append(("voltage_kv", VOLTAGE_MESSAGE))
    if criticality not in CRITICALITIES:
        errors.append(("criticality", CRITICALITY_MESSAGE))
    if not isinstance(interval_days, int) or isinstance(interval_days, bool) or not (INTERVAL_MIN <= interval_days <= INTERVAL_MAX):
        errors.append(("interval_days", INTERVAL_MESSAGE))
    elif criticality == "high" and interval_days > HIGH_INTERVAL_MAX:
        errors.append(("interval_days", HIGH_INTERVAL_MESSAGE))
    if install_date is None:
        errors.append(("install_date", INSTALL_REQUIRED))
    elif install_date > today:
        errors.append(("install_date", INSTALL_MESSAGE))
    return errors


def validate_completion(
    *,
    completion_date: date | None,
    notes: str | None,
    rating: int | None,
    created_on: date,
    today: date,
) -> list[tuple[str, str]]:
    errors: list[tuple[str, str]] = []
    if completion_date is None:
        errors.append(("completion_date", COMPLETION_REQUIRED))
    else:
        if completion_date > today:
            errors.append(("completion_date", COMPLETION_FUTURE))
        if completion_date < created_on:
            errors.append(("completion_date", COMPLETION_BEFORE_CREATED))
    if notes is None or not str(notes).strip():
        errors.append(("notes", NOTES_MESSAGE))
    if rating is None or isinstance(rating, bool) or not isinstance(rating, int) or not 1 <= rating <= 5:
        errors.append(("condition_rating", RATING_MESSAGE))
    return errors


def opens_corrective(rating: int) -> bool:
    return rating <= POOR_RATING_AT_OR_BELOW


def corrective_due(completion_date: date) -> date:
    return completion_date + timedelta(days=CM_DUE_DAYS)
