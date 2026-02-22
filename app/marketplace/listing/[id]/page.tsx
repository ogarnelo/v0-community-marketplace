"use client"

import { use, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { listings, getUserById, getSchoolById, getReviewsForUser, currentUser, conditionLabels } from "@/lib/mock-data"
import {
  ArrowLeft, MessageCircle, Heart, Star, MapPin, Calendar, CheckCircle2, Clock, Pencil, Loader2, BookmarkCheck,
} from "lucide-react"

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const listing = listings.find(l => l.id === id)
  const [requested, setRequested] = useState(false)
  const [reserving, setReserving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [listingStatus, setListingStatus] = useState(listing?.status || "active")

  if (!listing) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">Anuncio no encontrado</h2>
          <p className="mt-2 text-muted-foreground">Este anuncio ya no esta disponible.</p>
          <Link href="/marketplace">
            <Button className="mt-4">Volver al marketplace</Button>
          </Link>
        </div>
      </div>
    )
  }

  const seller = getUserById(listing.sellerId)
  const school = getSchoolById(listing.schoolId)
  const sellerReviews = seller ? getReviewsForUser(seller.id) : []
  const isOwner = listing.sellerId === currentUser.id

  const handleReserve = () => {
    setReserving(true)
    setTimeout(() => {
      setReserving(false)
      setListingStatus("reserved")
    }, 800)
  }

  const handleComplete = () => {
    setCompleting(true)
    setTimeout(() => {
      setCompleting(false)
      setListingStatus("completed")
    }, 800)
  }

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
        <Link href="/marketplace" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Volver al marketplace
        </Link>

        <div className="grid gap-8 lg:grid-cols-5">
          {/* Left: Image gallery */}
          <div className="lg:col-span-3">
            <div className="aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted">
              <div className="flex h-full items-center justify-center">
                <span className="text-6xl text-muted-foreground/20 font-mono">{listing.category.charAt(0)}</span>
              </div>
            </div>

            {/* Description */}
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-foreground">Descripcion</h2>
              <p className="mt-2 leading-relaxed text-muted-foreground">{listing.description}</p>
            </div>

            {/* Details grid */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Categoria</p>
                <p className="mt-1 text-sm font-medium text-foreground">{listing.category}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Curso</p>
                <p className="mt-1 text-sm font-medium text-foreground">{listing.gradeLevel}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Estado</p>
                <p className="mt-1 text-sm font-medium text-foreground">{conditionLabels[listing.condition]}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Publicado</p>
                <p className="mt-1 text-sm font-medium text-foreground">{new Date(listing.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</p>
              </div>
            </div>

            {/* Seller reviews */}
            {sellerReviews.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-foreground">Valoraciones del vendedor</h2>
                <div className="mt-3 flex flex-col gap-3">
                  {sellerReviews.slice(0, 3).map(review => {
                    const reviewer = getUserById(review.reviewerId)
                    return (
                      <Card key={review.id} className="border-border">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="bg-muted text-xs">{reviewer?.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-foreground">{reviewer?.name}</span>
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: review.rating }).map((_, i) => (
                                <Star key={i} className="h-3.5 w-3.5 fill-chart-4 text-chart-4" />
                              ))}
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: Info panel */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 flex flex-col gap-4">
              {/* Price & Title */}
              <Card className="border-border">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2">
                    {listing.type === "donation" ? (
                      <Badge className="bg-secondary text-secondary-foreground">
                        <Heart className="mr-1 h-3 w-3" /> Donacion
                      </Badge>
                    ) : (
                      <Badge variant="outline">Venta</Badge>
                    )}
                    {listingStatus === "reserved" && (
                      <Badge variant="outline" className="border-chart-4 text-chart-4">
                        <Clock className="mr-1 h-3 w-3" /> Reservado
                      </Badge>
                    )}
                    {listingStatus === "completed" && (
                      <Badge variant="outline" className="border-secondary text-secondary">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Completado
                      </Badge>
                    )}
                  </div>

                  <h1 className="mt-3 text-xl font-bold text-foreground">{listing.title}</h1>

                  {listing.type === "sale" ? (
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-foreground">{listing.price}&euro;</span>
                      {listing.originalPrice && (
                        <span className="text-lg text-muted-foreground line-through">{listing.originalPrice}&euro;</span>
                      )}
                      {listing.originalPrice && listing.price && (
                        <Badge variant="secondary" className="bg-secondary/10 text-secondary border-0">
                          -{Math.round((1 - listing.price / listing.originalPrice) * 100)}%
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-2xl font-bold text-secondary">Gratis</p>
                  )}
                </CardContent>
              </Card>

              {/* Actions */}
              <Card className="border-border">
                <CardContent className="p-5">
                  {isOwner ? (
                    <div className="flex flex-col gap-2">
                      {listingStatus === "active" && (
                        <Button
                          variant="outline"
                          className="w-full gap-2"
                          onClick={handleReserve}
                          disabled={reserving}
                        >
                          {reserving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkCheck className="h-4 w-4" />}
                          Marcar como reservado
                        </Button>
                      )}
                      {(listingStatus === "active" || listingStatus === "reserved") && (
                        <Button
                          className="w-full gap-2"
                          onClick={handleComplete}
                          disabled={completing}
                        >
                          {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Marcar como vendido/completado
                        </Button>
                      )}
                      {listingStatus === "completed" && (
                        <div className="rounded-lg bg-secondary/10 p-3 text-center text-sm text-secondary">
                          <CheckCircle2 className="mx-auto mb-1 h-5 w-5" />
                          Este anuncio ha sido completado.
                        </div>
                      )}
                      <Link href={`/marketplace/edit/${listing.id}`}>
                        <Button variant="outline" className="w-full gap-2">
                          <Pencil className="h-4 w-4" />
                          Editar anuncio
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Link href={`/messages?listing=${listing.id}`}>
                        <Button className="w-full gap-2">
                          <MessageCircle className="h-4 w-4" />
                          Chatear con vendedor
                        </Button>
                      </Link>
                      {listing.type === "donation" && !requested && (
                        <Button
                          variant="outline"
                          className="w-full gap-2"
                          onClick={() => setRequested(true)}
                        >
                          <Heart className="h-4 w-4" />
                          Solicitar donacion
                        </Button>
                      )}
                      {requested && (
                        <div className="rounded-lg bg-secondary/10 p-3 text-center text-sm text-secondary">
                          <CheckCircle2 className="mx-auto mb-1 h-5 w-5" />
                          Solicitud enviada. El admin del centro la revisara.
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Seller card */}
              <Card className="border-border">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11">
                      <AvatarFallback className="bg-primary text-primary-foreground">{seller?.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{seller?.name}</p>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Star className="h-3.5 w-3.5 fill-chart-4 text-chart-4" />
                        <span>{seller?.rating}</span>
                        <span>&middot;</span>
                        <span>{seller?.reviewCount} opiniones</span>
                      </div>
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" />
                      {school?.name}, {school?.city}
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" />
                      Miembro desde {new Date(seller?.createdAt || "").toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
