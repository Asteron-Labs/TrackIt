/**
 * Tunable domain constants. Per AGENTS.md these live here and are never inlined as
 * literals in services. Values mirror the table in AGENTS.md exactly.
 */

// Capacity and workload
export const MAX_DAILY_HOURS = 12;
export const DEFAULT_WEEKLY_CAPACITY = 40;
export const WORKLOAD_AVAILABLE_MAX = 60; // <=60% available
export const WORKLOAD_BALANCED_MAX = 90; // <=90% balanced, above = overloaded

// Risk thresholds
export const EFFORT_OVERRUN_THRESHOLD = 120; // % of estimate before a risk is raised
export const DEADLINE_APPROACHING_DAYS = 3;
export const NO_PROGRESS_DAYS = 5;

// Auth
export const JWT_EXPIRY = '24h';

// Priority score — business priority
export const PRIORITY_HIGH = 30;
export const PRIORITY_MEDIUM = 20;
export const PRIORITY_LOW = 10;

// Priority score — deadline urgency
export const DUE_WITHIN_2_DAYS = 30;
export const DUE_WITHIN_7_DAYS = 20;
export const DUE_LATER = 5;

// Priority score — dependency impact
export const BLOCKS_ANOTHER_TASK = 10; // per dependent task
export const BLOCKED_PENALTY = -40;

// Priority score — goal importance
export const GOAL_IMPORTANCE_HIGH = 20;
export const GOAL_IMPORTANCE_MEDIUM = 10;
export const GOAL_IMPORTANCE_LOW = 5;
