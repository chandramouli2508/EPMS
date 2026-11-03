# Run the whole EPMS in Docker

Run commands from the repository root using Docker Desktop with Linux containers and Docker Compose v2.

## First start

Keep your existing root `.env`. If it does not exist, copy `.env.example` to `.env`, set your administrator credentials, and generate real JWT keys:

```powershell
Copy-Item .env.example .env
node scripts/generate-jwt-keys.js
```

Only run key generation for initial setup or intentional key rotation; it replaces existing keys. Never copy the example over an existing `.env`.

```powershell
docker compose up -d --build
docker compose ps -a
```

Open **http://localhost:8080**. Frontend routes, `/api/v1` requests, and refresh cookies share that origin. Local Swagger is at http://localhost:8080/api/docs.

Compose starts PostgreSQL, applies existing Prisma migrations through a one-shot `migrate` container, starts the compiled NestJS API and Redis, and serves the compiled React app through Nginx. An exited migration container with code 0 is expected. Existing named database/Redis volumes are preserved.

On a fresh database, create the initial administrator after startup:

```powershell
docker compose exec -w /app api npm run prisma:seed --workspace=apps/api
```

The seed uses `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from the root `.env`. Log in with those credentials and complete the required password change. Seeding is explicit because repeating it can restore deleted default grants.

## Configuration

The root `.env` supplies JWT keys, administrator seed credentials, and authentication policies at runtime. Environment files are excluded from image builds. Compose overrides the database and Redis addresses to their Docker service names; `localhost` inside a container refers to that container.

The existing local database credentials and database name remain unchanged. The API is available internally on port 3000; all browser traffic goes through Nginx on port 8080. PostgreSQL and Redis keep their existing loopback host ports for local tools.

Optional root `.env` settings:

```dotenv
WEB_PORT=8080
DOCKER_APP_URL=http://localhost:8080
DOCKER_NODE_ENV=development
```

If you change `WEB_PORT`, also change `DOCKER_APP_URL` to the exact browser origin. These Docker-specific variables avoid overwriting the existing host-development `APP_URL` and `NODE_ENV`.

Local Docker defaults to development environment behavior so plain HTTP refresh cookies work and Swagger is available, while running compiled application bundles. For a public deployment, terminate HTTPS at your ingress/proxy, set `DOCKER_NODE_ENV=production`, and set `DOCKER_APP_URL` to the HTTPS origin. Production enables Secure refresh cookies and disables Swagger. This Compose configuration is a local full-stack setup, not a complete public hosting configuration.

## Everyday commands

```powershell
# Rebuild and apply code changes; source is not bind-mounted.
docker compose up -d --build

# Inspect logs and service health.
docker compose logs --tail=100 api web migrate
docker compose ps -a

# Stop the stack while retaining database data.
docker compose down
```

Use the root `docker-compose.yml`. The older file under `infrastructure/docker` starts only infrastructure and is not the full-stack entry point. Stop any separately launched API/frontend processes if you no longer need them. Do not use `docker compose down -v` unless you intentionally want to delete stored data.

## Image details and validation

The root Dockerfile installs Linux dependencies from the lockfile, generates Prisma Client, builds shared contracts before the API, builds the web app, and defines separate `api` and `web` targets. The web image contains Nginx and static assets. The API target retains build tooling to support Prisma migrations and explicit TypeScript seeding.

Useful validation commands:

```powershell
docker compose config --quiet
docker compose up -d --build --wait
Invoke-WebRequest http://localhost:8080/api/v1/health/ready
Invoke-WebRequest http://localhost:8080/login
```

Startup dependency conditions follow the [Docker Compose startup-order documentation](https://docs.docker.com/compose/how-tos/startup-order/).
