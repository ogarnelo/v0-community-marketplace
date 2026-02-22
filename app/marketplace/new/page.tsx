"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { categories, gradeLevels, conditions, bookFormats, bookLanguages, currentSchool } from "@/lib/mock-data"
import { Loader2, ImagePlus, ArrowLeft, X, HelpCircle, BookOpen } from "lucide-react"
import Link from "next/link"

export default function NewListingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isDonation, setIsDonation] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState("")

  const isTextbook = selectedCategory === "Libros de texto"

  const handleAddPhoto = () => {
    if (photos.length < 5) {
      setPhotos(prev => [...prev, `Foto ${prev.length + 1}`])
    }
  }

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      router.push("/marketplace")
    }, 1000)
  }

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6 lg:px-8">
        <Link href="/marketplace" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Volver al marketplace
        </Link>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl text-foreground">Publicar anuncio</CardTitle>
            <CardDescription>Publica material escolar para vender o donar a tu comunidad en {currentSchool.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {/* Title */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="title">Titulo *</Label>
                <Input id="title" placeholder="Ej: Libro Matematicas 3o ESO" required />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="description">Descripcion *</Label>
                <Textarea id="description" placeholder="Describe el estado, editorial, edicion..." rows={4} required />
              </div>

              {/* Category + Grade */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Categoria *</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory} required>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Curso / Etapa *</Label>
                  <Select required>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {gradeLevels.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Condition */}
              <div className="flex flex-col gap-2">
                <Label>Estado del material *</Label>
                <Select required>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {conditions.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <div className="flex flex-col py-0.5">
                          <span className="font-medium">{c.label}</span>
                          <span className="text-xs text-muted-foreground leading-snug">{c.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Textbook-specific fields */}
              {isTextbook && (
                <Card className="border-border bg-muted/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base text-foreground">
                      <BookOpen className="h-4 w-4 text-primary" />
                      Detalles del libro
                    </CardTitle>
                    <CardDescription className="text-xs">Campos opcionales para libros de texto</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor="isbn">ISBN</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full">
                              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="sr-only">Que es el ISBN</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 text-sm" side="top">
                            <p className="font-semibold text-foreground">Que es el ISBN?</p>
                            <p className="mt-1 text-muted-foreground leading-relaxed">
                              ISBN son las siglas de International Standard Book Number y consiste en un codigo que nos sirve para identificar de manera unica cada producto editorial.
                            </p>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <Input id="isbn" placeholder="978-84-XXXXXXXXX" />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="author">Autor</Label>
                      <Input id="author" placeholder="Nombre del autor" />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="publisher">Editorial</Label>
                      <Input id="publisher" placeholder="Ej: SM, Anaya, Santillana..." />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label>Formato</Label>
                        <Select>
                          <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                          <SelectContent>
                            {bookFormats.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Idioma</Label>
                        <Select>
                          <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                          <SelectContent>
                            {bookLanguages.map(lang => <SelectItem key={lang} value={lang}>{lang}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Type toggle */}
              <div className="flex items-center gap-4 rounded-lg border border-border p-4">
                <div className="flex-1">
                  <p className="font-medium text-foreground">{isDonation ? "Donacion" : "Venta"}</p>
                  <p className="text-sm text-muted-foreground">
                    {isDonation ? "El admin de tu centro gestionara las solicitudes" : "Establece un precio para tu material"}
                  </p>
                </div>
                <Switch checked={isDonation} onCheckedChange={setIsDonation} />
              </div>

              {/* Price */}
              {!isDonation && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="price">Precio *</Label>
                    <div className="relative">
                      <Input id="price" type="number" min="0" step="0.5" placeholder="0" className="pr-8" required />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">&euro;</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="originalPrice">Precio original (opcional)</Label>
                    <div className="relative">
                      <Input id="originalPrice" type="number" min="0" step="0.5" placeholder="0" className="pr-8" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">&euro;</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Photos */}
              <div className="flex flex-col gap-2">
                <Label>Fotos (max. 5)</Label>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {photos.map((photo, i) => (
                    <div key={i} className="relative aspect-square rounded-lg border border-border bg-muted">
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        {photo}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(i)}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {photos.length < 5 && (
                    <button
                      type="button"
                      onClick={handleAddPhoto}
                      className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-border transition-colors hover:border-primary hover:bg-primary/5"
                    >
                      <ImagePlus className="h-6 w-6 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>

              {/* Location */}
              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">
                  Ubicacion: <span className="font-medium text-foreground">{currentSchool.name}, {currentSchool.city}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Se usara la ubicacion aproximada de tu centro</p>
              </div>

              {/* Submit */}
              <div className="flex gap-3">
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Publicar anuncio
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
