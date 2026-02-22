"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Menu, BookOpen, MessageCircle, Plus, User, LogOut, Settings, Package, ShieldCheck } from "lucide-react"

interface NavbarProps {
  isLoggedIn?: boolean
  userName?: string
  isAdmin?: boolean
}

export function Navbar({ isLoggedIn = false, userName = "Ana", isAdmin = false }: NavbarProps) {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground font-mono">Wetudy</span>
        </Link>

        {isLoggedIn ? (
          <>
            {/* Desktop nav */}
            <nav className="hidden items-center gap-1 md:flex">
              <Link href="/marketplace">
                <Button variant="ghost" size="sm">Marketplace</Button>
              </Link>
              <Link href="/marketplace/new">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Publicar
                </Button>
              </Link>
              <Link href="/messages">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <MessageCircle className="h-4 w-4" />
                  Mensajes
                </Button>
              </Link>
            </nav>

            <div className="hidden items-center gap-3 md:flex">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {userName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{userName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href="/account" className="gap-2">
                      <User className="h-4 w-4" /> Mi cuenta
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/account/listings" className="gap-2">
                      <Package className="h-4 w-4" /> Mis anuncios
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin/school" className="gap-2">
                        <ShieldCheck className="h-4 w-4" /> Panel Admin
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/auth" className="gap-2 text-destructive">
                      <LogOut className="h-4 w-4" /> Cerrar sesion
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile nav */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Abrir menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <nav className="flex flex-col gap-2 pt-8">
                  <Link href="/marketplace" onClick={() => setOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <BookOpen className="h-4 w-4" /> Marketplace
                    </Button>
                  </Link>
                  <Link href="/marketplace/new" onClick={() => setOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <Plus className="h-4 w-4" /> Publicar anuncio
                    </Button>
                  </Link>
                  <Link href="/messages" onClick={() => setOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <MessageCircle className="h-4 w-4" /> Mensajes
                    </Button>
                  </Link>
                  <Link href="/account" onClick={() => setOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <User className="h-4 w-4" /> Mi cuenta
                    </Button>
                  </Link>
                  <Link href="/account/listings" onClick={() => setOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <Package className="h-4 w-4" /> Mis anuncios
                    </Button>
                  </Link>
                  {isAdmin && (
                    <Link href="/admin/school" onClick={() => setOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start gap-2">
                        <ShieldCheck className="h-4 w-4" /> Panel Admin
                      </Button>
                    </Link>
                  )}
                  <div className="my-2 border-t border-border" />
                  <Link href="/auth" onClick={() => setOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-2 text-destructive">
                      <LogOut className="h-4 w-4" /> Cerrar sesion
                    </Button>
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/marketplace" className="hidden sm:block">
              <Button variant="ghost" size="sm">Marketplace</Button>
            </Link>
            <Link href="/auth">
              <Button variant="ghost" size="sm">Iniciar sesion</Button>
            </Link>
            <Link href="/auth?mode=signup">
              <Button variant="outline" size="sm">Crear cuenta</Button>
            </Link>
            <Link href="/marketplace/new">
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Vender</span>
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
