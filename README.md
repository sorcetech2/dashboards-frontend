# SORCE dashboards

The authenticated SORCE customer dashboard. The companion Python data producer
writes per-tenant dashboard JSON and company statistics to the existing
`sorce-dashboard-data` S3 bucket; this app validates and renders those files.

## Local development

Use Node 24.8.x and pnpm 10.13.1 (both are pinned in this repository).

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Open <http://localhost:3000>. Local and test environments use private fixture
paths, never files under `public/`. Configure an ignored hashed user registry as
described in [the user-registry runbook](docs/user-registry.md); plaintext
passwords do not belong in source files.

## Quality checks

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm security:scan-build
pnpm test:e2e
```

The browser suite uses committed synthetic accounts and sanitized dashboard
fixtures. It does not contact AWS.

## Production architecture

- Auth.js reads the private `auth/users.json` object from
  `sorce-dashboard-data`. Credentials are scrypt hashes; only sanitized
  principals enter sessions.
- Tenant records hold explicit legacy-compatible `companies/*.data.json` keys.
  Browser input never selects an S3 key or tenant.
- Dashboard payloads are validated at runtime. Missing, unavailable, and invalid
  objects produce different authenticated states.
- Successful dashboard reads use a short, tenant-keyed server cache after each
  request is authorized; `SORCE_DATA_CACHE_SECONDS` defaults to 60 seconds.
- User changes use ETag conditional writes, and audit/rate-limit objects live
  under private `auth/*` prefixes.
- The existing public bucket policy applies only to `daily_summary/*`.
  `auth/*` must remain private.

This deployment intentionally uses the existing bucket without requiring S3
object versioning. Recovery relies on controlled registry backups and the
documented conditional-write workflow.

## Operations

- [User registry, legacy-user migration, and recovery](docs/user-registry.md)
- [Deployment, IAM, health checks, and rollback](docs/operations.md)
- The data producer remains the owner of `companies/*` and
  `companies/team_stats.json`; the frontend owns `auth/*`.

The public application URL and login route remain unchanged. The initial
production registry at `sorce-dashboard-data/auth/users.json` contains all 30
legacy accounts because the seven accounts still in use were not known. It was
created with the runbook's create-only write and then verified for exact content,
server-side encryption, and private access. Do not remove an account until its
usage has been confirmed.
