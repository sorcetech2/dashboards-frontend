# Source Dashboards

Note: we had to copy the [old repo](https://github.com/sorcetech/dashboards) created in sorcetech, because vercel blocked out account. 

## Data pipeline and dashboard integration

The Python [dashboards-new repo](https://github.com/sorce-io/dashboards-new) is the data producer for the dashboard. The Python Lambda processes SORCE data, computes company/team metrics, and writes per-company JSON files plus `team_stats.json` to the `sorce-dashboard-data` S3 bucket.

This repo is the **dashboard frontend**. This frontend reads those same files from S3 (created in [source-io/dashboards-new](https://github.com/sorce-io/dashboards-new)) in production and renders them for the logged-in company; it derives each company JSON filename from the company display name.

Adding a company requires changes in both repos. Add credentials/display name in [lib/users.ts](https://github.com/sorcetech2/dashboards-frontend/lib/users.ts), then add matching company configuration and Lambda allow-listing in the Python repo so it actually generates the company’s S3 data.

Know the runtime dependencies. Production defaults to S3 (`sorce-dashboard-data`); local development defaults to files in `public/`. The frontend requires AWS credentials to read production data and `AUTH_SECRET`/`NEXTAUTH_SECRET` for login, while the Python Lambda owns refreshing the data.

## Run Locally

### Prerequisites

- Node.js (`brew install node`)
- pnpm (`curl -fsSL https://get.pnpm.io/install.sh | sh -`)

### AWS Secrets (so it can read from S3)

```
export AWS_SECRET_ACCESS_KEY=...
export AWS_ACCESS_KEY_ID=..
```

### Setup

```
pnpm install
pnpm dev
```

You should now be able to access the application at http://localhost:3000.

## Add users

Edit this file:

```
lib/users.ts
```

## Deploy

commit and push

## Somewhere else

when setting this up somewhere else, note that these env variables are required
AUTH_SECRET=... [any randoms tring]

AWS_SECRET_ACCESS_KEY=...
AWS_ACCESS_KEY_ID=..

## Original Setup (one-time, not needed anymore)

This shouldn't be needed anymore! Already all setup

```bash
npm i -g vercel
vercel link
vercel env pull
```
