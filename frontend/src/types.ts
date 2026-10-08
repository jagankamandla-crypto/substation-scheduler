export type Role = "asset_manager" | "planner" | "technician" | "operations_head";

export type User = {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  role_label: string;
  home: string;
};

export type Session = {
  access_token: string;
  token_type: string;
  user: User;
};

export type Substation = {
  id: number;
  code: string;
  name: string;
  voltage_kv: number;
  region: string;
};

export type Task = {
  id: number;
  code: string;
  task_type: string;
  task_type_label: string;
  status: string;
  status_label: string;
  priority: string;
  priority_label: string;
  due_on: string;
  created_on: string;
  completed_on: string | null;
  notes: string | null;
  condition_rating: number | null;
  condition_label: string | null;
  overdue: boolean;
  days_overdue: number;
  asset_id: number;
  asset_serial: string;
  asset_name: string;
  asset_type_label: string;
  criticality: string;
  criticality_label: string;
  voltage_kv: number;
  asset_status: string;
  asset_status_label: string;
  substation_id: number;
  substation_code: string;
  substation_name: string;
  assignee_id: number | null;
  assignee_name: string | null;
  source_task_id: number | null;
  spawned_reason: string | null;
};

export type Asset = {
  id: number;
  serial: string;
  name: string;
  asset_type: string;
  asset_type_label: string;
  substation_id: number;
  substation_code: string;
  substation_name: string;
  substation_region: string;
  voltage_kv: number;
  criticality: string;
  criticality_label: string;
  interval_days: number;
  install_date: string;
  status: string;
  status_label: string;
  last_maintenance_on: string | null;
  next_due_on: string | null;
  latest_condition: number | null;
  condition_label: string | null;
  overdue: boolean;
  open_task_count: number;
  tasks?: Task[];
};

export type Dashboard = {
  as_of: string;
  compliance: {
    period_label: string;
    arrived: number;
    on_time: number;
    percent: number | null;
    formula: string;
  };
  overdue_by_substation: {
    substation_id: number;
    code: string;
    name: string;
    region: string;
    high: number;
    medium: number;
    low: number;
    total: number;
  }[];
  overdue_total: number;
  workload: {
    technician_id: number | null;
    name: string;
    overdue: number;
    d30: number;
    d60: number;
    d90: number;
  }[];
  asset_health: Record<string, number>;
  counts: { assets: number; in_service: number; open_tasks: number; due_30: number };
  open_questions: string[];
};

export type CompleteResult = {
  task: Task;
  next_preventive: Task | null;
  corrective: Task | null;
  note: string | null;
};
