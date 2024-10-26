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

```bash
npm i -g vercel
vercel link
vercel env pull
```
