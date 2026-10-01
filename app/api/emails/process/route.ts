import { NextResponse, type NextRequest } from 'next/server';
import { processEmailQueue } from '@/lib/email/process';

/** Called every minute by pg_cron (email_tick) with the shared secret */
export async function POST(request: NextRequest) {
  if (!process.env.REVALIDATE_SECRET || request.headers.get('x-revalidate-secret') !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await processEmailQueue(50);
  return NextResponse.json(result);
}
