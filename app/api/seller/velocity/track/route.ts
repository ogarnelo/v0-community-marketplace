import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const EVENTS = new Set([
  'quick_publish_started',
  'quick_publish_completed',
  'template_clicked',
  'template_created',
  'bulk_import_started',
  'opportunity_clicked',
]);

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const eventType = typeof body?.eventType === 'string' ? body.eventType : '';

  if (!EVENTS.has(eventType)) {
    return NextResponse.json({ ok: false, error: 'Invalid event' }, { status: 400 });
  }

  await supabase.from('seller_velocity_events').insert({
    seller_id: user.id,
    event_type: eventType,
    source: typeof body?.source === 'string' ? body.source.slice(0, 40) : 'seller_velocity',
    metadata: typeof body?.metadata === 'object' && body.metadata ? body.metadata : {},
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
