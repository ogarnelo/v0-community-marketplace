"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { currentUser, currentSchool, gradeLevels, getListingsBySeller, getReviewsForUser } from "@/lib/mock-data"
import { Star, Package, School, Mail, Calendar, ArrowRight, Loader2, MessageSquare, MapPin } from "lucide-react"
import { toast } from "sonner"

export default function AccountPage() {
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const myListings = getListingsBySeller(currentUser.id)
  const myReviews = getReviewsForUser(currentUser.id)

  const handleSave = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setEditing(false)
      toast.success("Perfil actualizado correctamente")
    }, 800)
  }

  const handleCancel = () => {
    setEditing(false)
  }

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8">
        <h1 className="text-2xl font-bold text-foreground">Mi cuenta</h1>
        <p className="text-sm text-muted-foreground">Gestiona tu perfil y configuracion</p>

        <div className="mt-6 flex flex-col gap-6">
          {/* Profile summary */}
          <Card className="border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">{currentUser.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{currentUser.name}</h2>
                  <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-chart-4 text-chart-4" />
                      {currentUser.rating} ({currentUser.reviewCount} opiniones)
                    </div>
                    <span>&middot;</span>
                    <Badge variant="outline" className="text-xs">{currentUser.role === "parent" ? "Familia | Tutor legal" : "Estudiante"}</Badge>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" />
                  {myListings.length} anuncios
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <School className="h-4 w-4" />
                  {currentSchool.name}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Desde {new Date(currentUser.createdAt).toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit profile */}
          <Card className="border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-foreground">Datos personales</CardTitle>
                  <CardDescription>Actualiza tu informacion basica</CardDescription>
                </div>
                {!editing && (
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    Editar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input id="name" defaultValue={currentUser.name} disabled={!editing} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue={currentUser.email} disabled={!editing} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Tipo de usuario</Label>
                  <Select defaultValue={currentUser.role} disabled={!editing}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parent">Familia | Tutor legal</SelectItem>
                      <SelectItem value="student">Estudiante</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Curso / Etapa</Label>
                  <Select defaultValue="3o ESO" disabled={!editing}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {gradeLevels.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:max-w-[50%]">
                <Label htmlFor="postalCode">Codigo postal</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="postalCode"
                    defaultValue="28001"
                    className="pl-10"
                    disabled={!editing}
                    maxLength={5}
                    pattern="[0-9]{5}"
                  />
                </div>
              </div>

              {editing && (
                <div className="flex gap-3">
                  <Button onClick={handleSave} disabled={loading} className="w-fit">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar cambios
                  </Button>
                  <Button variant="outline" onClick={handleCancel} className="w-fit">
                    Cancelar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* School info */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Mi centro</CardTitle>
              <CardDescription>Centro educativo asociado a tu cuenta</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <School className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{currentSchool.name}</p>
                    <p className="text-sm text-muted-foreground">{currentSchool.city} &middot; {currentSchool.memberCount} miembros</p>
                  </div>
                </div>
                <Badge variant="outline" className="font-mono text-xs">{currentSchool.code}</Badge>
              </div>
              <div className="mt-4">
                <Link href="/onboarding/join-school">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <School className="h-3.5 w-3.5" />
                    Cambiar centro
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Privacy */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Privacidad</CardTitle>
              <CardDescription>Configura tu visibilidad en la plataforma</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Mostrar mi nombre completo</p>
                  <p className="text-xs text-muted-foreground">Otros usuarios veran tu nombre en los anuncios</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Recibir notificaciones por email</p>
                  <p className="text-xs text-muted-foreground">Mensajes nuevos y actualizaciones de anuncios</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Quick links */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/account/listings">
              <Card className="border-border transition-shadow hover:shadow-md cursor-pointer">
                <CardContent className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-primary" />
                    <span className="font-medium text-foreground">Mis anuncios</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
            <Link href="/messages">
              <Card className="border-border transition-shadow hover:shadow-md cursor-pointer">
                <CardContent className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-primary" />
                    <span className="font-medium text-foreground">Mis mensajes</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
            <Link href="/account/reviews">
              <Card className="border-border transition-shadow hover:shadow-md cursor-pointer">
                <CardContent className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <span className="font-medium text-foreground">Mis opiniones</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
