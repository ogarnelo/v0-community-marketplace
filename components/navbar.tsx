"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Heart, MessageCircle, Plus, User, Package, ShieldCheck, Activity, Menu, X, LogOut, Bell } from "lucide-react";
import MobileBottomNavigation from "@/components/navigation/mobile-bottom-navigation";
import type { AppNotificationRow } from "@/lib/notifications";
import { Button } from "@/components/ui/button";

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

function CountBadge({ count }: { count: number }) {
  if (!count || count <= 0) return null;

  return (
    <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function Navbar({
  isLoggedIn = false,
  userName = "Mi cuenta",
  isAdmin = false,
  isSuperAdmin = false,
  adminHref,
  unreadMessagesCount = 0,
  unreadNotificationsCount = 0,
  currentUserId,
}: NavbarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [displayName, setDisplayName] = useState(userName || "Mi cuenta");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    setDisplayName(userName || "Mi cuenta");
  }, [userName]);

  useEffect(() => {
    const handleProfileUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<ProfileUpdatedEventDetail>;
      const nextName = customEvent.detail?.full_name?.trim();
      if (nextName) setDisplayName(nextName);
    };

    window.addEventListener("profile-updated", handleProfileUpdated);
    return () => window.removeEventListener("profile-updated", handleProfileUpdated);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const publishHref = isLoggedIn ? "/marketplace/new" : "/auth?next=/marketplace/new";
  const messagesHref = isLoggedIn ? "/messages" : "/auth?next=/messages";
  const favoritesHref = isLoggedIn ? "/favorites" : "/auth?next=/favorites";
  const accountHref = isLoggedIn ? "/account" : "/auth";
  const effectiveAdminHref = adminHref || (isSuperAdmin ? "/admin/super" : isAdmin ? "/admin/school" : undefined);
  const avatarLetter = displayName.trim().charAt(0).toUpperCase() || "U";

  const navItems = [
    { href: "/marketplace", label: "Marketplace", icon: BookOpen },
    { href: favoritesHref, label: "Favoritos", icon: Heart },
    { href: publishHref, label: "Publicar", icon: Plus },
    { href: messagesHref, label: "Mensajes", icon: MessageCircle, count: unreadMessagesCount },
  ];

  const accountItems = [
    { href: accountHref, label: "Mi cuenta", icon: User },
    { href: "/account/activity", label: "Actividad", icon: Activity, count: unreadNotificationsCount },
    { href: "/account/listings", label: "Mis anuncios", icon: Package },
    { href: favoritesHref, label: "Favoritos", icon: Heart },
    ...(effectiveAdminHref ? [{ href: effectiveAdminHref, label: "Panel admin", icon: ShieldCheck }] : []),
  ];

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/marketplace") return pathname.startsWith("/marketplace") && pathname !== "/marketplace/new";
    if (href === "/messages") return pathname.startsWith("/messages");
    if (href === "/favorites") return pathname.startsWith("/favorites");
    if (href === "/account") return pathname === "/account";
    return pathname === href;
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.assign("/auth");
    } catch {
      window.location.assign("/auth");
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="truncate font-mono text-xl font-bold tracking-tight text-foreground">Wetudy</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map(({ href, label, icon: Icon, count }) => (
              <Button key={href + label} asChild variant={isActive(href) ? "secondary" : "ghost"} size="sm" className="gap-1.5">
                <Link href={href}>
                  <Icon className="h-4 w-4" />
                  {label}
                  <CountBadge count={count || 0} />
                </Link>
              </Button>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {isLoggedIn ? (
              <>
                <Button asChild variant="ghost" size="icon" className="relative">
                  <Link href="/account/activity">
                    <Bell className="h-5 w-5" />
                    {unreadNotificationsCount > 0 ? (
                      <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                        {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
                      </span>
                    ) : null}
                    <span className="sr-only">Actividad</span>
                  </Link>
                </Button>

                <Link href="/account" className="flex max-w-[220px] items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {avatarLetter}
                  </span>
                  <span className="truncate text-sm font-medium">{displayName}</span>
                </Link>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/marketplace">Marketplace</Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/auth">Iniciar sesión</Link>
                </Button>
                <Button asChild size="sm" className="gap-1.5">
                  <Link href={publishHref}>
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Vender</span>
                  </Link>
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted md:hidden"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen ? (
          <div className="border-t border-border bg-card p-4 shadow-sm md:hidden">
            {isLoggedIn ? (
              <div className="mb-4 flex items-center gap-3 rounded-2xl bg-muted p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {avatarLetter}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{displayName}</p>
                  <p className="text-xs text-muted-foreground">Tu espacio personal</p>
                </div>
              </div>
            ) : null}

            <nav className="grid gap-1">
              {[...navItems, ...(isLoggedIn ? accountItems : [])].map(({ href, label, icon: Icon, count }) => (
                <Link
                  key={href + label}
                  href={href}
                  className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium hover:bg-muted"
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                  <span className="ml-auto"><CountBadge count={count || 0} /></span>
                </Link>
              ))}

              {isLoggedIn ? (
                <button
                  type="button"
                  className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-sm font-medium text-destructive hover:bg-muted"
                  disabled={isLoggingOut}
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  {isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
                </button>
              ) : (
                <Link href="/auth?mode=signup" className="mt-2 flex min-h-11 items-center justify-center rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground">
                  Crear cuenta
                </Link>
              )}
            </nav>
          </div>
        ) : null}
      </header>

      <MobileBottomNavigation
        isLoggedIn={isLoggedIn}
        currentUserId={currentUserId}
        unreadMessagesCount={unreadMessagesCount}
      />
    </>
  );
}

export default Navbar;
