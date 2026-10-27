# Kasa API

The backend for [Kasa](../kasa), which teaches Twi and Ga on the GES curriculum (Basic 1 to SHS 3). It is built
with Django 6 and Django REST Framework, uses PostgreSQL and Redis in production, and calls GhanaNLP's Khaya AI for
translation and pronunciation.

The API implements the contract in `../kasa/docs/api-contract.md`. The web app validates every response against it,
so the two can't drift apart unnoticed.

## Quick start

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env                       # SQLite + offline Khaya samples by default
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_demo       # curriculum + sample accounts (password: demo1234)
.venv/bin/python manage.py runserver 8000
```

Then run the web app against it:

```bash
cd ../kasa/frontend
VITE_USE_MOCKS=false VITE_SHOW_DEMO=true npm run dev   # /api is proxied to :8000
```

### Useful URLs

| URL | What |
| --- | --- |
| `/api/docs/` | Interactive API docs (OpenAPI) |
| `/api/health/` | Health check for load balancers |
| `/django-admin/` | Django admin for the curriculum team and staff |

You can sign in to the Django admin as `efua.asante@example.com` / `demo1234`.

### Sample accounts

| Email | Role |
| --- | --- |
| ama.mensah@example.com | JHS 1 student with a few days of progress |
| kojo.boateng@example.com | Verified teacher, owner of the "Asafo JHS 1B Twi" class (code `ASF-7B`) |
| yaw.darko@example.com | Moderator |
| efua.asante@example.com | Admin |

## Production-like stack

```bash
docker compose up --build                  # API + PostgreSQL 17 + Redis 7 on :8000
docker compose exec api python manage.py seed_demo --curriculum-only
```

Scale horizontally by running more `api` replicas behind a load balancer. The app servers keep no state, because
sessions are tokens, the cache is in Redis, and data is in PostgreSQL. Pronunciation audio is cached on disk under
`MEDIA_ROOT/tts-cache`, so mount shared storage (or switch to S3) when you run more than one replica.

## Project layout

```
config/            settings (all from env vars), URLs
apps/
  core/            errors, permissions, child-safety filter, pagination, seed command, health check
  accounts/        users (email login, roles), auth tokens, profile
  curriculum/      units, words and phrases, recordings, daily proverb, GES levels
  learning/        spaced repetition, attempts (idempotent), streaks, XP, badges, leaderboards
  translate/       lookup (curriculum, then verified, then Khaya), suggestions, Khaya text-to-speech proxy
  community/       communities, memberships and roles, threads, replies, votes, reports, audit log
  notifications/   in-app notifications
  staff/           community admin API: overview, report queue, translations, users, community approvals
```

## Conventions

- **JSON field names.** JSON is camelCase on the wire and snake_case in Python
  (`djangorestframework-camel-case`).
- **Errors.** Errors are `{"detail": "..."}` or `{"field": ["..."]}`. Learners see these messages exactly as
  written, so keep them plain, specific and kind.
- **Permissions.**
  - Platform roles are student, teacher, moderator and admin.
  - Community roles are owner, admin, helper and member.
  - Community admins must be adults: teachers or Kasa staff.
  - Students never get the power to remove posts or members.
- **Child safety.** `apps/core/safety.py` blocks phone numbers, emails, links and insults in anything learners
  post. It mirrors the frontend's filter.
- **Offline-first clients.** Practice attempts carry a `clientId`, so retries never double-count.
- **Khaya key.** The Khaya key stays on the server. Without `KHAYA_API_KEY`, lookup falls back to a few offline
  samples and text-to-speech returns 503 with a friendly message.

## Checks

```bash
.venv/bin/ruff check . && .venv/bin/ruff format --check .
.venv/bin/python manage.py makemigrations --check --dry-run
.venv/bin/pytest
```

The web app's end-to-end tests also run against this API:

```bash
.venv/bin/python manage.py seed_demo --reset && .venv/bin/python manage.py runserver 8000 &
cd ../kasa/frontend && E2E_REAL_API=1 npx playwright test
```
