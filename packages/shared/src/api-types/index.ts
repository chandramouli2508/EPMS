// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ─── API Error envelope (mirrors backend GlobalExceptionFilter output) ────────
export interface ApiErrorEnvelope {
  statusCode: number;
  error: string;
  message: string;
  timestamp: string;
  path: string;
  /** Present only on 400 validation errors */
  fieldErrors?: Record<string, string[]>;
}

// ─── Common record timestamps ────────────────────────────────────────────────
export interface Timestamps {
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

// ─── Employee (summary — used in dropdowns, assignee lists, etc.) ─────────────
export interface EmployeeSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  designation?: string;
}

// ─── Client ──────────────────────────────────────────────────────────────────
export interface ClientSummary {
  id: string;
  name: string;
  code?: string;
  status: string;
}

// ─── Project summary ─────────────────────────────────────────────────────────
export interface ProjectSummary {
  id: string;
  code: string;
  name: string;
  status: string;
  clientId: string;
}

// ─── Notification ────────────────────────────────────────────────────────────
export interface NotificationDto {
  id: string;
  recipientId: string;
  title: string;
  body: string;
  resourceType?: string;
  resourceId?: string;
  status: string;
  createdAt: string;
  readAt?: string;
}

// ─── Phase 1: Authentication & User Context ──────────────────────────────────
export interface CurrentUserDto {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  mustChangePassword: boolean;
  departmentId?: string | null;
  designationId?: string | null;
  roles: string[];
  permissions: Record<string, string>; // permissionKey -> PermissionScope string
}

export interface LoginResponseDto {
  accessToken: string;
  user: CurrentUserDto;
}

export interface SessionDto {
  id: string;
  familyId: string;
  issuedAt: string;
  expiresAt: string;
  lastUsedAt?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  isCurrent?: boolean;
}

// ─── Phase 1: Organization DTOs ──────────────────────────────────────────────
export interface DepartmentDto {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  headId?: string | null;
  headName?: string | null;
  isActive: boolean;
  employeeCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DesignationDto {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  employeeCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMemberDto {
  employeeId: string;
  fullName: string;
  email: string;
  employeeCode: string;
  joinedAt: string;
}

export interface TeamDto {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  departmentId: string;
  departmentName?: string;
  leadId?: string | null;
  leadName?: string | null;
  isActive: boolean;
  members?: TeamMemberDto[];
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Phase 1: Employee DTOs ──────────────────────────────────────────────────
export interface EmployeeDto {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone?: string | null;
  status: string;
  dateOfJoining?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  designationId?: string | null;
  designationName?: string | null;
  managerId?: string | null;
  managerName?: string | null;
  roles: string[];
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
  failedLoginAttempts: number;
  lockedUntil?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Phase 1: Roles & Permissions DTOs ───────────────────────────────────────
export interface PermissionDto {
  id: string;
  key: string;
  module: string;
  action: string;
  description: string;
  isSensitive: boolean;
}

export interface RolePermissionGrantDto {
  permissionKey: string;
  scope: string; // OWN | TEAM | DEPARTMENT | ASSIGNED | ALL
  approvalLimit?: number | null;
}

export interface RoleDto {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
  assignedEmployeesCount?: number;
  permissions?: RolePermissionGrantDto[];
  createdAt: string;
  updatedAt: string;
}

// ─── Phase 1: Audit Log DTOs ─────────────────────────────────────────────────
export interface AuditLogDto {
  id: string;
  createdAt: string;
  actorId?: string | null;
  actorLabel?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string | null;
  outcome?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

