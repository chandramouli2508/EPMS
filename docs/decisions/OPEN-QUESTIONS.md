# EPMS — Open Questions & Technical Assumptions

This document tracks ambiguous requirements, conflicting specifications, and design questions identified during development, alongside our recommended default decisions. Per our project governance, we proceed with recommended defaults marked as assumptions until the Product Owner confirms or overrides them.

---

### Question 1: Document & Drawing Object Storage Provider
- **Context:** The consultancy produces engineering drawings (CAD, PDF) and reports across 500–600 projects annually. Hosting provider is not yet finalized.
- **Recommended Default:** Provide an abstract `StorageProvider` interface. Use local filesystem / MinIO during local development, and configure an S3-compatible cloud object store (AWS S3, Cloudflare R2, or Google Cloud Storage) in production.
- **Current Assumption:** In Phase 0, storage is restricted to an interface contract with zero provider-specific SDK lock-in.

---

### Question 2: Email & Notification Dispatch Provider
- **Context:** User password reset, timesheet approval reminders, and project milestone notifications require email delivery.
- **Recommended Default:** Use an abstract `EmailService` with an SMTP/Console logger for development and test environments, and an enterprise transactional email provider (SendGrid, Postmark, or AWS SES) for production.
- **Current Assumption:** Local dev logs transactional emails to console in development.

---

### Question 3: Timesheet Cutoff & Submission Frequency
- **Context:** Engineers log billable and non-billable hours across HVAC, Electrical, Plumbing, Fire Protection, Structural, and Civil projects.
- **Recommended Default:** Weekly submission cycle with Sunday 23:59 cutoff. On Monday morning, project managers receive approval digests, and unsubmitted timesheets trigger gentle reminders.
- **Current Assumption:** Timesheet entry is modeled on a weekly calendar basis (Monday through Sunday).

---

### Question 4: Project Financials & Currency
- **Context:** Some consultancy clients may be regional or international.
- **Recommended Default:** Default to single base currency (USD / local currency) in Phase 1–3, storing financial amounts as integer cents (`BigInt` / cents) to prevent floating-point rounding errors. Multi-currency exchange rate conversions deferred to subsequent phases.
- **Current Assumption:** All monetary values stored as exact integers in the primary operational currency.

---

### Question 5: Engineering Discipline & RBAC Mapping
- **Context:** The consultancy operates 6 core engineering teams with approximately 50 employees total.
- **Recommended Default:** Standard RBAC with 6 foundational roles: `ADMIN`, `EXECUTIVE`, `PROJECT_MANAGER`, `LEAD_ENGINEER`, `ENGINEER`, `FINANCE`. Each user is tagged with their primary discipline (`HVAC`, `ELECTRICAL`, `PLUMBING`, `FIRE_PROTECTION`, `STRUCTURAL`, `CIVIL`).
- **Current Assumption:** Project access is assigned per project team rather than strict discipline siloing, enabling multidisciplinary project staffing.
