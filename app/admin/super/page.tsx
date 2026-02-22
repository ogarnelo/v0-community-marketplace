"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { schools, users, listings, schoolMetrics } from "@/lib/mock-data"
import type { School } from "@/lib/mock-data"
import {
  School as SchoolIcon,
  Users,
  Package,
  Heart,
  TrendingUp,
  Search,
  MapPin,
  ExternalLink,
  Shield,
  Globe,
  AlertTriangle,
  CheckCircle2,
  Ban,
} from "lucide-react"
import { toast } from "sonner"

export default function SuperAdminPage() {
  const [searchQuery, setSearchQuery] = useState("")

  const totalUsers = users.length
  const totalListings = listings.length
  const totalSchools = schools.length
  const totalDonations = listings.filter(l => l.type === "donation").length
  const totalSaved = Object.values(schoolMetrics).reduce((sum, m) => sum + m.moneySaved, 0)

  const filteredSchools = schools.filter(
    s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const [schoolStatuses, setSchoolStatuses] = useState<Record<string, "active" | "suspended">>(
    Object.fromEntries(schools.map(s => [s.id, "active"]))
  )

  function toggleSchoolStatus(id: string) {
    setSchoolStatuses(prev => {
      const newStatus = prev[id] === "active" ? "suspended" : "active"
      toast.success(`Centro ${newStatus === "active" ? "activado" : "suspendido"}`)
      return { ...prev, [id]: newStatus }
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar isLoggedIn userName="Admin" isAdmin />

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Globe className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Super Admin - Wetudy</h1>
              <p className="text-sm text-muted-foreground">Panel de administracion global de la plataforma</p>
            </div>
          </div>

          {/* Global KPIs */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <SchoolIcon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{totalSchools}</p>
                  <p className="text-xs text-muted-foreground">Centros</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary/20">
                  <Users className="h-4 w-4 text-secondary" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{totalUsers}</p>
                  <p className="text-xs text-muted-foreground">Usuarios</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent">
                  <Package className="h-4 w-4 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{totalListings}</p>
                  <p className="text-xs text-muted-foreground">Anuncios</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-chart-2/10">
                  <Heart className="h-4 w-4 text-chart-2" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{totalDonations}</p>
                  <p className="text-xs text-muted-foreground">Donaciones</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-chart-4/10">
                  <TrendingUp className="h-4 w-4 text-chart-4" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{totalSaved}&euro;</p>
                  <p className="text-xs text-muted-foreground">Ahorro total</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="schools" className="mt-6">
            <TabsList>
              <TabsTrigger value="schools">Centros educativos</TabsTrigger>
              <TabsTrigger value="users">Usuarios</TabsTrigger>
              <TabsTrigger value="moderation">Moderacion</TabsTrigger>
            </TabsList>

            {/* Schools */}
            <TabsContent value="schools" className="mt-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, ciudad o codigo..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <Badge variant="outline" className="text-xs">{filteredSchools.length} centros</Badge>
              </div>

              <div className="flex flex-col gap-3">
                {filteredSchools.map(school => {
                  const memberCount = users.filter(u => u.schoolId === school.id).length
                  const listingCount = listings.filter(l => l.schoolId === school.id).length
                  const status = schoolStatuses[school.id]
                  const metric = schoolMetrics[school.id as keyof typeof schoolMetrics]

                  return (
                    <Card key={school.id} className="border-border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                              <SchoolIcon className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-foreground truncate">{school.name}</h3>
                                <Badge
                                  variant={status === "active" ? "default" : "destructive"}
                                  className="text-[10px] shrink-0"
                                >
                                  {status === "active" ? "Activo" : "Suspendido"}
                                </Badge>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" /> {school.city}
                                </span>
                                <span className="font-mono">{school.code}</span>
                                <span className="capitalize">{school.type}</span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                <span>{memberCount} miembros</span>
                                <span>{listingCount} anuncios</span>
                                {metric && <span>{metric.moneySaved}&euro; ahorrado</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-xs"
                              onClick={() => toggleSchoolStatus(school.id)}
                            >
                              {status === "active" ? (
                                <>
                                  <Ban className="h-3.5 w-3.5" /> Suspender
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Activar
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </TabsContent>

            {/* Users */}
            <TabsContent value="users" className="mt-4">
              <div className="flex flex-col gap-3">
                {users.map(user => {
                  const school = schools.find(s => s.id === user.schoolId)
                  const userListings = listings.filter(l => l.sellerId === user.id)
                  return (
                    <Card key={user.id} className="border-border">
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <span className="text-sm font-semibold text-primary">{user.name.charAt(0)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>{school?.name}</span>
                              <span>&middot;</span>
                              <span>{userListings.length} anuncios</span>
                              <span>&middot;</span>
                              <span>Desde {new Date(user.createdAt).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}</span>
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="capitalize text-xs shrink-0">
                          {user.role === "parent"
                            ? "Familia"
                            : user.role === "school_admin"
                            ? "Admin Centro"
                            : user.role === "super_admin"
                            ? "Super Admin"
                            : user.role}
                        </Badge>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </TabsContent>

            {/* Moderation */}
            <TabsContent value="moderation" className="mt-4">
              <Card className="border-border">
                <CardContent className="flex flex-col items-center py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
                    <AlertTriangle className="h-7 w-7 text-accent-foreground" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">Sin incidencias</h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    No hay contenido reportado ni disputas pendientes de moderacion. Los reportes de usuarios y disputas entre compradores y vendedores apareceran aqui.
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
