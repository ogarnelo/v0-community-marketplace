"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import MobileBottomNavigation from "@/components/navigation/mobile-bottom-navigation";
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
  Activity,
  Bell,
  BookOpen,
  Heart,
  Home,
  MessageCircle,
  Package,
  Plus,
  Rss,
  ShieldCheck,
  Store,
  User,
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

function CountBadge({ count, floating = false }: { count: number; floating?: boolean }) {
  if (!count || count <= 0) return null;

  return (
    <span
      className={
        floating
          ? "absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white"
          : "ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white"
      }
    >
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
  const [displayName, setDisplayName] = useState(userName || "Mi cuenta");

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

  const publishHref = isLoggedIn ? "/marketplace/new" : "/auth?next=/marketplace/new";
  const messagesHref = isLoggedIn ? "/messages" : "/auth?next=/messages";
  const favoritesHref = isLoggedIn ? "/favorites" : "/auth?next=/favorites";
  const feedHref = isLoggedIn ? "/feed" : "/auth?next=/feed";
  const accountHref = isLoggedIn ? "/account" : "/auth";
  const effectiveAdminHref = adminHref || (isSuperAdmin ? "/admin/super" : isAdmin ? "/admin/school" : undefined);
  const avatarLetter = displayName.trim().charAt(0).toUpperCase() || "U";

  const navItems = [
    { href: "/marketplace", label: "Marketplace", icon: BookOpen, match: "/marketplace" },
    { href: feedHref, label: "Feed", icon: Rss, match: "/feed" },
    { href: favoritesHref, label: "Favoritos", icon: Heart, match: "/favorites" },
    { href: messagesHref, label: "Mensajes", icon: MessageCircle, match: "/messages", count: unreadMessagesCount },
  ];

  const isActive = (match: string) => {
    if (!pathname) return false;
    if (match === "/marketplace") return pathname.startsWith("/marketplace") && pathname !== "/marketplace/new";
    return pathname.startsWith(match);
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
            {navItems.map(({ href, label, icon: Icon, match, count }) => (
              <Button key={href + label} asChild variant={isActive(match) ? "secondary" : "ghost"} size="sm" className="gap-1.5">
                <Link href={href} className="relative">
                  <Icon className="h-4 w-4" />
                  {label}
                  <CountBadge count={count || 0} />
                </Link>
              </Button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <>
                <Button asChild className="hidden gap-1.5 sm:inline-flex" size="sm">
                  <Link href={publishHref}>
                    <Plus className="h-4 w-4" />
                    Publicar
                  </Link>
                </Button>

                <Button asChild variant="ghost" size="icon" className="relative hidden md:inline-flex">
                  <Link href="/account/activity">
                    <Bell className="h-5 w-5" />
                    <CountBadge count={unreadNotificationsCount} floating />
                    <span className="sr-only">Actividad</span>
                  </Link>
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-2 px-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary text-sm text-primary-foreground">
                          {avatarLetter}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden max-w-[180px] truncate text-sm font-medium sm:inline">
                        {displayName}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="w-64">
                    <div className="px-2 py-2">
                      <p className="truncate text-sm font-semibold">{displayName}</p>
                      <p className="text-xs text-muted-foreground">Tu espacio personal</p>
                    </div>
                    <DropdownMenuSeparator />

                    <DropdownMenuItem asChild>
                      <Link href={accountHref} className="gap-2">
                        <User className="h-4 w-4" />
                        Mi cuenta
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild>
                      <Link href="/account/activity" className="gap-2">
                        <Activity className="h-4 w-4" />
                        Actividad
                        <CountBadge count={unreadNotificationsCount} />
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild>
                      <Link href="/account/listings" className="gap-2">
                        <Package className="h-4 w-4" />
                        Mis anuncios
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild>
                      <Link href={favoritesHref} className="gap-2">
                        <Heart className="h-4 w-4" />
                        Favoritos
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild>
                      <Link href={feedHref} className="gap-2">
                        <Rss className="h-4 w-4" />
                        Feed personalizado
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild>
                      <Link href="/account/business" className="gap-2">
                        <Store className="h-4 w-4" />
                        Panel profesional
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
        </div>
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
