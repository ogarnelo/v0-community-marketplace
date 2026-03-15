"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { FavoriteButton } from "@/components/favorites/favorite-button";

type ListingCardData = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  gradeLevel?: string | null;
  condition?: string | null;
  type?: string | null;
  price?: number;
  originalPrice?: number;
  photos?: string[];
  sellerId?: string | null;
  schoolId?: string | null;
  status?: string | null;
  createdAt?: string | null;
  distance?: number;
  isFavorite?: boolean;
};

interface ListingCardProps {
  listing: ListingCardData;
  currentSchoolId?: string;
}

const conditionLabels: Record<string, string> = {
  new_with_tags: "Nuevo con etiquetas",
  new_without_tags: "Nuevo sin etiquetas",
  very_good: "Muy bueno",
  good: "Bueno",
  satisfactory: "Satisfactorio",
};

export function ListingCard({
  listing,
  currentSchoolId = "",
}: ListingCardProps) {
  const isSameSchool =
    !!listing.schoolId &&
    !!currentSchoolId &&
    listing.schoolId === currentSchoolId;

  const isDonation = listing.type === "donation";
  const hasDistance = !isSameSchool && listing.distance != null;

  const categoryText = listing.category || "Sin categoría";
  const titleText = listing.title || "Anuncio sin título";
  const gradeText = listing.gradeLevel || "Sin curso";
  const conditionText =
    (listing.condition && conditionLabels[listing.condition]) ||
    listing.condition ||
    "Sin estado";

  return (
    <Card className="group overflow-hidden border-border bg-card transition-shadow duration-200 hover:shadow-lg">
      <Link href={`/marketplace/listing/${listing.id}`} className="block">
        <div className="relative overflow-hidden bg-muted" style={{ aspectRatio: "4 / 3" }}>
          <div className="flex h-full items-center justify-center bg-muted">
            <span className="select-none font-mono text-5xl text-muted-foreground/15">
              {categoryText.charAt(0)}
            </span>
          </div>

          {isDonation ? (
            <Badge className="absolute left-2.5 top-2.5 rounded-md border-0 bg-[#7EBA28] px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
              Donación
            </Badge>
          ) : null}

          {isSameSchool || hasDistance ? (
            <div className="absolute right-2.5 top-2.5">
              <Badge
                variant={isSameSchool ? "default" : "outline"}
                className={
                  isSameSchool
                    ? "gap-1 rounded-md border-0 bg-primary/90 text-[10px] text-primary-foreground shadow-sm backdrop-blur-sm"
                    : "gap-1 rounded-md bg-card/90 text-[10px] text-foreground shadow-sm backdrop-blur-sm"
                }
              >
                <MapPin className="h-3 w-3" />
                {isSameSchool ? "Mi centro" : `${listing.distance} km`}
              </Badge>
            </div>
          ) : null}

          <FavoriteButton
            listingId={listing.id}
            initialIsFavorite={!!listing.isFavorite}
            className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-card/80 shadow-sm backdrop-blur-sm transition hover:bg-card"
            iconClassName="h-4 w-4"
          />
        </div>
      </Link>

      <CardContent className="px-3.5 pb-3.5 pt-2.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {categoryText}
        </span>

        <Link href={`/marketplace/listing/${listing.id}`} className="mt-0.5 block">
          <h3 className="truncate text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
            {titleText}
          </h3>
        </Link>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">{gradeText}</span>

          <span className="text-[10px] text-muted-foreground/40">•</span>

          <Badge
            variant="outline"
            className="h-[18px] rounded-md border-border px-1.5 py-0 text-[10px] font-normal"
          >
            {conditionText}
          </Badge>

          {listing.type === "sale" && listing.originalPrice && listing.price ? (
            <Badge className="h-[18px] rounded-md border-0 bg-[#7EBA28]/15 px-1.5 py-0 text-[10px] font-semibold text-[#5a9010]">
              -{Math.round((1 - listing.price / listing.originalPrice) * 100)}%
            </Badge>
          ) : null}
        </div>

        <div className="mt-2.5 flex items-center justify-end">
          {!isDonation && listing.price != null ? (
            <span className="text-[15px] font-bold text-foreground">
              {listing.price}€
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
