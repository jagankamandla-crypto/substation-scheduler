# Gridline user training

Fictional people and substations. Password for every account: `Demo#2026`.

Sign in at http://127.0.0.1:5173. Each person lands on their own home screen. The sidebar shows only the pages that role can open. Anyone can switch light and dark theme, collapse the sidebar, and sign out. Signing out asks for confirmation.

If someone opens a page they are not allowed to use, the app sends them back to their home screen.

## Who can open which page

| Page | Mr. Rao | Suresh Menon | Lakshmi Iyer | Ramesh Kumar | Divya Nair |
| --- | --- | --- | --- | --- | --- |
| Dashboard | Yes, home | Yes | Yes | No | No |
| Compliance report | Yes | No | No | No | No |
| Asset register | Yes, view | Yes, home | Yes, view | No | No |
| Asset detail | Yes, view | Yes | Yes, view | Own tasks only | Own tasks only |
| New or edit asset | No | Yes | No | No | No |
| Task queue | Yes, view | No | Yes, home | No | No |
| Task detail | Yes, view | No | Yes | Own tasks only | Own tasks only |
| My work | No | No | No | Yes, home | Yes, home |
| Alerts | Yes | Yes | Yes | No | No |

Ramesh and Divya have the same access. Each one sees and updates only the tasks assigned to them.

## Mr. Rao, Operations Head

Email: `rao.ops@grid.example`. Lands on the Dashboard.

He reviews the fleet. He does not change assets or tasks.

- Dashboard: this month's preventive compliance, open overdue work by substation and criticality, asset health from the latest condition rating, and technician workload for the next 30, 60, and 90 days.
- Compliance report: the same month's on-time, late, and still-open preventive visits, by substation and criticality. He can change the month, filter the task list, and print. This page is his alone.
- Asset register and asset detail: look up an asset and its service history. No New asset, Edit, or Decommission.
- Task queue and task detail: see who a task is assigned to and whether it is overdue. The task screen says assignment belongs to the planner and completion belongs to the technician.
- Alerts: overdue work, with High criticality shown first. Nothing is emailed or texted.

## Suresh Menon, Asset Manager

Email: `suresh.asset@grid.example`. Lands on the Asset register.

He keeps the asset register. He does not assign or complete maintenance visits.

- Create an asset. The serial must be unique. The install date cannot be in the future. The maintenance interval is 30 to 730 days, and at most 180 days when criticality is High. Voltage is only 11, 33, 66, 132, 220, or 400 kV.
- The next due date is calculated. It is the last maintenance date, or the install date if none is recorded, plus the interval. He cannot type over it.
- Edit an asset that is still in service. The next due date stays calculated.
- Decommission an asset. A dialog warns that every open task on that asset is cancelled and that no new preventive or corrective task will be created.
- Dashboard and Alerts: same review screens as the planner. He cannot open the task queue, a task, or the compliance report.

## Lakshmi Iyer, Maintenance Planner

Email: `lakshmi.planner@grid.example`. Lands on the Task queue.

She assigns work. She does not create assets or record a technician's visit.

- Task queue: open, overdue, and other tasks across the fleet.
- Assign a scheduled or assigned task to Ramesh Kumar or Divya Nair. The dialog keeps the existing due date. She cannot set a new due date.
- Reassign a task that is still scheduled or assigned. She cannot assign a task that is already in progress, completed, or cancelled, and she cannot assign work on a decommissioned asset.
- Asset register and asset detail: look up the asset behind a task. No New asset, Edit, or Decommission.
- Dashboard and Alerts: review overdue work and workload. She cannot open the compliance report or My work.

## Ramesh Kumar and Divya Nair, Technicians

Emails: `ramesh.tech@grid.example` and `divya.tech@grid.example`. Both land on My work.

A technician updates only the visits assigned to them.

- My work lists their overdue visits, upcoming visits, and a short completed history.
- Open one of those tasks. They cannot open the other technician's task. The message is: "You can update only tasks assigned to you."
- Start work on an assigned task. The asset is marked under maintenance until the visit is completed.
- Complete a visit that is in progress. The completion date cannot be in the future and cannot be before the task was created. Notes are required. The condition rating is 1 to 5.
- Completing a preventive visit records the last maintenance date and creates the next preventive task, due completion date plus the asset interval. That next task is unassigned until Lakshmi assigns it.
- A rating of 1 or 2 also opens a High-priority corrective task due 7 days after completion. The screen says the 7-day date is still an open question with the business analyst.
- From a task they can open that asset. The service history on the asset shows only their own tasks. They have no Asset register, Dashboard, Task queue, Alerts, or Compliance report.

## Words that matter in every role

- Overdue is a flag, not a status. The task is still open and its due date is before today. Completed and cancelled tasks are not overdue.
- Criticality is High, Medium, or Low.
- Condition runs from 1, Very Poor, to 5, Very Good. Confirm that scale with the business analyst.
- There is no daily limit on how many tasks a technician can carry.
