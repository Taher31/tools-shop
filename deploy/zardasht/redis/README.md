# Shared Redis for the zardasht host

This is shared infrastructure, not part of the `tools-shop` application
compose file. It listens only on the external `database` Docker network; no
port is published.

## First start

```bash
sudo install -d -m 0750 -o 999 -g 999 /srv/data/redis
sudo install -d -m 0755 /srv/infrastructure/redis
```

Copy `docker-compose.yml` and `.env.example` to `/srv/infrastructure/redis/`,
then create `.env`:

```bash
cd /srv/infrastructure/redis
sudo cp .env.example .env
sudo chmod 600 .env
# Put a generated password in REDIS_PASSWORD:
#   openssl rand -hex 32
sudo docker compose config -q
sudo docker compose up -d
sudo docker compose ps
```

The container is named `redis` on the `database` network, so apps use:

```dotenv
REDIS_URL=redis://:<password>@redis:6379/0
```

## Data and backups

- Persistent data: `/srv/data/redis` (AOF).
- Back it up with the host backup flow if other apps begin storing important
  queue or cache state. Redis is not the source of truth for Toolshop; the
  PostgreSQL database is.
- Memory is capped at 96 MB inside a 128 MB container. `maxmemory-policy` is
  `noeviction` because BullMQ data must not be silently evicted.
