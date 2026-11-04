// EPMS Phase 1 seed: permission catalog, default role templates, bootstrap admin.
// Safe to run repeatedly (idempotent). Never overwrites grants an admin has changed.
// Requires SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env.

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import { PrismaClient, PermissionScope as S } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// module -> action -> description. Permission key = "module.action".
// Scope meaning for `create` permissions: where the person may create
// (ALL = anywhere, ASSIGNED = inside their projects).
// `delete` is allowed only for drafts / records with no history; otherwise archive or cancel.
const CATALOG: Record<string, Record<string, string>> = {
  employees:    { view: 'View employees', view_sensitive: 'View sensitive employee details', create: 'Create employees', edit: 'Edit employees', deactivate: 'Deactivate or reactivate employees' },
  users:        { view: 'View accounts and sessions', assign_roles: 'Assign roles', reset_password: 'Reset passwords', unlock: 'Unlock accounts', revoke_sessions: 'Revoke sessions' },
  roles:        { view: 'View roles', create: 'Create or duplicate roles', edit: 'Edit role permissions', deactivate: 'Deactivate roles' },
  organization: { view: 'View departments, teams, designations', create: 'Create', edit: 'Edit', deactivate: 'Deactivate' },
  settings:     { view: 'View system settings', configure: 'Configure system settings and notifications' },
  masterdata:   { view: 'View master data', manage: 'Manage statuses, priorities, categories, stage templates' },
  workflows:    { configure: 'Configure approval workflows' },
  calendars:    { view: 'View calendars', manage: 'Manage working calendars and holidays' },
  audit:        { view: 'View and search audit logs', export: 'Export audit logs' },
  imports:      { run: 'Run data imports' },
  clients:      { view: 'View clients', create: 'Create clients', edit: 'Edit clients', deactivate: 'Deactivate clients', archive: 'Archive clients', delete: 'Delete unlinked clients' },
  opportunities:{ view: 'View opportunities', create: 'Create opportunities', edit: 'Edit opportunities', delete: 'Delete draft opportunities' },
  estimates:    { view: 'View estimates', create: 'Create estimates', edit: 'Edit estimates', delete: 'Delete draft estimates', submit: 'Submit for approval', approve: 'Approve estimates', reject: 'Reject estimates', convert: 'Convert estimate to project' },
  projects:     { view: 'View projects', create: 'Create projects', edit: 'Edit projects', delete: 'Delete draft projects', change_status: 'Change project status', hold: 'Hold and resume projects', assign: 'Assign teams and employees', close: 'Close projects', archive: 'Archive projects' },
  baselines:    { view: 'View baselines', request_change: 'Request baseline change', approve_change: 'Approve baseline change' },
  stages:       { view: 'View stages', create: 'Create stages', edit: 'Edit stage plans and dates', delete: 'Delete stages', approve: 'Approve stage gates', override: 'Approve stage exceptions' },
  schedule:     { view: 'View project schedule and timeline', edit: 'Edit schedule: dates and cross-team dependencies' },
  tasks:        { view: 'View tasks', create: 'Create tasks', edit: 'Edit tasks (dates, details)', delete: 'Delete tasks', assign: 'Assign tasks', update_progress: 'Update own task progress', submit: 'Submit task for review', approve: 'Approve tasks', reject: 'Reject or return tasks', close: 'Close or cancel tasks', override_dependency: 'Start task despite incomplete predecessors' },
  workload:     { view: 'View employee workload and assignments' },
  time:         { view: 'View time entries', enter: 'Enter time (timer or manual)', delete: 'Delete own draft entries', correct: 'Correct submitted or approved entries', manage_timers: 'Resolve forgotten or long timers', enter_on_behalf: 'Enter time for another employee', verify_billable: 'Verify billable / non-billable time' },
  timesheets:   { view: 'View timesheets', submit: 'Submit own timesheet', review: 'Review timesheets', approve: 'Approve timesheets', reject: 'Reject timesheets', reopen: 'Reopen approved timesheets', finalize: 'Lock or finalize timesheets' },
  expenses:     { view: 'View expenses', create: 'Create expenses', edit: 'Edit own draft expenses', delete: 'Delete own draft expenses', approve: 'Approve expenses', reject: 'Reject expenses', correct: 'Correct or reverse approved expenses' },
  documents:    { view: 'View documents', upload: 'Upload documents', edit: 'Edit document records', delete: 'Delete non-approved documents', download: 'Download documents', view_confidential: 'View confidential documents' },
  deliverables: { approve: 'Approve deliverables', reject: 'Reject deliverables' },
  finance:      { view: 'View financial information', 'rates.view': 'View labor-cost rates', 'rates.manage': 'Maintain labor-cost rates', adjust: 'Record financial adjustments', export: 'Export financial reports' },
  reports:      { view: 'View reports and dashboards', export: 'Export reports' },
};

const SENSITIVE_KEYS = new Set(['audit.export', 'employees.view_sensitive', 'documents.view_confidential']);

type RoleDef = {
  name: string;
  description: string;
  grants: Partial<Record<keyof typeof S, string[]>>;
};

// Default role TEMPLATES (FRD section 5): editable by an administrator afterwards.
// Leaders, PMs and coordinators should ALSO be assigned EMPLOYEE (multiple roles are supported).
const ROLES: Record<string, RoleDef> = {
  SYSTEM_ADMIN: {
    name: 'System Administrator',
    description: 'Full application access, including role and user administration.',
    grants: {
      ALL: [
        'employees.view', 'employees.view_sensitive', 'employees.create', 'employees.edit', 'employees.deactivate',
        'users.view', 'users.assign_roles', 'users.reset_password', 'users.unlock', 'users.revoke_sessions',
        'roles.view', 'roles.create', 'roles.edit', 'roles.deactivate',
        'organization.view', 'organization.create', 'organization.edit', 'organization.deactivate',
        'settings.view', 'settings.configure', 'masterdata.view', 'masterdata.manage', 'workflows.configure',
        'calendars.view', 'calendars.manage', 'audit.view', 'audit.export', 'imports.run',
      ],
    },
  },
  MANAGEMENT: {
    name: 'Management',
    description: 'Organization-wide visibility; approves designated estimates and baseline changes.',
    grants: {
      ALL: [
        'clients.view', 'opportunities.view', 'estimates.view', 'estimates.approve', 'estimates.reject',
        'projects.view', 'baselines.view', 'baselines.approve_change', 'stages.view', 'schedule.view', 'tasks.view',
        'workload.view', 'time.view', 'timesheets.view', 'timesheets.reopen', 'expenses.view', 'documents.view',
        'finance.view', 'finance.export', 'reports.view', 'reports.export',
        'employees.view', 'organization.view', 'calendars.view',
      ],
    },
  },
  PROJECT_MANAGER: {
    name: 'Project Manager',
    description: 'Owns the project: budget, baseline, status, closure. Also assign EMPLOYEE.',
    grants: {
      ALL: [
        'projects.create', 'estimates.view', 'estimates.convert', 'clients.view', 'opportunities.view',
        'employees.view', 'organization.view', 'calendars.view',
      ],
      OWN: ['estimates.create', 'estimates.edit', 'estimates.submit'],
      ASSIGNED: [
        'projects.view', 'projects.edit', 'projects.change_status', 'projects.hold', 'projects.assign', 'projects.close',
        'baselines.view', 'baselines.request_change',
        'stages.view', 'stages.create', 'stages.edit', 'stages.delete', 'stages.approve', 'stages.override',
        'schedule.view', 'schedule.edit',
        'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign', 'tasks.approve', 'tasks.reject',
        'tasks.close', 'tasks.override_dependency',
        'workload.view', 'time.view', 'time.correct', 'time.manage_timers',
        'timesheets.view', 'timesheets.review',
        'expenses.view', 'expenses.approve', 'expenses.reject',
        'documents.view', 'documents.upload', 'documents.edit', 'documents.delete', 'documents.download',
        'deliverables.approve', 'deliverables.reject', 'finance.view', 'reports.view', 'reports.export',
      ],
    },
  },
  PROJECT_COORDINATOR: {
    name: 'Project Coordinator',
    description:
      'Coordinates all discipline teams on a project: cross-team schedule, dependencies, task assignment. Also assign EMPLOYEE.',
    grants: {
      ALL: ['organization.view', 'calendars.view'],
      ASSIGNED: [
        'projects.view', 'baselines.view', 'stages.view', 'stages.edit', 'schedule.view', 'schedule.edit',
        'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.assign', 'workload.view', 'time.view',
        'timesheets.view', 'timesheets.review', 'documents.view', 'documents.upload', 'documents.download',
        'reports.view', 'employees.view',
      ],
    },
  },
  TEAM_LEADER: {
    name: 'Team Leader',
    description: "Manages one team's work, workload and timesheets. Also assign EMPLOYEE.",
    grants: {
      ALL: ['organization.view', 'calendars.view'],
      ASSIGNED: ['projects.view', 'stages.view', 'schedule.view', 'documents.view', 'documents.upload', 'documents.download'],
      TEAM: [
        'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.assign', 'tasks.approve', 'tasks.reject', 'workload.view',
        'time.view', 'time.correct', 'time.manage_timers',
        'timesheets.view', 'timesheets.review', 'timesheets.approve', 'timesheets.reject',
        'deliverables.approve', 'deliverables.reject', 'employees.view', 'reports.view',
      ],
    },
  },
  EMPLOYEE: {
    name: 'Employee / Engineer',
    description: 'Own work: tasks, time, timesheets, expenses, documents.',
    grants: {
      ALL: ['calendars.view'],
      ASSIGNED: ['projects.view', 'stages.view', 'documents.view', 'documents.upload', 'documents.download'],
      OWN: [
        'tasks.view', 'tasks.update_progress', 'tasks.submit',
        'time.view', 'time.enter', 'time.delete',
        'timesheets.view', 'timesheets.submit',
        'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.delete',
        'employees.view', 'reports.view',
      ],
    },
  },
  FINANCE: {
    name: 'Finance Personnel',
    description: 'Budgets, labor-cost rates, expenses, billable time, profitability.',
    grants: {
      ALL: [
        'projects.view', 'clients.view', 'estimates.view', 'baselines.view', 'time.view', 'time.verify_billable',
        'timesheets.view', 'timesheets.finalize', 'expenses.view', 'expenses.approve', 'expenses.reject', 'expenses.correct',
        'finance.view', 'finance.rates.view', 'finance.rates.manage', 'finance.adjust', 'finance.export',
        'reports.view', 'reports.export', 'employees.view', 'calendars.view',
      ],
    },
  },
};

async function main() {
  // 1. Permission catalog
  for (const [module, actions] of Object.entries(CATALOG)) {
    for (const [action, description] of Object.entries(actions)) {
      const key = `${module}.${action}`;
      const isSensitive = module === 'finance' || SENSITIVE_KEYS.has(key);
      await prisma.permission.upsert({
        where: { key },
        update: { description, isSensitive },
        create: { key, module, action, description, isSensitive },
      });
    }
  }

  // 2. Default roles and grants (fails loudly if a key is not in the catalog)
  for (const [code, def] of Object.entries(ROLES)) {
    const role = await prisma.role.upsert({
      where: { code },
      update: {},
      create: { code, name: def.name, description: def.description, isSystem: true },
    });
    for (const [scope, keys] of Object.entries(def.grants)) {
      for (const key of keys ?? []) {
        const permission = await prisma.permission.findUniqueOrThrow({ where: { key } });
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          update: {}, // never overwrite what an admin has changed
          create: { roleId: role.id, permissionId: permission.id, scope: scope as S },
        });
      }
    }
  }

  // 3. Bootstrap administrator (credentials come from env, never hard-coded)
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env before seeding.');
  }

  const admin = await prisma.employee.upsert({
    where: { email },
    update: {},
    create: {
      employeeCode: 'EMP-0001',
      fullName: 'System Administrator',
      email,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      mustChangePassword: true,
    },
  });
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'SYSTEM_ADMIN' } });
  await prisma.employeeRole.upsert({
    where: { employeeId_roleId: { employeeId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { employeeId: admin.id, roleId: adminRole.id },
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
