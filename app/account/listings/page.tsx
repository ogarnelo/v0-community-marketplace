"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { currentUser, getListingsBySeller, conditionLabels } from "@/lib/mock-data"
import type { Listing, ListingStatus } from "@/lib/mock-data"
import { Plus, MoreVertical, Eye, Pencil, Archive, RotateCcw, Trash2, Heart, Package } from "lucide-react"
import { toast } from "sonner"

const statusConfig: Record<ListingStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  active: { label: "Activo", variant: "default" },
  reserved: { label: "Reservado", variant: "secondary" },
  completed: { label: "Vendido", variant: "outline" },
  archived: { label: "Archivado", variant: "outline" },
}



export default function MyListingsPage() {
  const allListings = getListingsBySeller(currentUser.id)
  const [localListings, setLocalListings] = useState<Listing[]>(allListings)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const activeListings = localListings.filter(l => l.status === "active")
  const reservedListings = localListings.filter(l => l.status === "reserved")
  const archivedListings = localListings.filter(l => ["completed", "archived"].includes(l.status))

  function handleArchive(id: string) {
    setLocalListings(prev => prev.map(l => l.id === id ? { ...l, status: "archived" as ListingStatus } : l))
    toast.success("Anuncio archivado")
  }

  function handleReactivate(id: string) {
    setLocalListings(prev => prev.map(l => l.id === id ? { ...l, status: "active" as ListingStatus } : l))
    toast.success("Anuncio reactivado")
  }

  function handleDelete(id: string) {
    setLocalListings(prev => prev.filter(l => l.id !== id))
    setDeleteTarget(null)
    toast.success("Anuncio eliminado")
  }

  function ListingRow({ listing }: { listing: Listing }) {
    const status = statusConfig[listing.status]

    return (
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted">
              <span className="text-2xl text-muted-foreground/30 font-mono">
                {listing.category.charAt(0)}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-foreground">{listing.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {listing.category} &middot; {listing.gradeLevel} &middot; {conditionLabels[listing.condition]}
                  </p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Opciones</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/marketplace/listing/${listing.id}`} className="gap-2">
                        <Eye className="h-4 w-4" /> Ver anuncio
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/marketplace/edit/${listing.id}`} className="gap-2">
                        <Pencil className="h-4 w-4" /> Editar
                      </Link>
                    </DropdownMenuItem>
                    {listing.status === "active" && (
                      <DropdownMenuItem className="gap-2" onClick={() => handleArchive(listing.id)}>
                        <Archive className="h-4 w-4" /> Archivar
                      </DropdownMenuItem>
                    )}
                    {["archived", "completed"].includes(listing.status) && (
                      <DropdownMenuItem className="gap-2" onClick={() => handleReactivate(listing.id)}>
                        <RotateCcw className="h-4 w-4" /> Reactivar
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="gap-2 text-destructive focus:text-destructive"
                      onClick={() => setDeleteTarget(listing.id)}
                    >
                      <Trash2 className="h-4 w-4" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <Badge variant={status.variant} className="text-xs">
                  {status.label}
                </Badge>
                {listing.type === "donation" ? (
                  <Badge variant="outline" className="gap-1 text-xs text-secondary">
                    <Heart className="h-3 w-3" /> Donacion
                  </Badge>
                ) : (
                  <span className="text-sm font-bold text-foreground">{listing.price}&euro;</span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(listing.createdAt).toLocaleDateString("es-ES")}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  function EmptyState({ message }: { message: string }) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        <Link href="/marketplace/new" className="mt-4">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Publicar anuncio
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-background">
        <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Mis anuncios</h1>
              <p className="text-sm text-muted-foreground">{localListings.length} anuncios en total</p>
            </div>
            <Link href="/marketplace/new">
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Publicar
              </Button>
            </Link>
          </div>

          <Tabs defaultValue="active" className="mt-6">
            <TabsList className="w-full">
              <TabsTrigger value="active" className="flex-1">
                Activos ({activeListings.length})
              </TabsTrigger>
              <TabsTrigger value="reserved" className="flex-1">
                Reservados ({reservedListings.length})
              </TabsTrigger>
              <TabsTrigger value="archived" className="flex-1">
                Archivados ({archivedListings.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4 flex flex-col gap-3">
              {activeListings.length > 0 ? (
                activeListings.map(listing => <ListingRow key={listing.id} listing={listing} />)
              ) : (
                <EmptyState message="No tienes anuncios activos" />
              )}
            </TabsContent>

            <TabsContent value="reserved" className="mt-4 flex flex-col gap-3">
              {reservedListings.length > 0 ? (
                reservedListings.map(listing => <ListingRow key={listing.id} listing={listing} />)
              ) : (
                <EmptyState message="No tienes anuncios reservados" />
              )}
            </TabsContent>

            <TabsContent value="archived" className="mt-4 flex flex-col gap-3">
              {archivedListings.length > 0 ? (
                archivedListings.map(listing => <ListingRow key={listing.id} listing={listing} />)
              ) : (
                <EmptyState message="No tienes anuncios archivados" />
              )}
            </TabsContent>
          </Tabs>
        </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar anuncio</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. El anuncio se eliminara permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
