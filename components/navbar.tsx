"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { NavbarMessagesBadge } from "@/components/messages/navbar-messages-badge";
import { NavbarNotificationsBell } from "@/components/notifications/navbar-notifications-bell";
import { createClient } from "@/lib/supabase/client";
import type { AppNotificationRow } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Menu,
  X,
  BookOpen,
  MessageCircle,
  Plus,
  User,
  LogOut,
  Package,
  ShieldCheck,
  Heart,
  Activity,
} from "lucide-react";

interface NavbarProps {
  isLoggedIn?: boolean;
  userName?: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  adminHref?: string;
  unreadMessagesCount?: number;
  unreadNotificationsCount?: number;
  notifications?: AppNotificationRow[];
  currentUserId?: string;
}

type ProfileUpdatedEventDetail = {
  full_name?: string | null;
};

export function Navbar({
  isLoggedIn = false,
  userName = "Mi cuenta",
  isAdmin = false,
  isSuperAdmin = false,
  adminHref,
  unreadMessagesCount = 0,
  unreadNotificationsCount = 0,
  notifications = [],
  currentUserId,
}: NavbarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(userName);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    setDisplayName(userName || "Mi cuenta");
  }, [userName]);

  useEffect(() => {
    const handleProfileUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<ProfileUpdatedEventDetail>;
      const nextName = customEvent.detail?.full_name?.trim();

      if (nextName) {
        setDisplayName(nextName);
      }
    };

    window.addEventListener("profile-updated", handleProfileUpdated);

    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdated);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const publishHref = isLoggedIn ? "/marketplace/new" : "/auth?next=/marketplace/new";
  const effectiveAdminHref = adminHref || (isSuperAdmin ? "/admin/super" : isAdmin ? "/admin/school" : undefined);
  const avatarLetter = displayName.trim().charAt(0).toUpperCase() || "U";
  const showMessagesBadge = Boolean(currentUserId);

  const navItems = useMemo(
    () => [
      { href: "/marketplace", label: "Marketplace", icon: BookOpen },
      { href: "/favorites", label: "Favoritos", icon: Heart },
      { href: publishHref, label: "Publicar", icon: Plus },
      { href: "/messages", label: "Mensajes", icon: MessageCircle },
    ],
    [publishHref]
  );

  const handleMobileLogout = async () => {
    setIsLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.assign("/auth");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href.includes("?")) return false;
    if (href === "/") return pathname === "/";
    if (href === "/marketplace/new") return pathname === "/marketplace/new";
    if (href === "/marketplace") return pathname === "/marketplace" || pathname.startsWith("/marketplace/listing");
    if (href === "/messages") return pathname === "/messages" || pathname.startsWith("/messages/");
    if (href === "/favorites") return pathname === "/favorites";
    if (href === "/account/activity") return pathname === "/account/activity" || pathname.startsWith("/account/activity/");
    return pathname === href;
  };

  const mobileMenu = open && typeof document !== "undefined"
    ? createPortal(
        <div className="fixed inset-0 z-[100] md:hidden" role="presentation">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            className="absolute inset-y-0 right-0 flex w-[min(86vw,20rem)] flex-col overflow-y-auto border-l border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
              {isLoggedIn ? (
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">{avatarLetter}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                    <p className="text-xs text-muted-foreground">Tu espacio personal</p>
                  </div>
                </div>
              ) : (
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
                    <BookOpen className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <span className="font-mono text-lg font-bold text-foreground">Wetudy</span>
                </div>
              )}
              <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
                <span className="sr-only">Cerrar menú</span>
              </Button>
            </div>

            {isLoggedIn ? (
              <nav className="flex flex-col gap-1 py-5">
                {navItems.map(({ href, label, icon: Icon }) => (
                  <Button
                    key={href + label}
                    asChild
                    variant={isActive(href) ? "secondary" : "ghost"}
                    className="min-h-11 w-full justify-start gap-2"
                  >
                    <Link href={href} onClick={() => setOpen(false)}>
                      <Icon className="h-4 w-4" />
                      {label}
                      {href === "/messages" && showMessagesBadge ? (
                        <span className="ml-auto">
                          <NavbarMessagesBadge
                            currentUserId={currentUserId as string}
                            initialCount={unreadMessagesCount}
                          />
                        </span>
                      ) : null}
                    </Link>
                  </Button>
                ))}

                <Button asChild variant="ghost" className="min-h-11 w-full justify-start gap-2">
                  <Link href="/account" onClick={() => setOpen(false)}>
                    <User className="h-4 w-4" />
                    Mi cuenta
                  </Link>
                </Button>

                <Button asChild variant="ghost" className="min-h-11 w-full justify-start gap-2">
                  <Link href="/account/activity" onClick={() => setOpen(false)}>
                    <Activity className="h-4 w-4" />
                    Actividad
                    {unreadNotificationsCount > 0 ? (
                      <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                        {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
                      </span>
                    ) : null}
                  </Link>
                </Button>

                <Button asChild variant="ghost" className="min-h-11 w-full justify-start gap-2">
                  <Link href="/account/listings" onClick={() => setOpen(false)}>
                    <Package className="h-4 w-4" />
                    Mis anuncios
                  </Link>
                </Button>

                {effectiveAdminHref ? (
                  <Button asChild variant="ghost" className="min-h-11 w-full justify-start gap-2">
                    <Link href={effectiveAdminHref} onClick={() => setOpen(false)}>
                      <ShieldCheck className="h-4 w-4" />
                      Panel admin
                    </Link>
                  </Button>
                ) : null}

                <div className="my-2 border-t border-border" />

                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 w-full justify-start gap-2 text-destructive"
                  disabled={isLoggingOut}
                  onClick={handleMobileLogout}
                >
                  <LogOut className="h-4 w-4" />
                  {isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
                </Button>
              </nav>
            ) : (
              <nav className="flex flex-col gap-2 py-5">
                <Button asChild variant="ghost" className="min-h-11 w-full justify-start gap-2">
                  <Link href="/marketplace" onClick={() => setOpen(false)}>
                    <BookOpen className="h-4 w-4" />
                    Marketplace
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="min-h-11 w-full justify-start gap-2">
                  <Link href="/auth" onClick={() => setOpen(false)}>
                    <User className="h-4 w-4" />
                    Iniciar sesión
                  </Link>
                </Button>
                <Button asChild variant="outline" className="min-h-11 w-full justify-start gap-2">
                  <Link href="/auth?mode=signup" onClick={() => setOpen(false)}>
                    <User className="h-4 w-4" />
                    Crear cuenta
                  </Link>
                </Button>
                <Button asChild className="min-h-11 w-full justify-start gap-2">
                  <Link href={publishHref} onClick={() => setOpen(false)}>
                    <Plus className="h-4 w-4" />
                    Publicar
                  </Link>
                </Button>
              </nav>
            )}
          </aside>
        </div>,
        document.body
      )
    : null;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="truncate font-mono text-xl font-bold tracking-tight text-foreground">Wetudy</span>
        </Link>

        {isLoggedIn ? (
          <>
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Button
                  key={href + label}
                  asChild
                  variant={isActive(href) ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-1.5"
                >
                  <Link href={href} className="relative">
                    <Icon className="h-4 w-4" />
                    {label}
                    {href === "/messages" && showMessagesBadge ? (
                      <NavbarMessagesBadge
                        currentUserId={currentUserId as string}
                        initialCount={unreadMessagesCount}
                      />
                    ) : null}
                  </Link>
                </Button>
              ))}
            </nav>

            <div className="hidden items-center gap-2 md:flex">
              {currentUserId ? (
                <NavbarNotificationsBell
                  currentUserId={currentUserId}
                  initialNotifications={notifications}
                  initialUnreadCount={unreadNotificationsCount}
                />
              ) : null}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-sm text-primary-foreground">
                        {avatarLetter}
                      </AvatarFallback>
                    </Avatar>
                    <span className="max-w-[180px] truncate text-sm font-medium">{displayName}</span>
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link href="/account" className="gap-2">
                      <User className="h-4 w-4" />
                      Mi cuenta
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild>
                    <Link href="/account/activity" className="gap-2">
                      <Activity className="h-4 w-4" />
                      Actividad
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild>
                    <Link href="/account/listings" className="gap-2">
                      <Package className="h-4 w-4" />
                      Mis anuncios
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild>
                    <Link href="/favorites" className="gap-2">
                      <Heart className="h-4 w-4" />
                      Favoritos
                    </Link>
                  </DropdownMenuItem>

                  {effectiveAdminHref ? (
                    <DropdownMenuItem asChild>
                      <Link href={effectiveAdminHref} className="gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        Panel admin
                      </Link>
                    </DropdownMenuItem>
                  ) : null}

                  <DropdownMenuSeparator />
                  <LogoutButton />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden"
              aria-expanded={open}
              aria-controls="mobile-navigation"
              onClick={() => setOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </>
        ) : (
          <>
            <div className="hidden items-center gap-2 md:flex">
              <Button asChild variant="ghost" size="sm">
                <Link href="/marketplace">Marketplace</Link>
              </Button>

              <Button asChild variant="ghost" size="sm">
                <Link href="/auth">Iniciar sesión</Link>
              </Button>

              <Button asChild variant="outline" size="sm">
                <Link href="/auth?mode=signup">Crear cuenta</Link>
              </Button>

              <Button asChild size="sm" className="gap-1.5">
                <Link href={publishHref}>
                  <Plus className="h-4 w-4" />
                  Publicar
                </Link>
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden"
              aria-expanded={open}
              aria-controls="mobile-navigation"
              onClick={() => setOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </>
        )}
      </div>
      {mobileMenu}
    </header>
  );
}
