"use client";

import ShareListingButton from "@/components/marketplace/share-listing-button";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type PostPublishShareCardProps = {
  title: string;
  url: string;
};

export default function PostPublishShareCard({ title, url }: PostPublishShareCardProps) {
  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Anuncio publicado</p>
          <h2 className="mt-1 text-lg font-bold">{title}</h2>
          <p className="mt-1 text-sm text-emerald-900/80">
            Compártelo con tu comunidad para recibir contactos antes.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ShareListingButton title={title} url={url} />
          <Button asChild variant="outline">
            <Link href="/account/listings">Mis anuncios</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
