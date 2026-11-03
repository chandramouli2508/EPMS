"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppErrorCode = exports.PermissionScope = exports.EmployeeStatus = exports.EngineeringDiscipline = exports.DependencyType = exports.NotificationStatus = exports.OpportunityStatus = exports.DocumentRevisionStatus = exports.ExpenseStatus = exports.TimesheetStatus = exports.TimerStatus = exports.TimeEntrySource = exports.TimeEntryStatus = exports.TaskPriority = exports.TaskStatus = exports.StageStatus = exports.ProjectStatus = exports.EstimateStatus = void 0;
// ─── Estimate Status ─────────────────────────────────────────────────────────
var EstimateStatus;
(function (EstimateStatus) {
    EstimateStatus["DRAFT"] = "DRAFT";
    EstimateStatus["SUBMITTED"] = "SUBMITTED";
    EstimateStatus["UNDER_REVIEW"] = "UNDER_REVIEW";
    EstimateStatus["REVISION_REQUIRED"] = "REVISION_REQUIRED";
    EstimateStatus["APPROVED"] = "APPROVED";
    EstimateStatus["CONFIRMED"] = "CONFIRMED";
    EstimateStatus["CONVERTED"] = "CONVERTED";
    EstimateStatus["REJECTED"] = "REJECTED";
    EstimateStatus["CANCELLED"] = "CANCELLED";
})(EstimateStatus || (exports.EstimateStatus = EstimateStatus = {}));
// ─── Project Status ──────────────────────────────────────────────────────────
var ProjectStatus;
(function (ProjectStatus) {
    ProjectStatus["DRAFT"] = "DRAFT";
    ProjectStatus["AWAITING_APPROVAL"] = "AWAITING_APPROVAL";
    ProjectStatus["APPROVED"] = "APPROVED";
    ProjectStatus["PLANNED"] = "PLANNED";
    ProjectStatus["NOT_STARTED"] = "NOT_STARTED";
    ProjectStatus["IN_PROGRESS"] = "IN_PROGRESS";
    ProjectStatus["ON_HOLD"] = "ON_HOLD";
    ProjectStatus["UNDER_REVIEW"] = "UNDER_REVIEW";
    ProjectStatus["COMPLETED"] = "COMPLETED";
    ProjectStatus["CLOSED"] = "CLOSED";
    ProjectStatus["CANCELLED"] = "CANCELLED";
    ProjectStatus["ARCHIVED"] = "ARCHIVED";
})(ProjectStatus || (exports.ProjectStatus = ProjectStatus = {}));
// ─── Stage Status ────────────────────────────────────────────────────────────
var StageStatus;
(function (StageStatus) {
    StageStatus["NOT_STARTED"] = "NOT_STARTED";
    StageStatus["IN_PROGRESS"] = "IN_PROGRESS";
    StageStatus["ON_HOLD"] = "ON_HOLD";
    StageStatus["UNDER_REVIEW"] = "UNDER_REVIEW";
    StageStatus["COMPLETED"] = "COMPLETED";
    StageStatus["CANCELLED"] = "CANCELLED";
})(StageStatus || (exports.StageStatus = StageStatus = {}));
// ─── Task Status ─────────────────────────────────────────────────────────────
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["DRAFT"] = "DRAFT";
    TaskStatus["NOT_STARTED"] = "NOT_STARTED";
    TaskStatus["READY"] = "READY";
    TaskStatus["IN_PROGRESS"] = "IN_PROGRESS";
    TaskStatus["ON_HOLD"] = "ON_HOLD";
    TaskStatus["SUBMITTED_FOR_REVIEW"] = "SUBMITTED_FOR_REVIEW";
    TaskStatus["REVISION_REQUIRED"] = "REVISION_REQUIRED";
    TaskStatus["APPROVED"] = "APPROVED";
    TaskStatus["COMPLETED"] = "COMPLETED";
    TaskStatus["CANCELLED"] = "CANCELLED";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
// ─── Task Priority ───────────────────────────────────────────────────────────
var TaskPriority;
(function (TaskPriority) {
    TaskPriority["LOW"] = "LOW";
    TaskPriority["MEDIUM"] = "MEDIUM";
    TaskPriority["HIGH"] = "HIGH";
    TaskPriority["CRITICAL"] = "CRITICAL";
})(TaskPriority || (exports.TaskPriority = TaskPriority = {}));
// ─── Time Entry Status ───────────────────────────────────────────────────────
var TimeEntryStatus;
(function (TimeEntryStatus) {
    TimeEntryStatus["DRAFT"] = "DRAFT";
    TimeEntryStatus["SUBMITTED"] = "SUBMITTED";
    TimeEntryStatus["APPROVED"] = "APPROVED";
    TimeEntryStatus["RETURNED"] = "RETURNED";
})(TimeEntryStatus || (exports.TimeEntryStatus = TimeEntryStatus = {}));
// ─── Time Entry Source ───────────────────────────────────────────────────────
var TimeEntrySource;
(function (TimeEntrySource) {
    TimeEntrySource["TIMER"] = "TIMER";
    TimeEntrySource["MANUAL"] = "MANUAL";
    TimeEntrySource["IMPORT"] = "IMPORT";
    TimeEntrySource["CORRECTION"] = "CORRECTION";
})(TimeEntrySource || (exports.TimeEntrySource = TimeEntrySource = {}));
// ─── Timer Status ────────────────────────────────────────────────────────────
var TimerStatus;
(function (TimerStatus) {
    TimerStatus["RUNNING"] = "RUNNING";
    TimerStatus["PAUSED"] = "PAUSED";
    TimerStatus["STOPPED"] = "STOPPED";
})(TimerStatus || (exports.TimerStatus = TimerStatus = {}));
// ─── Timesheet Status ────────────────────────────────────────────────────────
var TimesheetStatus;
(function (TimesheetStatus) {
    TimesheetStatus["DRAFT"] = "DRAFT";
    TimesheetStatus["SUBMITTED"] = "SUBMITTED";
    TimesheetStatus["UNDER_REVIEW"] = "UNDER_REVIEW";
    TimesheetStatus["APPROVED"] = "APPROVED";
    TimesheetStatus["REJECTED"] = "REJECTED";
    TimesheetStatus["RETURNED"] = "RETURNED";
    TimesheetStatus["RESUBMITTED"] = "RESUBMITTED";
    TimesheetStatus["LOCKED"] = "LOCKED";
})(TimesheetStatus || (exports.TimesheetStatus = TimesheetStatus = {}));
// ─── Expense Status ──────────────────────────────────────────────────────────
var ExpenseStatus;
(function (ExpenseStatus) {
    ExpenseStatus["DRAFT"] = "DRAFT";
    ExpenseStatus["SUBMITTED"] = "SUBMITTED";
    ExpenseStatus["APPROVED"] = "APPROVED";
    ExpenseStatus["REJECTED"] = "REJECTED";
    ExpenseStatus["REIMBURSED"] = "REIMBURSED";
})(ExpenseStatus || (exports.ExpenseStatus = ExpenseStatus = {}));
// ─── Document Review Status ──────────────────────────────────────────────────
var DocumentRevisionStatus;
(function (DocumentRevisionStatus) {
    DocumentRevisionStatus["DRAFT"] = "DRAFT";
    DocumentRevisionStatus["UNDER_REVIEW"] = "UNDER_REVIEW";
    DocumentRevisionStatus["REVISION_REQUIRED"] = "REVISION_REQUIRED";
    DocumentRevisionStatus["APPROVED"] = "APPROVED";
    DocumentRevisionStatus["REJECTED"] = "REJECTED";
    DocumentRevisionStatus["SUPERSEDED"] = "SUPERSEDED";
    DocumentRevisionStatus["ARCHIVED"] = "ARCHIVED";
})(DocumentRevisionStatus || (exports.DocumentRevisionStatus = DocumentRevisionStatus = {}));
// ─── Opportunity Status ──────────────────────────────────────────────────────
var OpportunityStatus;
(function (OpportunityStatus) {
    OpportunityStatus["OPEN"] = "OPEN";
    OpportunityStatus["IN_PROGRESS"] = "IN_PROGRESS";
    OpportunityStatus["WON"] = "WON";
    OpportunityStatus["LOST"] = "LOST";
    OpportunityStatus["ON_HOLD"] = "ON_HOLD";
    OpportunityStatus["CANCELLED"] = "CANCELLED";
})(OpportunityStatus || (exports.OpportunityStatus = OpportunityStatus = {}));
// ─── Notification Status ─────────────────────────────────────────────────────
var NotificationStatus;
(function (NotificationStatus) {
    NotificationStatus["UNREAD"] = "UNREAD";
    NotificationStatus["READ"] = "READ";
})(NotificationStatus || (exports.NotificationStatus = NotificationStatus = {}));
// ─── Task Dependency Type ────────────────────────────────────────────────────
var DependencyType;
(function (DependencyType) {
    DependencyType["FINISH_TO_START"] = "FINISH_TO_START";
    DependencyType["START_TO_START"] = "START_TO_START";
    DependencyType["FINISH_TO_FINISH"] = "FINISH_TO_FINISH";
})(DependencyType || (exports.DependencyType = DependencyType = {}));
// ─── Engineering Discipline ──────────────────────────────────────────────────
var EngineeringDiscipline;
(function (EngineeringDiscipline) {
    EngineeringDiscipline["HVAC"] = "HVAC";
    EngineeringDiscipline["ELECTRICAL"] = "ELECTRICAL";
    EngineeringDiscipline["FIRE_PROTECTION"] = "FIRE_PROTECTION";
    EngineeringDiscipline["PLUMBING"] = "PLUMBING";
    EngineeringDiscipline["CIVIL"] = "CIVIL";
    EngineeringDiscipline["STRUCTURAL"] = "STRUCTURAL";
    EngineeringDiscipline["OTHER"] = "OTHER";
})(EngineeringDiscipline || (exports.EngineeringDiscipline = EngineeringDiscipline = {}));
// ─── Phase 1: Identity & Access Enums ───────────────────────────────────────
var EmployeeStatus;
(function (EmployeeStatus) {
    EmployeeStatus["ACTIVE"] = "ACTIVE";
    EmployeeStatus["INACTIVE"] = "INACTIVE";
})(EmployeeStatus || (exports.EmployeeStatus = EmployeeStatus = {}));
var PermissionScope;
(function (PermissionScope) {
    PermissionScope["OWN"] = "OWN";
    PermissionScope["TEAM"] = "TEAM";
    PermissionScope["DEPARTMENT"] = "DEPARTMENT";
    PermissionScope["ASSIGNED"] = "ASSIGNED";
    PermissionScope["ALL"] = "ALL";
})(PermissionScope || (exports.PermissionScope = PermissionScope = {}));
// ─── Phase 1: Shared Application Error Codes ─────────────────────────────────
var AppErrorCode;
(function (AppErrorCode) {
    AppErrorCode["AUTH_INVALID_CREDENTIALS"] = "AUTH_INVALID_CREDENTIALS";
    AppErrorCode["AUTH_ACCOUNT_LOCKED"] = "AUTH_ACCOUNT_LOCKED";
    AppErrorCode["AUTH_TOKEN_REUSED"] = "AUTH_TOKEN_REUSED";
    AppErrorCode["AUTH_MUST_CHANGE_PASSWORD"] = "AUTH_MUST_CHANGE_PASSWORD";
    AppErrorCode["AUTH_TEMP_PASSWORD_EXPIRED"] = "AUTH_TEMP_PASSWORD_EXPIRED";
    AppErrorCode["PERMISSION_DENIED"] = "PERMISSION_DENIED";
    AppErrorCode["ROLE_PROTECTED_CANNOT_DELETE"] = "ROLE_PROTECTED_CANNOT_DELETE";
    AppErrorCode["ROLE_CANNOT_DEACTIVATE_ASSIGNED"] = "ROLE_CANNOT_DEACTIVATE_ASSIGNED";
    AppErrorCode["LAST_ADMIN_PROTECTED"] = "LAST_ADMIN_PROTECTED";
    AppErrorCode["PASSWORD_REUSE_FORBIDDEN"] = "PASSWORD_REUSE_FORBIDDEN";
    AppErrorCode["PASSWORD_POLICY_VIOLATION"] = "PASSWORD_POLICY_VIOLATION";
    AppErrorCode["EMPLOYEE_CODE_ALREADY_EXISTS"] = "EMPLOYEE_CODE_ALREADY_EXISTS";
    AppErrorCode["EMAIL_ALREADY_EXISTS"] = "EMAIL_ALREADY_EXISTS";
    AppErrorCode["SELF_APPROVAL_FORBIDDEN"] = "SELF_APPROVAL_FORBIDDEN";
})(AppErrorCode || (exports.AppErrorCode = AppErrorCode = {}));
//# sourceMappingURL=index.js.map