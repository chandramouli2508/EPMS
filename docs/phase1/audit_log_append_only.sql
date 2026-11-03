-- EPMS Phase 1: make audit_logs append-only at the database level (FRD FR-244).
-- Put this in a custom Prisma migration:
--   npx prisma migrate dev --create-only --name audit_log_append_only
-- then paste the SQL below into the generated migration.sql and run `npx prisma migrate dev`.
--
-- Notes:
-- * e2e tests must reset the test database with `prisma migrate reset`, never TRUNCATE all tables.
-- * A future audit-retention job will need an explicit, reviewed purge procedure.

CREATE OR REPLACE FUNCTION audit_logs_block_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_block_changes();

CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_block_changes();
