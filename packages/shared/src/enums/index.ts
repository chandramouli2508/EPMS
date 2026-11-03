// ─── Estimate Status ─────────────────────────────────────────────────────────
export enum EstimateStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  REVISION_REQUIRED = 'REVISION_REQUIRED',
  APPROVED = 'APPROVED',
  CONFIRMED = 'CONFIRMED',
  CONVERTED = 'CONVERTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

// ─── Project Status ──────────────────────────────────────────────────────────
export enum ProjectStatus {
  DRAFT = 'DRAFT',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  APPROVED = 'APPROVED',
  PLANNED = 'PLANNED',
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  UNDER_REVIEW = 'UNDER_REVIEW',
  COMPLETED = 'COMPLETED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
  ARCHIVED = 'ARCHIVED',
}

// ─── Stage Status ────────────────────────────────────────────────────────────
export enum StageStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  UNDER_REVIEW = 'UNDER_REVIEW',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// ─── Task Status ─────────────────────────────────────────────────────────────
export enum TaskStatus {
  DRAFT = 'DRAFT',
  NOT_STARTED = 'NOT_STARTED',
  READY = 'READY',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  SUBMITTED_FOR_REVIEW = 'SUBMITTED_FOR_REVIEW',
  REVISION_REQUIRED = 'REVISION_REQUIRED',
  APPROVED = 'APPROVED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// ─── Task Priority ───────────────────────────────────────────────────────────
export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// ─── Time Entry Status ───────────────────────────────────────────────────────
export enum TimeEntryStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  RETURNED = 'RETURNED',
}

// ─── Time Entry Source ───────────────────────────────────────────────────────
export enum TimeEntrySource {
  TIMER = 'TIMER',
  MANUAL = 'MANUAL',
  IMPORT = 'IMPORT',
  CORRECTION = 'CORRECTION',
}

// ─── Timer Status ────────────────────────────────────────────────────────────
export enum TimerStatus {
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  STOPPED = 'STOPPED',
}

// ─── Timesheet Status ────────────────────────────────────────────────────────
export enum TimesheetStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  RETURNED = 'RETURNED',
  RESUBMITTED = 'RESUBMITTED',
  LOCKED = 'LOCKED',
}

// ─── Expense Status ──────────────────────────────────────────────────────────
export enum ExpenseStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REIMBURSED = 'REIMBURSED',
}

// ─── Document Review Status ──────────────────────────────────────────────────
export enum DocumentRevisionStatus {
  DRAFT = 'DRAFT',
  UNDER_REVIEW = 'UNDER_REVIEW',
  REVISION_REQUIRED = 'REVISION_REQUIRED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUPERSEDED = 'SUPERSEDED',
  ARCHIVED = 'ARCHIVED',
}

// ─── Opportunity Status ──────────────────────────────────────────────────────
export enum OpportunityStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WON = 'WON',
  LOST = 'LOST',
  ON_HOLD = 'ON_HOLD',
  CANCELLED = 'CANCELLED',
}

// ─── Notification Status ─────────────────────────────────────────────────────
export enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
}

// ─── Task Dependency Type ────────────────────────────────────────────────────
export enum DependencyType {
  FINISH_TO_START = 'FINISH_TO_START',
  START_TO_START = 'START_TO_START',
  FINISH_TO_FINISH = 'FINISH_TO_FINISH',
}

// ─── Engineering Discipline ──────────────────────────────────────────────────
export enum EngineeringDiscipline {
  HVAC = 'HVAC',
  ELECTRICAL = 'ELECTRICAL',
  FIRE_PROTECTION = 'FIRE_PROTECTION',
  PLUMBING = 'PLUMBING',
  CIVIL = 'CIVIL',
  STRUCTURAL = 'STRUCTURAL',
  OTHER = 'OTHER',
}

// ─── Phase 1: Identity & Access Enums ───────────────────────────────────────
export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum PermissionScope {
  OWN = 'OWN',
  TEAM = 'TEAM',
  DEPARTMENT = 'DEPARTMENT',
  ASSIGNED = 'ASSIGNED',
  ALL = 'ALL',
}

// ─── Phase 1: Shared Application Error Codes ─────────────────────────────────
export enum AppErrorCode {
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_ACCOUNT_LOCKED = 'AUTH_ACCOUNT_LOCKED',
  AUTH_TOKEN_REUSED = 'AUTH_TOKEN_REUSED',
  AUTH_MUST_CHANGE_PASSWORD = 'AUTH_MUST_CHANGE_PASSWORD',
  AUTH_TEMP_PASSWORD_EXPIRED = 'AUTH_TEMP_PASSWORD_EXPIRED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  ROLE_PROTECTED_CANNOT_DELETE = 'ROLE_PROTECTED_CANNOT_DELETE',
  ROLE_CANNOT_DEACTIVATE_ASSIGNED = 'ROLE_CANNOT_DEACTIVATE_ASSIGNED',
  LAST_ADMIN_PROTECTED = 'LAST_ADMIN_PROTECTED',
  PASSWORD_REUSE_FORBIDDEN = 'PASSWORD_REUSE_FORBIDDEN',
  PASSWORD_POLICY_VIOLATION = 'PASSWORD_POLICY_VIOLATION',
  EMPLOYEE_CODE_ALREADY_EXISTS = 'EMPLOYEE_CODE_ALREADY_EXISTS',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  SELF_APPROVAL_FORBIDDEN = 'SELF_APPROVAL_FORBIDDEN',
}

