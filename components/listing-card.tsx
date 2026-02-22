"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Heart, Star } from "lucide-react"
import { useState } from "react"
import type { Listing } from "@/lib/mock-data"
import { getUserById, conditionLabels } from "@/lib/mock-data"

interface ListingCardProps {
  listing: Listing
  currentSchoolId?: string
}

export function ListingCard({ listing, currentSchoolId = "s1" }: ListingCardProps) {
  const seller = getUserById(listing.sellerId)
  const isSameSchool = listing.schoolId === currentSchoolId
  const [isFav, setIsFav] = useState(false)
  const isDonation = listing.type === "donation"
  const hasDistance = !isSameSchool && listing.distance != null

  return (
    <Card className="group overflow-hidden border-border bg-card transition-shadow duration-200 hover:shadow-lg">
      {/* Image area */}
      <Link href={`/marketplace/listing/${listing.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <div className="flex h-full items-center justify-center bg-muted">
            <span className="text-5xl text-muted-foreground/15 font-mono select-none">
              {listing.category.charAt(0)}
            </span>
          </div>

          {/* Donation badge -- top-left of image */}
          {isDonation && (
            <Badge className="absolute left-2.5 top-2.5 bg-[#7EBA28] text-[#fff] text-[11px] font-semibold shadow-sm border-0 rounded-md px-2 py-0.5">
              Donacion
            </Badge>
          )}

          {/* School/distance badge -- top-right of image */}
          {(isSameSchool || hasDistance) && (
            <div className="absolute right-2.5 top-2.5">
              <Badge
                variant={isSameSchool ? "default" : "outline"}
                className={
                  isSameSchool
                    ? "bg-primary/90 text-primary-foreground text-[10px] backdrop-blur-sm rounded-md shadow-sm border-0 gap-1"
                    : "bg-card/90 text-foreground text-[10px] backdrop-blur-sm rounded-md shadow-sm gap-1"
                }
              >
                <MapPin className="h-3 w-3" />
                {isSameSchool ? "Mi centro" : `${listing.distance} km`}
              </Badge>
            </div>
          )}

          {/* Favorite button -- bottom-right of image */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-card/80 backdrop-blur-sm shadow-sm hover:bg-card"
            onClick={(e) => {
              e.preventDefault()
              setIsFav(!isFav)
            }}
          >
            <Heart className={`h-4 w-4 transition-colors ${isFav ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
            <span className="sr-only">{isFav ? "Quitar de favoritos" : "Anadir a favoritos"}</span>
          </Button>
        </div>
      </Link>

      {/* Content area */}
      <CardContent className="px-3.5 pb-3.5 pt-2.5">
        {/* Category */}
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {listing.category}
        </span>

        {/* Title */}
        <Link href={`/marketplace/listing/${listing.id}`} className="block mt-0.5">
          <h3 className="truncate text-sm font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
            {listing.title}
          </h3>
        </Link>

        {/* Grade + Condition */}
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-muted-foreground">{listing.gradeLevel}</span>
          <span className="text-muted-foreground/40 text-[10px]">&bull;</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-[18px] font-normal rounded-md border-border">
            {conditionLabels[listing.condition]}
          </Badge>
          {listing.type === "sale" && listing.originalPrice && listing.price && (
            <Badge className="text-[10px] px-1.5 py-0 h-[18px] bg-[#7EBA28]/15 text-[#5a9010] border-0 font-semibold rounded-md">
              -{Math.round((1 - listing.price / listing.originalPrice) * 100)}%
            </Badge>
          )}
        </div>

        {/* Seller + Price row */}
        <div className="mt-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs text-muted-foreground truncate max-w-[110px]">{seller?.name}</span>
            {seller?.rating && (
              <span className="inline-flex items-center gap-0.5 text-xs text-foreground font-medium shrink-0">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {seller.rating}
              </span>
            )}
          </div>
          {!isDonation && listing.price != null && (
            <span className="text-[15px] font-bold text-foreground pl-3 shrink-0">
              {listing.price}&euro;
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
