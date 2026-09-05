# User registry operations

The user registry is a versioned schema containing password scrypt records,
tenant metadata, and explicit dashboard object keys. It is read only from
server-only modules. `lib/users.ts` exposes sanitized principals; it never
returns a password hash, salt, or dashboard object key.

## Runtime configuration

Production reads the private S3 object `auth/users.json` in the existing
`sorce-dashboard-data` bucket by default. Set these variables in the runtime
environment when the deployment uses another location:

```text
AUTH_USER_REGISTRY_BUCKET=sorce-dashboard-data
AUTH_USER_REGISTRY_KEY=auth/users.json
AUTH_USER_REGISTRY_REGION=us-east-1
```

The bucket currently has a narrowly scoped public policy for
`daily_summary/*`; keep `auth/users.json` outside that prefix and verify the
effective bucket policy/IAM permissions before deployment. The registry must
remain private even though the shared data bucket has that public exception.

`AUTH_USER_REGISTRY_REGION` is preferred for S3. If it is omitted, the store
uses `AWS_DEFAULT_REGION`, then `us-east-1`, for compatibility with the
existing deployment. A local JSON registry is allowed only when `NODE_ENV` is
`development` or `test`; set
`AUTH_USER_REGISTRY_SOURCE=local` and optionally
`AUTH_USER_REGISTRY_LOCAL_PATH`. The default local path is the ignored
`lib/user-registry.json`, which keeps existing local logins working without
putting the registry in source control.

Any missing, unavailable, malformed, or invariant-violating registry fails
closed. The schema enforces normalized unique usernames, unique stable IDs and
tenant IDs, valid user-to-tenant references, and at least one enabled admin.

## Prepare and validate

The migration tool never prints credentials, hashes, usernames, object keys,
or raw registry values. It requires explicit paths and does not overwrite the
source during preparation:

```sh
node scripts/migrate-users-to-hashed-registry.mjs \
  --prepare --input lib/user-registry.json --output /tmp/users.json
node scripts/migrate-users-to-hashed-registry.mjs \
  --validate --input /tmp/users.json
```

The current local migration preserves all 30 existing hashed accounts and
legacy `companies/<hash>.data.json` object keys. Because the seven accounts
still in use were not known, the initial production registry intentionally
contains all 30 legacy accounts. This preserves every existing credential and
avoids guessing which accounts can be removed.

After account usage has been confirmed, a future operator can prepare a reduced
registry with `--retain-users`. The option is preparation-only, requires a non-empty
comma-separated list with no duplicates, requires every username to exist in
the source, retains only those users and their referenced tenants, and runs the
full invariant validation again:

```sh
node scripts/migrate-users-to-hashed-registry.mjs \
  --prepare --input lib/user-registry.json \
  --retain-users user_one,user_two \
  --output /tmp/users-selected.json
```

The selection must include an enabled admin, as required by the registry
invariants. The input and ignored local registry are never changed.

## Admin user management

Administrators can manage existing-tenant accounts at `/admin/users`. The page
only receives allow-listed user and tenant display fields; password hashes,
salts, and dashboard object keys never reach the browser. Each create, enable,
disable, access change, and password reset action independently rechecks the
current administrator, loads a fresh ETag, and applies a conditional mutation.

New and reset passwords are generated with the platform CSPRNG and returned
only in that action response so the administrator can copy them once. They are
never logged or written to the audit stream. Disable, role, tenant, and
password changes increment `authVersion`, invalidating existing sessions. The
last enabled administrator cannot be disabled or demoted.

Successful mutations write redacted immutable records under `auth/audit/` in
the same bucket. Audit records contain only actor ID, action, target ID,
timestamp, result, and a correlation ID. Grant the admin runtime role access
to `auth/users.json` and `auth/audit/*`; the dashboard data producer should not
have access to either prefix.

## Login throttling

Production credential attempts use durable state in the same bucket under
`auth/rate-limit/`. The state key is an HMAC-SHA256 digest of the normalized
account and client IP, so usernames and addresses are never present in S3
object keys or logs. Set `AUTH_LOGIN_THROTTLE_SECRET` to a dedicated secret
when possible; the existing `AUTH_SECRET`/`NEXTAUTH_SECRET` is the compatibility
fallback. If no secret is available, authentication fails closed. Development
and test environments use a deterministic no-op throttle so local and E2E
credentials continue to work.

The throttle uses `sorce-dashboard-data` by default. `AUTH_LOGIN_THROTTLE_BUCKET`
and `AUTH_LOGIN_THROTTLE_REGION` may override the bucket and region; otherwise
the region falls back to `AUTH_USER_REGISTRY_REGION`, `AWS_DEFAULT_REGION`, and
then `us-east-1`.

On Vercel previews, both the registry `AUTH_USER_REGISTRY_BUCKET` plus
`AUTH_USER_REGISTRY_KEY` and the throttle `AUTH_LOGIN_THROTTLE_BUCKET` plus
`AUTH_LOGIN_THROTTLE_KEY_PREFIX` must be explicitly set. Preview deployments
never inherit the production bucket or key defaults.

The throttle uses a bounded 15-minute window, at most eight failures, and
exponential delays capped at 15 minutes. Every state transition is a typed
conditional S3 write: `If-None-Match: *` for a new key and `If-Match` for an
existing ETag. Conflicts retry a bounded number of times; backend errors are a
generic login failure and never reveal storage details.

Grant only the application runtime role these permissions on the rate-limit
prefix (no bucket listing is needed):

```text
s3:GetObject on arn:aws:s3:::sorce-dashboard-data/auth/rate-limit/*
s3:PutObject on arn:aws:s3:::sorce-dashboard-data/auth/rate-limit/*
```

Keep the prefix outside any public policy. Configure an S3 Lifecycle rule for
`auth/rate-limit/` to expire objects after at least one day; this is longer than
the 15-minute throttle window while preventing abandoned per-pair state from
accumulating indefinitely. Do not grant the dashboard data producer access to
this prefix.

## Conditional writes

`UserStore.update()` reads the registry once and passes that snapshot's ETag
through the backend as `If-Match`. A stale ETag returns a conflict, which is
retried a bounded number of times against a fresh snapshot, and local
development writes use the same compare-before-atomic-rename semantics.

The S3 backend uses the typed `PutObjectCommand.IfMatch` field from the pinned
AWS SDK and sends a signed conditional request. Do not replace it with an
unconditional `PutObjectCommand`.

The CLI accepts `--upload` only with explicit input, bucket, key, region, and
expected ETag arguments. It uses `If-Match` and therefore updates only the
specific object state represented by that ETag. For the initial object,
`--create-upload` accepts explicit input, bucket, key, and region arguments and
uses typed `PutObjectCommand.IfNoneMatch = '*'`; it fails if the object already
exists and can never overwrite it. `--upload` and `--create-upload` are
mutually exclusive. The initial `sorce-dashboard-data/auth/users.json` object
was created on 2026-09-04 with `--create-upload`; its downloaded content matched
the validated 30-user input, S3 reported server-side encryption, and an
anonymous read returned HTTP 403.
