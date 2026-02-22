"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { currentUser, getReviewsForUser, getUserById, getListingById } from "@/lib/mock-data"
import { Star, MessageSquare, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ReviewsPage() {
  const reviews = getReviewsForUser(currentUser.id)
  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : "0"

  return (
    <div className="bg-background">
        <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8">
          <Link href="/account">
            <Button variant="ghost" size="sm" className="mb-4 gap-1.5 -ml-2">
              <ArrowLeft className="h-4 w-4" /> Volver a mi cuenta
            </Button>
          </Link>

          <h1 className="text-2xl font-bold text-foreground">Mis opiniones</h1>
          <p className="text-sm text-muted-foreground">Lo que otros usuarios dicen de ti</p>

          {/* Rating summary */}
          <Card className="mt-6 border-border">
            <CardContent className="flex items-center gap-6 p-6">
              <div className="text-center">
                <p className="text-4xl font-bold text-foreground">{avgRating}</p>
                <div className="mt-1 flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < Math.round(Number(avgRating))
                          ? "fill-chart-4 text-chart-4"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{reviews.length} opiniones</p>
              </div>

              <div className="flex-1">
                {[5, 4, 3, 2, 1].map(rating => {
                  const count = reviews.filter(r => r.rating === rating).length
                  const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0
                  return (
                    <div key={rating} className="flex items-center gap-2 text-xs">
                      <span className="w-3 text-muted-foreground">{rating}</span>
                      <Star className="h-3 w-3 text-chart-4 fill-chart-4" />
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-chart-4 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-5 text-right text-muted-foreground">{count}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Reviews list */}
          <div className="mt-6 flex flex-col gap-3">
            {reviews.length > 0 ? (
              reviews.map(review => {
                const reviewer = getUserById(review.reviewerId)
                const listing = getListingById(review.listingId)
                return (
                  <Card key={review.id} className="border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {reviewer?.name.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-foreground">{reviewer?.name}</p>
                            <span className="text-xs text-muted-foreground">
                              {new Date(review.createdAt).toLocaleDateString("es-ES")}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3.5 w-3.5 ${
                                  i < review.rating
                                    ? "fill-chart-4 text-chart-4"
                                    : "text-muted-foreground/30"
                                }`}
                              />
                            ))}
                          </div>
                          <p className="mt-2 text-sm text-foreground leading-relaxed">{review.comment}</p>
                          {listing && (
                            <Link href={`/marketplace/listing/${listing.id}`}>
                              <Badge variant="outline" className="mt-2 text-xs gap-1 cursor-pointer hover:bg-muted">
                                {listing.title}
                              </Badge>
                            </Link>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Todavia no tienes opiniones. Completa tu primera venta o donacion.
                </p>
              </div>
            )}
          </div>
        </div>
    </div>
  )
}
