# Toolshop on the zardasht host

This bundle runs the Toolshop storefront and admin panel on the existing
`zardasht` Docker host. It follows that host's conventions: external `proxy`
and `database` networks, an external Traefik, pinned images, read-only
containers, resource limits under `workloads.slice`, and no published ports.

## What gets deployed

| Service   | Image                | Purpose                      | Memory |
| --------- | -------------------- | ---------------------------- | ------ |
| `web`     | `toolshop-web`       | Next.js storefront and admin | 320 MB |
| `api`     | `toolshop-api`       | NestJS REST API              | 320 MB |
| `migrate` | `toolshop-api-tools` | One-off Prisma migration job | 256 MB |
| `seed`    | `toolshop-api-tools` | One-off demo-data seed job   | 256 MB |

The host's shared **PostgreSQL** is used through the external `database`
network. Each app gets its own role and database.

**Redis is not part of this compose project.** The API needs it for cache, rate
limits and BullMQ, so a shared Redis instance must exist before deployment and
`REDIS_URL` must point at it. The `zardasht` host did not have a Redis container
at the time this bundle was written; provision one outside this project (for
example as shared infrastructure on the `database` network) or use an external
Redis service.

**Meilisearch is not deployed.** The API stays functional and falls back to
database search; it logs a warning at startup. This saves memory on the 1 vCPU
host. Add Meilisearch later only after measuring free memory.

## First deployment

### 1. Build a release

The images must be built on a machine with enough memory. Build them with the
`Release` workflow in GitHub Actions:

```bash
gh workflow run release.yml \
  --ref main \
  -f version=v1.0.0 \
  -f site_url=https://shop.155.117.234.45.sslip.io
```

The workflow runs the full CI suite, builds `linux/amd64` images, boots them
against real PostgreSQL and Redis, publishes them to GHCR, and attaches
`toolshop-*.tar.gz` plus `SHA256SUMS` to the GitHub Release.

Download the tested tarballs:

```bash
mkdir -p images
gh release download v1.0.0 --pattern '*.tar.gz' --dir images
gh release download v1.0.0 --pattern 'SHA256SUMS' --dir images
(cd images && sha256sum -c SHA256SUMS)
```

### 2. Create the app directory and data

Run these on the host. The app directory and `.env` are root-owned; the
containers run as their image users, so the bind mounts need matching owners.

```bash
sudo install -d -m 0755 /srv/apps/toolshop
sudo install -d -m 0755 /srv/data/toolshop
sudo install -d -m 0750 -o 1000 -g 1000 /srv/data/toolshop/uploads
sudo install -d -m 0750 -o 1000 -g 1000 /srv/data/toolshop/next-cache
```

Copy this bundle to `/srv/apps/toolshop/`, then:

```bash
cd /srv/apps/toolshop
sudo cp .env.example .env
sudo chmod 600 .env
```

Fill in `.env`:

- Generate each `__GENERATE_*__` value with `openssl rand -hex 32` (or the
  matching command in the file's comment).
- Keep `APP_DB_PASSWORD` and `DATABASE_URL` in sync.
- Point `REDIS_URL` at the shared Redis instance and put its password in the URL.
- Set a strong `SEED_ADMIN_PASSWORD`.
- `NEXT_PUBLIC_SITE_URL`, `API_INTERNAL_URL` and `STORAGE_PUBLIC_BASE_URL` are
  baked into the web image. If you change them, rebuild the web image.
- `APP_DOMAIN`, `APP_PUBLIC_URL` and `CORS_ORIGINS` can be changed by editing
  `.env` and restarting the web container.

### 3. Load the images

Copy the tarballs to the host (this host does not allow `scp`; stream a tar):

```bash
ssh -p 9011 darius@155.117.234.45 'mkdir -p /tmp/toolshop-images'
tar -C images -cf - . | ssh -p 9011 darius@155.117.234.45 'tar -xf - -C /tmp/toolshop-images'
```

Then load them as root and remove the temporary files:

```bash
sudo docker load -i /tmp/toolshop-images/toolshop-api-1.0.0.tar.gz
sudo docker load -i /tmp/toolshop-images/toolshop-web-1.0.0.tar.gz
sudo docker load -i /tmp/toolshop-images/toolshop-api-tools-1.0.0.tar.gz
rm -rf /tmp/toolshop-images /tmp/toolshop-images.tar
```

### 4. Provision the database

Run the idempotent init script through the shared PostgreSQL container. The
values come from `.env`; the password is not printed.

```bash
cd /srv/apps/toolshop
sudo sh -c '
  set -a
  . ./.env
  set +a
  docker exec -i -e PGPASSWORD="$(docker exec postgres printenv POSTGRES_PASSWORD)" postgres \
    psql -U postgres -v ON_ERROR_STOP=1 \
      -v db_name="$APP_DB_NAME" -v db_user="$APP_DB_USER" -v db_password="$APP_DB_PASSWORD" \
      < db/init.sql
'
```

### 5. Migrate, seed, start

```bash
cd /srv/apps/toolshop
sudo docker compose config -q
sudo docker compose --profile tools run --rm migrate
sudo docker compose --profile tools run --rm seed   # demo data; optional
sudo docker compose up -d
sudo docker compose ps
```

The `seed` command creates the admin account from `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD`, plus sample products, orders and customers. In
`NODE_ENV=production` it creates only the admin staff account; the demo staff
accounts are skipped. The demo customer account is still created with a fixed
demo password, so treat this as a demo installation until the seed policy is
changed.

### 6. Verify

```bash
curl -sk -H 'Host: shop.155.117.234.45.sslip.io' https://127.0.0.1/ -o /dev/null -w '%{http_code}\n'
```

Expected: `200` from the storefront, or `502`/`503` while the certificate is
being issued or the web container is still starting. Check the containers:

```bash
sudo docker compose ps
sudo docker compose logs --tail 50 web api
```

On first request Traefik obtains a Let's Encrypt certificate for the sslip.io
hostname through its HTTP-01 resolver. No DNS change is needed for
`shop.155.117.234.45.sslip.io`. For a real domain, add a DNS record pointing to
the host and change `APP_DOMAIN`, `APP_PUBLIC_URL`, `CORS_ORIGINS` and
`NEXT_PUBLIC_SITE_URL`; rebuild the web image for the last one.

## Updating

1. Build and publish a new version (`v1.0.1`).
2. Load the new image tarballs with `docker load`.
3. Update the three `APP_*_IMAGE` tags in `/srv/apps/toolshop/.env`.
4. Run migrations, then recreate the app containers:

```bash
cd /srv/apps/toolshop
sudo docker compose --profile tools run --rm migrate
sudo docker compose up -d --no-deps api web
```

Keep the previous image tags in `.env` so a rollback is a tag change away.
Database migrations are forward-only; take a database dump before upgrading.

## Rollback

```bash
cd /srv/apps/toolshop
# Set APP_API_IMAGE / APP_WEB_IMAGE back to the previous tags.
sudo docker compose up -d --no-deps api web
```

If the previous release cannot run against the migrated schema, restore the
PostgreSQL dump and the previous image tags together.

## Backups

Toolshop state is:

- PostgreSQL database `toolshop`
- `/srv/data/toolshop/uploads`

Redis is shared infrastructure and is not part of this app's backup set.

The host backup script pulls every PostgreSQL database and `/srv`; confirm the
new database and data directory are included before relying on it. A logical
database dump is the minimum before every upgrade:

```bash
docker exec -e PGPASSWORD="$(docker exec postgres printenv POSTGRES_PASSWORD)" postgres \
  pg_dump -U postgres -Fc toolshop > /path/off/server/toolshop.dump
```

## Resource notes

- Limits: API 320 MB and web 320 MB. The shared Redis adds its own usage outside
  this project. The host has roughly 780 MB free RAM and 1.4 GB free swap, so
  watch `docker stats` after the first start.
- The app containers are read-only. Uploads and Next.js cache are the only
  writable mounts.
- No Meilisearch container runs. Search falls back to PostgreSQL.
- `PAYMENT_ALLOW_MOCK_IN_PRODUCTION=true` is for the demo. A real shop needs a
  payment gateway adapter and this flag turned off.
- AI features, Telegram and Bale bots stay disabled until their keys are set in
  the admin panel or `.env`.
