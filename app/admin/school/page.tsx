"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import {
  currentSchool,
  getListingsBySchool,
  getDonationRequestsBySchool,
  getUserById,
  getListingById,
  users,
  schoolMetrics,
  listings,
} from "@/lib/mock-data"
import type { DonationRequest } from "@/lib/mock-data"
import {
  Users,
  Package,
  Heart,
  TrendingUp,
  Eye,
  CheckCircle2,
  XCircle,
  BarChart3,
  Flag,
  Shield,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"

export default function SchoolAdminPage() {
  const metrics = schoolMetrics["s1" as keyof typeof schoolMetrics]
  const schoolListings = getListingsBySchool(currentSchool.id)
  const schoolMembers = users.filter(u => u.schoolId === currentSchool.id)
  const [donationRequests, setDonationRequests] = useState<DonationRequest[]>(
    getDonationRequestsBySchool(currentSchool.id)
  )

  const flaggedListings = listings.filter(l => l.schoolId === currentSchool.id && l.status === "active").slice(0, 2)

  function handleApprove(id: string) {
    setDonationRequests(prev =>
      prev.map(dr => (dr.id === id ? { ...dr, status: "approved" } : dr))
    )
    toast.success("Solicitud aprobada")
  }

  function handleReject(id: string) {
    setDonationRequests(prev =>
      prev.map(dr => (dr.id === id ? { ...dr, status: "rejected" } : dr))
    )
    toast.success("Solicitud rechazada")
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar isLoggedIn userName="Pedro" isAdmin />

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Panel Admin - {currentSchool.name}</h1>
              <p className="text-sm text-muted-foreground">
                Codigo: <span className="font-mono">{currentSchool.code}</span> &middot; {currentSchool.city}
              </p>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{metrics.itemsReused}</p>
                  <p className="text-xs text-muted-foreground">Articulos reutilizados</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/20">
                  <Heart className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{metrics.donationsCompleted}</p>
                  <p className="text-xs text-muted-foreground">Donaciones</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
                  <Users className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{metrics.familiesParticipating}</p>
                  <p className="text-xs text-muted-foreground">Familias activas</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-chart-4/10">
                  <TrendingUp className="h-5 w-5 text-chart-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{metrics.moneySaved}&euro;</p>
                  <p className="text-xs text-muted-foreground">Ahorro total</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="donations" className="mt-6">
            <TabsList>
              <TabsTrigger value="donations">Solicitudes de donacion</TabsTrigger>
              <TabsTrigger value="listings">Anuncios ({schoolListings.length})</TabsTrigger>
              <TabsTrigger value="members">Miembros ({schoolMembers.length})</TabsTrigger>
              <TabsTrigger value="flagged">Reportados</TabsTrigger>
            </TabsList>

            {/* Donation Requests */}
            <TabsContent value="donations" className="mt-4 flex flex-col gap-3">
              {donationRequests.length > 0 ? (
                donationRequests.map(req => {
                  const requester = getUserById(req.requesterId)
                  const listing = getListingById(req.listingId)
                  return (
                    <Card key={req.id} className="border-border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <Avatar className="h-10 w-10 shrink-0">
                              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                {requester?.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{requester?.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Solicita: {listing?.title}
                              </p>
                              <p className="mt-1 text-sm text-foreground leading-relaxed">{req.message}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {new Date(req.createdAt).toLocaleDateString("es-ES")}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {req.status === "pending" ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 text-destructive hover:text-destructive"
                                  onClick={() => handleReject(req.id)}
                                >
                                  <XCircle className="h-3.5 w-3.5" /> Rechazar
                                </Button>
                                <Button
                                  size="sm"
                                  className="gap-1"
                                  onClick={() => handleApprove(req.id)}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
                                </Button>
                              </>
                            ) : (
                              <Badge
                                variant={req.status === "approved" ? "default" : "destructive"}
                                className="capitalize"
                              >
                                {req.status === "approved" ? "Aprobada" : "Rechazada"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              ) : (
                <div className="flex flex-col items-center py-12 text-center">
                  <Heart className="h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-3 text-sm text-muted-foreground">No hay solicitudes pendientes</p>
                </div>
              )}
            </TabsContent>

            {/* Listings */}
            <TabsContent value="listings" className="mt-4 flex flex-col gap-3">
              {schoolListings.map(listing => (
                <Card key={listing.id} className="border-border">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <span className="text-lg text-muted-foreground/40 font-mono">
                          {listing.category.charAt(0)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{listing.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {getUserById(listing.sellerId)?.name} &middot; {listing.category}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {listing.type === "donation" ? (
                        <Badge variant="secondary" className="text-xs">Donacion</Badge>
                      ) : (
                        <span className="text-sm font-bold text-foreground">{listing.price}&euro;</span>
                      )}
                      <Link href={`/marketplace/listing/${listing.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">Ver</span>
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Members */}
            <TabsContent value="members" className="mt-4 flex flex-col gap-3">
              {schoolMembers.map(member => (
                <Card key={member.id} className="border-border">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {member.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize text-xs">
                      {member.role === "parent" ? "Familia" : member.role === "school_admin" ? "Admin" : member.role}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Flagged */}
            <TabsContent value="flagged" className="mt-4">
              <Card className="border-border">
                <CardContent className="flex flex-col items-center py-12 text-center">
                  <Flag className="h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    No hay contenido reportado en este momento
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Los reportes de usuarios apareceran aqui para revision
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  )
}
