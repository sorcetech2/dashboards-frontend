import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Configuration-only readiness probe. It never reads customer or auth data. */
export function GET() {
  const hasAuthSecret = Boolean(
    process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()
  );
  const dataSource = process.env.SORCE_DATA_SOURCE?.trim().toLowerCase();
  const validDataSource =
    dataSource === undefined || dataSource === 'local' || dataSource === 's3';
  const localAllowed =
    dataSource !== 'local' ||
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'test';
  const ready = hasAuthSecret && validDataSource && localAllowed;

  return NextResponse.json(
    { status: ready ? 'ok' : 'unavailable' },
    { status: ready ? 200 : 503 }
  );
}
