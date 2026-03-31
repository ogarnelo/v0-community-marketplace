"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { NavbarMessagesBadge } from "@/components/messages/navbar-messages-badge";
import { createClient } from "@/lib/supabase/client";
import { getAdminFlags, type AdminRoleRow } from "@/lib/admin/roles";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
  BookOpen,
  MessageCircle,
  Plus,
  User,
  LogOut,
  Package,
  ShieldCheck,
  Heart,
} from "lucide-react";

interface NavbarProps {
  isLoggedIn?: boolean;
  userName?: string;
  isAdmin?: boolean;
  unreadMessagesCount?: number;
  currentUserId?: string;
}

type ProfileUpdatedEventDetail = {
  full_name?: string | null;
};

type NavbarResolvedState = {
  isLoggedIn: boolean;
  userName: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  currentUserId?: string;
};

export function Navbar({
  isLoggedIn,
  userName = "Mi cuenta",
  isAdmin = false,
  unreadMessagesCount = 0,
  currentUserId,
}: NavbarProps) {
  const [open, setOpen] = useState(false);
  const [resolvedState, setResolvedState] = useState<NavbarResolvedState>({
    isLoggedIn: Boolean(isLoggedIn),
    userName,
    isAdmin,
    isSuperAdmin: false,
    currentUserId,
  });

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setResolvedState((prev) => ({
      ...prev,
      isLoggedIn: Boolean(isLoggedIn),
      userName,
      isAdmin,
      currentUserId,
    }));
  }, [isLoggedIn, userName, isAdmin, currentUserId]);

  const hydrateUserState = useCallback(
    async (userOverride?: { id: string; email?: string | null; user_metadata?: Record<string, any> } | null) => {
      try {
        const user = userOverride ?? (await supabase.auth.getUser()).data.user;

        if (!user) {
          setResolvedState({
            isLoggedIn: false,
            userName: "Mi cuenta",
            isAdmin: false,
            isSuperAdmin: false,
            currentUserId: undefined,
          });
          return;
        }

        const [{ data: profile }, { data: roles }] = await Promise.all([
          supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
          supabase
            .from("user_roles")
            .select("role, school_id")
            .eq("user_id", user.id)
            .returns<AdminRoleRow[]>(),
        ]);

        const adminFlags = getAdminFlags({
          email: user.email,
          roles: (roles || []) as AdminRoleRow[],
        });

        setResolvedState({
          isLoggedIn: true,
          userName:
            profile?.full_name?.trim() ||
            user.user_metadata?.full_name ||
            user.email ||
            "Mi cuenta",
          isAdmin: adminFlags.canAccessAdmin,
          isSuperAdmin: adminFlags.isSuperAdmin,
          currentUserId: user.id,
        });
      } catch (error) {
        console.error("Error sincronizando navbar:", error);
      }
    },
    [supabase]
  );

  useEffect(() => {
    void hydrateUserState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void hydrateUserState(
        session?.user
          ? {
            id: session.user.id,
            email: session.user.email,
            user_metadata: session.user.user_metadata,
          }
          : null
      );
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [hydrateUserState, supabase]);

  useEffect(() => {
    const handleProfileUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<ProfileUpdatedEventDetail>;
      const nextName =
        customEvent.detail?.full_name && customEvent.detail.full_name.trim().length > 0
          ? customEvent.detail.full_name.trim()
          : "Mi cuenta";

      setResolvedState((prev) => ({
        ...prev,
        userName: nextName,
      }));
    };

    window.addEventListener("profile-updated", handleProfileUpdated);

    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdated);
    };
  }, []);

  const effectiveIsLoggedIn = resolvedState.isLoggedIn;
  const effectiveUserName = resolvedState.userName;
  const effectiveCurrentUserId = resolvedState.currentUserId;
  const effectiveIsSuperAdmin = resolvedState.isSuperAdmin;
  const effectiveCanAccessAdmin = resolvedState.isAdmin || resolvedState.isSuperAdmin;

  const publishHref = effectiveIsLoggedIn
    ? "/marketplace/new"
    : "/auth?next=/marketplace/new";

  const adminHref = effectiveIsSuperAdmin ? "/admin/super" : "/admin/school";

  const avatarLetter =
    effectiveUserName && effectiveUserName.trim().length > 0
      ? effectiveUserName.trim().charAt(0).toUpperCase()
      : "U";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-mono text-xl font-bold tracking-tight text-foreground">
            Wetudy
          </span>
        </Link>

        {effectiveIsLoggedIn ? (
          <>
            <nav className="hidden items-center gap-1 md:flex">
              <Button asChild variant="ghost" size="sm">
                <Link href="/marketplace">Marketplace</Link>
              </Button>

              <Button asChild variant="ghost" size="sm" className="gap-1.5">
                <Link href="/favorites">
                  <Heart className="h-4 w-4" />
                  Favoritos
                </Link>
              </Button>

              <Button asChild variant="ghost" size="sm" className="gap-1.5">
                <Link href={publishHref}>
                  <Plus className="h-4 w-4" />
                  Publicar
                </Link>
              </Button>

              <Button asChild variant="ghost" size="sm" className="relative gap-1.5">
                <Link href="/messages">
                  <MessageCircle className="h-4 w-4" />
                  Mensajes
                  {effectiveCurrentUserId ? (
                    <NavbarMessagesBadge
                      currentUserId={effectiveCurrentUserId}
                      initialCount={unreadMessagesCount}
                    />
                  ) : null}
                </Link>
              </Button>
            </nav>

            <div className="hidden items-center gap-3 md:flex">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-sm text-primary-foreground">
                        {avatarLetter}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{effectiveUserName}</span>
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href="/account" className="gap-2">
                      <User className="h-4 w-4" />
                      Mi cuenta
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

                  {effectiveCanAccessAdmin ? (
                    <DropdownMenuItem asChild>
                      <Link href={adminHref} className="gap-2">
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

            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Abrir men√∫</span>
                </Button>
              </SheetTrigger>

              <SheetContent side="right" className="w-72">
                <nav className="flex flex-col gap-2 pt-8">
                  <Button asChild variant="ghost" className="w-full justify-start gap-2">
                    <Link href="/marketplace" onClick={() => setOpen(false)}>
                      <BookOpen className="h-4 w-4" />
                      Marketplace
                    </Link>
                  </Button>

                  <Button asChild variant="ghost" className="w-full justify-start gap-2">
                    <Link href="/favorites" onClick={() => setOpen(false)}>
                      <Heart className="h-4 w-4" />
                      Favoritos
                    </Link>
                  </Button>

                  <Button asChild variant="ghost" className="w-full justify-start gap-2">
                    <Link href={publishHref} onClick={() => setOpen(false)}>
                      <Plus className="h-4 w-4" />
                      Publicar anuncio
                    </Link>
                  </Button>

                  <Button asChild variant="ghost" className="relative w-full justify-start gap-2">
                    <Link href="/messages" onClick={() => setOpen(false)}>
                      <MessageCircle className="h-4 w-4" />
                      Mensajes
                      {effectiveCurrentUserId ? (
                        <span className="ml-auto">
                          <NavbarMessagesBadge
                            currentUserId={effectiveCurrentUserId}
                            initialCount={unreadMessagesCount}
                          />
                        </span>
                      ) : null}
                    </Link>
                  </Button>

                  <Button asChild variant="ghost" className="w-full justify-start gap-2">
                    <Link href="/account" onClick={() => setOpen(false)}>
                      <User className="h-4 w-4" />
                      Mi cuenta
                    </Link>
                  </Button>

                  <Button asChild variant="ghost" className="w-full justify-start gap-2">
                    <Link href="/account/listings" onClick={() => setOpen(false)}>
                      <Package className="h-4 w-4" />
                      Mis anuncios
                    </Link>
                  </Button>

                  {effectiveCanAccessAdmin ? (
                    <Button asChild variant="ghost" className="w-full justify-start gap-2">
                      <Link href={adminHref} onClick={() => setOpen(false)}>
                        <ShieldCheck className="h-4 w-4" />
                        Panel admin
                      </Link>
                    </Button>
                  ) : null}

                  <div className="my-2 border-t border-border" />

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-start gap-2 text-destructive"
                    onClick={async () => {
                      setOpen(false);
                      const supabaseClient = createClient();
                      await supabaseClient.auth.signOut();
                      window.location.assign("/auth");
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesi√≥n
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/marketplace">Marketplace</Link>
            </Button>

            <Button asChild variant="ghost" size="sm">
              <Link href="/auth">Iniciar sesi√≥n</Link>
            </Button>

            <Button asChild variant="outline" size="sm">
              <Link href="/auth?mode=signup">Crear cuenta</Link>
            </Button>

            <Button asChild size="sm" className="gap-1.5">
              <Link href={publishHref}>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Vender</span>
              </Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

