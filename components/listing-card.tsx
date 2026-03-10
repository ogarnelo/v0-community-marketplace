"use client"

import Link from "next/link"
import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Heart } from "lucide-react"

type ListingCardData = {
  id: string
  title: string
  description?: string | null
  category?: string | null
  gradeLevel?: string | null
  condition?: string | null
  type?: string | null
  price?: number
  originalPrice?: number
  photos?: string[]
  sellerId?: string | null
  schoolId?: string | null
  status?: string | null
  createdAt?: string | null
  distance?: number
}

interface ListingCardProps {
  listing: ListingCardData
  currentSchoolId?: string
}

const conditionLabels: Record<string, string> = {
  new_with_tags: "Nuevo con etiquetas",
  new_without_tags: "Nuevo sin etiquetas",
  very_good: "Muy bueno",
  good: "Bueno",
  satisfactory: "Satisfactorio",
}

export function ListingCard({
  listing,
  currentSchoolId = "",
}: ListingCardProps) {
  const [isFav, setIsFav] = useState(false)

  const isSameSchool =
    !!listing.schoolId &&
    !!currentSchoolId &&
    listing.schoolId === currentSchoolId

  const isDonation = listing.type === "donation"
  const hasDistance = !isSameSchool && listing.distance != null

  const categoryText = listing.category || "Sin categoría"
  const titleText = listing.title || "Anuncio sin título"
  const gradeText = listing.gradeLevel || "Sin curso"
  const conditionText =
    (listing.condition && conditionLabels[listing.condition]) ||
    listing.condition ||
    "Sin estado"

  return (
    <Card className="group overflow-hidden border-border bg-card transition-shadow duration-200 hover:shadow-lg">
      <Link href={`/marketplace/listing/${listing.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <div className="flex h-full items-center justify-center bg-muted">
            <span className="select-none font-mono text-5xl text-muted-foreground/15">
              {categoryText.charAt(0)}
            </span>
          </div>

          {isDonation && (
            <Badge className="absolute left-2.5 top-2.5 rounded-md border-0 bg-[#7EBA28] px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
              Donación
            </Badge>
          )}

          {(isSameSchool || hasDistance) && (
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
          )}

          <Button
            variant="ghost"
            size="icon"
            className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-card/80 shadow-sm backdrop-blur-sm hover:bg-card"
            onClick={(e) => {
              e.preventDefault()
              setIsFav(!isFav)
            }}
          >
            <Heart
              className={`h-4 w-4 transition-colors ${isFav
                  ? "fill-destructive text-destructive"
                  : "text-muted-foreground"
                }`}
            />
            <span className="sr-only">
              {isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
            </span>
          </Button>
        </div>
      </Link>

      <CardContent className="px-3.5 pb-3.5 pt-2.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {categoryText}
        </span>

        <Link href={`/marketplace/listing/${listing.id}`} className="block mt-0.5">
          <h3 className="truncate text-sm font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
            {titleText}
          </h3>
        </Link>

        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-muted-foreground">
            {gradeText}
          </span>

          <span className="text-muted-foreground/40 text-[10px]">
            •
          </span>

          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-[18px] font-normal rounded-md border-border"
          >
            {conditionText}
          </Badge>

          {listing.type === "sale" &&
            listing.originalPrice &&
            listing.price && (
              <Badge className="text-[10px] px-1.5 py-0 h-[18px] bg-[#7EBA28]/15 text-[#5a9010] border-0 font-semibold rounded-md">
                -
                {Math.round(
                  (1 - listing.price / listing.originalPrice) * 100
                )}
                %
              </Badge>
            )}
        </div>

        <div className="mt-2.5 flex items-center justify-end">
          {!isDonation && listing.price != null && (
            <span className="text-[15px] font-bold text-foreground">
              {listing.price}€
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
