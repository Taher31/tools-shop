-- Provision the Toolshop role and database on the shared PostgreSQL instance.
-- Run as the postgres superuser, with psql variables supplied by the caller:
--
--   psql -v ON_ERROR_STOP=1 -v db_name=toolshop -v db_user=toolshop \
--        -v db_password='...' -U postgres
--
-- Safe to rerun: it creates the role/database when missing and resets the
-- role password to the value in .env.

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'db_user', :'db_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'db_user')
\gexec

SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'db_user', :'db_password')
WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'db_user')
\gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'db_name', :'db_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name')
\gexec
