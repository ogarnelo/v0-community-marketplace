import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function text(value: unknown, max = 400) {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = text(body?.name, 80);

  if (!name) {
    return NextResponse.json({ error: 'Pon un nombre a la plantilla.' }, { status: 400 });
  }

  const listingType = body?.listing_type === 'donation' ? 'donation' : 'sale';

  const { data, error } = await supabase
    .from('seller_publish_templates')
    .insert({
      seller_id: user.id,
      name,
      title: text(body?.title, 160),
      description: text(body?.description, 1000),
      category: text(body?.category, 80),
      grade_level: text(body?.grade_level, 80),
      condition: text(body?.condition, 40),
      listing_type: listingType,
      price: numberOrNull(body?.price),
      original_price: numberOrNull(body?.original_price),
      isbn: text(body?.isbn, 20),
      metadata: {
        source: 'seller_velocity',
      },
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: 'No se pudo guardar la plantilla.' }, { status: 500 });
  }

  await supabase.from('seller_velocity_events').insert({
    seller_id: user.id,
    event_type: 'template_created',
    source: 'seller_velocity',
    metadata: { template_id: data.id, name },
  }).catch(() => null);

  return NextResponse.json({ ok: true, id: data.id });
}
