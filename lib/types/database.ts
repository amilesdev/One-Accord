// ─── Enums ────────────────────────────────────────────────────────────────────

export type PartnershipStatus = "pending" | "active" | "dissolved";
export type WeekStatus        = "active"  | "completed";
export type TaskType          = "counter" | "simple";

// ─── Template task definition (stored as JSONB in weekly_templates) ───────────

export interface TemplateTaskDefinition {
  id:           string;
  title:        string;
  task_type:    TaskType;
  target_value?: number;   // required for counter, absent for simple
  sort_order:   number;
}

// ─── Table row types ──────────────────────────────────────────────────────────

export interface DbUser {
  id:           string;
  email:        string;
  display_name: string | null;
  created_at:   string;
}

export interface DbPartnership {
  id:           string;
  user_a_id:    string;
  user_b_id:    string | null;  // null until partner accepts invite
  invite_code:  string;
  status:       PartnershipStatus;
  created_at:   string;
  activated_at: string | null;
}

export interface DbWeeklyTemplate {
  id:               string;
  partnership_id:   string;
  week_start_day:   number;  // 0 = Sunday … 6 = Saturday
  task_definitions: TemplateTaskDefinition[];
  is_active:        boolean;
  created_at:       string;
  updated_at:       string;
}

export interface DbWeek {
  id:             string;
  partnership_id: string;
  template_id:    string;
  start_date:     string;  // ISO date "YYYY-MM-DD"
  end_date:       string;
  status:         WeekStatus;
  created_at:     string;
}

export interface DbWeeklyTask {
  id:           string;
  week_id:      string;
  title:        string;
  task_type:    TaskType;
  target_value: number | null;  // null for simple tasks
  sort_order:   number;
  created_at:   string;
}

export interface DbTaskProgress {
  id:            string;
  task_id:       string;
  user_id:       string;
  current_value: number;
  completed_at:  string | null;
  updated_at:    string;
}

export interface DbReflection {
  id:         string;
  week_id:    string;
  user_id:    string;
  task_id:    string | null;
  content:    string;
  created_at: string;
  updated_at: string;
}

// ─── Joined / enriched types used by the UI ──────────────────────────────────

export interface TaskWithProgress extends DbWeeklyTask {
  progress: DbTaskProgress | null;
}

export interface WeekWithTasks extends DbWeek {
  tasks: TaskWithProgress[];
}

export interface PartnershipWithUsers extends DbPartnership {
  user_a: DbUser;
  user_b: DbUser | null;
}
