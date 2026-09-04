# Deployment and operations

## S3 and IAM boundaries

Use the existing `sorce-dashboard-data` bucket. Bucket versioning is not a
deployment requirement for this seven-user application. Keep the current public
read exception limited to `daily_summary/*`; none of these application roles
should make `auth/*` public.

Grant the frontend runtime read access to the selected tenant objects under
`companies/*`, `companies/team_stats.json`, and `auth/users.json`. Grant admin
mutations conditional write access to `auth/users.json` plus create-only access
to `auth/audit/*` and `auth/rate-limit/*`. The producer should write
`companies/*` and have no access to `auth/*`. Prefer workload identity and
short-lived AWS credentials.

## Release checklist

1. Run the frozen install and every command in the README quality-check block.
2. Prepare an encrypted, access-controlled backup of `auth/users.json` if it
   already exists, and record its ETag. Do not put the backup in this repository.
3. Confirm the exact seven enabled usernames and that an enabled admin remains.
4. Deploy to the existing production project so the public URL does not change.
5. Check `/api/health`; it returns only `ok` or `unavailable` and exposes no
   bucket, key, account, or customer information.
6. Smoke-test one viewer and one admin, team switching, tenant isolation,
   statistics, and sign-out. Confirm CSP reports before enforcing the policy.
7. Review only redacted operational logs. Never log credentials, tokens, hashes,
   raw registry records, object keys, or health payloads.

## Rollback without object versioning

Application rollback is the previous deployment. Registry rollback is a
deliberate conditional replacement: validate the protected backup, read the
current ETag, review what changed, and write the backup with `If-Match` against
that ETag. Never use an unconditional upload. After rollback, verify admin count
and login behavior; changed `authVersion` values intentionally determine which
sessions remain valid.

## Recovery and maintenance

If the admin UI is unavailable, use the CLI commands in
`docs/user-registry.md`. Treat a missing/invalid registry or IAM denial as a
fail-closed authentication incident. Review dependency updates weekly, restore
the protected registry backup monthly, review accounts/admins quarterly, and
rotate credentials immediately after staff or contractor changes.
