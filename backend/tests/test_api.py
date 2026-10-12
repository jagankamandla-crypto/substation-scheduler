from datetime import date, timedelta

from app.domain import (
    HIGH_INTERVAL_MESSAGE,
    INSTALL_MESSAGE,
    INTERVAL_MESSAGE,
    SERIAL_MESSAGE,
    VOLTAGE_MESSAGE,
)
from app.seed import DEMO_PASSWORD


def login(client, email: str):
    response = client.post("/api/auth/login", json={"email": email, "password": DEMO_PASSWORD})
    assert response.status_code == 200, response.text
    body = response.json()
    return body, {"Authorization": f"Bearer {body['access_token']}"}


def message(response):
    return response.json()["detail"][0]["message"]


def asset_body(substation_id: int, **overrides):
    body = {
        "serial": "TRF-10002",
        "name": "New transformer",
        "asset_type": "transformer",
        "substation_id": substation_id,
        "voltage_kv": 132,
        "criticality": "medium",
        "interval_days": 90,
        "install_date": "2026-09-15",
    }
    body.update(overrides)
    return body


def test_login_sends_each_role_home(client):
    homes = {
        "rao.ops@grid.example": "/dashboard",
        "suresh.asset@grid.example": "/assets",
        "lakshmi.planner@grid.example": "/tasks",
        "ramesh.tech@grid.example": "/my-work",
    }
    for email, home in homes.items():
        body, _ = login(client, email)
        assert body["user"]["home"] == home
    rejected = client.post("/api/auth/login", json={"email": "rao.ops@grid.example", "password": "nope"})
    assert rejected.status_code == 401


def test_a_new_person_can_join_and_reset_their_password(client):
    created = client.post(
        "/api/auth/register",
        json={
            "full_name": "Anita Rao",
            "email": "Anita.Tech@grid.example",
            "password": "Visit#2026",
            "role": "technician",
        },
    )
    assert created.status_code == 200, created.text
    assert created.json()["user"]["email"] == "anita.tech@grid.example"
    assert created.json()["user"]["home"] == "/my-work"

    duplicate = client.post(
        "/api/auth/register",
        json={
            "full_name": "Anita Rao",
            "email": "anita.tech@grid.example",
            "password": "Visit#2026",
            "role": "technician",
        },
    )
    assert duplicate.status_code == 422
    assert message(duplicate) == "An account already uses that email."

    missing = client.post(
        "/api/auth/reset-password",
        json={"email": "nobody@grid.example", "password": "Visit#2026"},
    )
    assert missing.status_code == 422
    assert message(missing) == "No account uses that email."

    reset = client.post(
        "/api/auth/reset-password",
        json={"email": "anita.tech@grid.example", "password": "Fresh#2026"},
    )
    assert reset.status_code == 200
    old = client.post("/api/auth/login", json={"email": "anita.tech@grid.example", "password": "Visit#2026"})
    assert old.status_code == 401
    fresh = client.post("/api/auth/login", json={"email": "anita.tech@grid.example", "password": "Fresh#2026"})
    assert fresh.status_code == 200


def test_asset_rules_over_http(client):
    _, manager = login(client, "suresh.asset@grid.example")
    substations = client.get("/api/substations", headers=manager).json()
    sub_id = next(item["id"] for item in substations if item["code"] == "SS-A")

    duplicate = client.post("/api/assets", headers=manager, json=asset_body(sub_id, serial="TRF-10001"))
    assert duplicate.status_code == 422
    assert message(duplicate) == SERIAL_MESSAGE

    future = date.today() + timedelta(days=4)
    future_response = client.post(
        "/api/assets",
        headers=manager,
        json=asset_body(sub_id, serial="TRF-10002", install_date=future.isoformat()),
    )
    assert message(future_response) == INSTALL_MESSAGE

    high = client.post(
        "/api/assets",
        headers=manager,
        json=asset_body(sub_id, serial="TRF-10365", criticality="high", interval_days=365),
    )
    assert message(high) == HIGH_INTERVAL_MESSAGE

    short = client.post("/api/assets", headers=manager, json=asset_body(sub_id, serial="TRF-10029", interval_days=29))
    assert message(short) == INTERVAL_MESSAGE

    voltage = client.post("/api/assets", headers=manager, json=asset_body(sub_id, serial="TRF-10500", voltage_kv=500))
    assert message(voltage) == VOLTAGE_MESSAGE

    created = client.post("/api/assets", headers=manager, json=asset_body(sub_id))
    assert created.status_code == 201
    assert created.json()["next_due_on"] == "2026-12-14"
    assert created.json()["serial"] == "TRF-10002"


def test_due_date_cannot_be_typed(client):
    _, manager = login(client, "suresh.asset@grid.example")
    assets = client.get("/api/assets", headers=manager).json()
    current = next(item for item in assets if item["serial"] == "TRF-10011")
    payload = {
        "serial": current["serial"],
        "name": current["name"],
        "asset_type": current["asset_type"],
        "substation_id": current["substation_id"],
        "voltage_kv": current["voltage_kv"],
        "criticality": current["criticality"],
        "interval_days": 90,
        "install_date": current["install_date"],
        "next_due_on": "2030-01-01",
    }
    updated = client.put(f"/api/assets/{current['id']}", headers=manager, json=payload)
    assert updated.status_code == 200
    body = updated.json()
    assert body["next_due_on"] != "2030-01-01"
    expected = date.fromisoformat(current["install_date"]) + timedelta(days=90)
    assert body["next_due_on"] == expected.isoformat()


def test_assign_does_not_change_due_date_and_other_technician_is_blocked(client):
    _, planner = login(client, "lakshmi.planner@grid.example")
    _, ramesh = login(client, "ramesh.tech@grid.example")
    _, divya = login(client, "divya.tech@grid.example")
    technicians = client.get("/api/technicians", headers=planner).json()
    divya_id = next(item["id"] for item in technicians if item["email"] == "divya.tech@grid.example")

    queue = client.get("/api/tasks", headers=planner).json()
    target = next(item for item in queue if item["code"] == "PM-1004")
    assigned = client.post(
        f"/api/tasks/{target['id']}/assign",
        headers=planner,
        json={"technician_id": divya_id, "due_on": "2030-01-01"},
    )
    assert assigned.status_code == 200
    assert assigned.json()["due_on"] == target["due_on"]
    assert assigned.json()["status"] == "assigned"
    assert assigned.json()["assignee_name"] == "Divya Nair"

    mine = client.get("/api/tasks", headers=ramesh).json()
    assert all(item["assignee_name"] == "Ramesh Kumar" for item in mine)
    pm = next(item for item in mine if item["code"] == "PM-1001")
    assert pm["overdue"] is True
    assert pm["status"] == "in_progress"
    blocked = client.get(f"/api/tasks/{pm['id']}", headers=divya)
    assert blocked.status_code == 403
    assert blocked.json()["detail"] == "You can update only tasks assigned to you."


def test_completion_creates_next_pm_and_poor_condition_creates_cm(client):
    _, ramesh = login(client, "ramesh.tech@grid.example")
    tasks = client.get("/api/tasks", headers=ramesh).json()
    pm = next(item for item in tasks if item["code"] == "PM-1001")
    done = client.post(
        f"/api/tasks/{pm['id']}/complete",
        headers=ramesh,
        json={
            "completion_date": date.today().isoformat(),
            "notes": "Preventive maintenance successfully completed",
            "condition_rating": 4,
        },
    )
    assert done.status_code == 200, done.text
    body = done.json()
    assert body["corrective"] is None
    assert body["next_preventive"]["task_type"] == "preventive"
    assert body["next_preventive"]["due_on"] == (date.today() + timedelta(days=180)).isoformat()
    assert body["task"]["overdue"] is False

    follow = next(item for item in client.get("/api/tasks", headers=ramesh).json() if item["code"] == "PM-1002")
    started = client.post(f"/api/tasks/{follow['id']}/start", headers=ramesh)
    assert started.status_code == 200
    poor = client.post(
        f"/api/tasks/{follow['id']}/complete",
        headers=ramesh,
        json={
            "completion_date": date.today().isoformat(),
            "notes": "Hot joint on the bushing. Needs a corrective visit.",
            "condition_rating": 2,
        },
    )
    assert poor.status_code == 200, poor.text
    corrective = poor.json()["corrective"]
    assert corrective["priority"] == "high"
    assert corrective["task_type"] == "corrective"
    assert corrective["due_on"] == (date.today() + timedelta(days=7)).isoformat()


def test_compliance_report_matches_the_dashboard_and_is_for_operations(client):
    _, ops = login(client, "rao.ops@grid.example")
    _, tech = login(client, "ramesh.tech@grid.example")
    assert client.get("/api/reports/compliance", headers=tech).status_code == 403
    assert client.get("/api/reports/compliance?month=2026-13", headers=ops).status_code == 422

    dashboard = client.get("/api/dashboard", headers=ops).json()
    report = client.get("/api/reports/compliance", headers=ops).json()
    assert report["summary"]["arrived"] == dashboard["compliance"]["arrived"]
    assert report["summary"]["on_time"] == dashboard["compliance"]["on_time"]
    assert report["summary"]["percent"] == dashboard["compliance"]["percent"]
    assert report["summary"]["on_time"] + report["summary"]["late"] + report["summary"]["open"] == report["summary"]["arrived"]
    outcomes = {task["outcome"] for task in report["tasks"]}
    assert outcomes <= {"on_time", "late", "open"}
    assert len(report["tasks"]) == report["summary"]["arrived"]
    substation_arrived = sum(row["total"]["arrived"] for row in report["by_substation"])
    assert substation_arrived == report["summary"]["arrived"]


def test_dashboard_groups_overdue_and_decommission_cancels_work(client):
    _, ops = login(client, "rao.ops@grid.example")
    _, manager = login(client, "suresh.asset@grid.example")
    _, tech = login(client, "ramesh.tech@grid.example")
    assert client.get("/api/dashboard", headers=tech).status_code == 403

    dashboard = client.get("/api/dashboard", headers=ops).json()
    substation_a = next(row for row in dashboard["overdue_by_substation"] if row["code"] == "SS-A")
    assert (substation_a["high"], substation_a["medium"], substation_a["low"]) == (5, 3, 1)

    assets = client.get("/api/assets", headers=manager).json()
    asset = next(item for item in assets if item["serial"] == "TRF-10013")
    retired = client.post(f"/api/assets/{asset['id']}/decommission", headers=manager)
    assert retired.status_code == 200
    detail = client.get(f"/api/assets/{asset['id']}", headers=manager).json()
    assert detail["status"] == "decommissioned"
    assert detail["tasks"]
    assert all(task["status"] == "cancelled" for task in detail["tasks"])
