'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { templateToSearchParams, type SellerTemplate } from '@/lib/seller/default-templates';
import { ArrowRight, Zap } from 'lucide-react';

export default function SellerTemplateCard({ template }: { template: SellerTemplate }) {
  const href = `/marketplace/new/quick?${templateToSearchParams(template)}`;

  const track = () => {
    void fetch('/api/seller/velocity/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        eventType: 'template_clicked',
        metadata: {
          template_id: template.id,
          name: template.name,
          href,
        },
      }),
    }).catch(() => null);
  };

  return (
    <article className="rounded-3xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        {template.badge ? <Badge variant="secondary">{template.badge}</Badge> : null}
      </div>

      <h3 className="mt-4 text-lg font-semibold">{template.name}</h3>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{template.description}</p>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-2.5 py-1">{template.category}</span>
        {template.price !== null && template.price !== undefined ? (
          <span className="rounded-full bg-muted px-2.5 py-1">{template.price}€ sugerido</span>
        ) : (
          <span className="rounded-full bg-muted px-2.5 py-1">Donación</span>
        )}
      </div>

      <Button asChild className="mt-5 w-full gap-2" onClick={track}>
        <Link href={href}>
          Usar plantilla
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </article>
  );
}
