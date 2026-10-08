# Substation Asset & Maintenance Scheduler

Gridline is the maintenance register for a fictional transmission utility. Planners assign preventive work, technicians record what they found, and the operations head sees overdue work by substation and criticality.

The business rules live in `backend/app/domain.py`. The same checks and the three exact validation messages from the brief are repeated in `frontend/src/rules.ts` so the forms fail the same way before the request is sent.

## Demo accounts

Password for every account: `Demo#2026`

| Person | Email | Lands on |
| --- | --- | --- |
| Mr. Rao, Operations Head | rao.ops@grid.example | Dashboard |
| Suresh Menon, Asset Manager | suresh.asset@grid.example | Asset register |
| Lakshmi Iyer, Maintenance Planner | lakshmi.planner@grid.example | Task queue |
| Ramesh Kumar, Technician | ramesh.tech@grid.example | My work |
| Divya Nair, Technician | divya.tech@grid.example | My work |

Divya is there so a second technician can be assigned work, and so Ramesh cannot open her tasks.

## Run it on this machine

Python 3.14 is available as `py`. Node is installed. MySQL and Docker are not, so the API uses a SQLite file until MySQL 8.4 is available. The tables are the same ones the MySQL configuration creates.

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173. The first run seeds fictional substations, assets, and tasks. Delete `backend/gridline.db` to seed again.

## MySQL 8.4

When Docker is available:

```powershell
docker compose up -d
copy .env.example .env
```

Restart the API. It reads `DATABASE_URL` and creates the same schema in MySQL.

## Checks

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest

cd ..\frontend
npm test
```

## Still open with the business analyst

- Confirm that condition 1 means Very Poor and 5 means Very Good. The app uses that scale.
- Overdue work is shown on the Alerts page only. No email or SMS is sent.
- A rating of 1 or 2 opens a High-priority corrective task due 7 days later. That 7-day date is still an open question, and the screen says so.
- There is no daily limit on a technician's tasks.

## Version control

This folder is a local Git repository. A GitHub remote is not configured yet.
