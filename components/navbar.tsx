"use client";

import { useEffect, useMemo, useState } from "react";
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
  user_type?: string | null;
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
  const [hydrated, setHydrated] = useState(false);
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

  useEffect(() => {
    let cancelled = false;

    const syncSessionAndRoles = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (!user) {
          setResolvedState({
            isLoggedIn: false,
            userName: "Mi cuenta",
            isAdmin: false,
            isSuperAdmin: false,
            currentUserId: undefined,
          });
          setHydrated(true);
          return;
        }

        const [{ data: profile }, { data: roles }] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .maybeSingle<{ full_name: string | null }>(),
          supabase
            .from("user_roles")
            .select("role, school_id")
            .eq("user_id", user.id)
            .returns<AdminRoleRow[]>(),
        ]);

        if (cancelled) return;

        const adminFlags = getAdminFlags({
          email: user.email,
          roles: (roles || []) as AdminRoleRow[],
        });

        const nextUserName =
          profile?.full_name?.trim() ||
          user.user_metadata?.full_name ||
          user.email ||
          "Mi cuenta";

        setResolvedState({
          isLoggedIn: true,
          userName: nextUserName,
          isAdmin: adminFlags.canAccessAdmin,
          isSuperAdmin: adminFlags.isSuperAdmin,
          currentUserId: user.id,
        });
      } catch (error) {
        console.error("Error sincronizando navbar:", error);
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    };

    void syncSessionAndRoles();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
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
        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", session.user.id)
          .maybeSingle<{ full_name: string | null }>(),
        supabase
          .from("user_roles")
          .select("role, school_id")
          .eq("user_id", session.user.id)
          .returns<AdminRoleRow[]>(),
      ]);

      const adminFlags = getAdminFlags({
        email: session.user.email,
        roles: (roles || []) as AdminRoleRow[],
      });

      setResolvedState({
        isLoggedIn: true,
        userName:
          profile?.full_name?.trim() ||
          session.user.user_metadata?.full_name ||
          session.user.email ||
          "Mi cuenta",
        isAdmin: adminFlags.canAccessAdmin,
        isSuperAdmin: adminFlags.isSuperAdmin,
        currentUserId: session.user.id,
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

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

  useEffect(() => {
    if (!resolvedState.currentUserId) return;

    const channel = supabase
      .channel(`navbar-profile-${resolvedState.currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${resolvedState.currentUserId}`,
        },
        (payload) => {
          const nextProfile = payload.new as {
            full_name?: string | null;
          };

          const nextName =
            nextProfile?.full_name && nextProfile.full_name.trim().length > 0
              ? nextProfile.full_name.trim()
              : "Mi cuenta";

          setResolvedState((prev) => ({
            ...prev,
            userName: nextName,
          }));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [resolvedState.currentUserId, supabase]);

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

        {!hydrated ? (
          <div className="flex items-center gap-2 opacity-0">
            <Button variant="ghost" size="sm">
              Placeholder
            </Button>
          </div>
        ) : effectiveIsLoggedIn ? (
          <>
            <nav className="hidden items-center gap-1 md:flex">
              <Link href="/marketplace">
                <Button variant="ghost" size="sm">
                  Marketplace
                </Button>
              </Link>

              <Link href="/favorites">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <Heart className="h-4 w-4" />
                  Favoritos
                </Button>
              </Link>

              <Link href={publishHref}>
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Publicar
                </Button>
              </Link>

              <Link href="/messages">
                <Button variant="ghost" size="sm" className="relative gap-1.5">
                  <MessageCircle className="h-4 w-4" />
                  Mensajes

                  {effectiveCurrentUserId ? (
                    <NavbarMessagesBadge
                      currentUserId={effectiveCurrentUserId}
                      initialCount={unreadMessagesCount}
                    />
                  ) : null}
                </Button>
              </Link>
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
                        Panel Admin
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
                  <span className="sr-only">Abrir menú</span>
                </Button>
              </SheetTrigger>

              <SheetContent side="right" className="w-72">
                <nav className="flex flex-col gap-2 pt-8">
                  <Link href="/marketplace" onClick={() => setOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <BookOpen className="h-4 w-4" />
                      Marketplace
                    </Button>
                  </Link>

                  <Link href="/favorites" onClick={() => setOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <Heart className="h-4 w-4" />
                      Favoritos
                    </Button>
                  </Link>

                  <Link href={publishHref} onClick={() => setOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <Plus className="h-4 w-4" />
                      Publicar anuncio
                    </Button>
                  </Link>

                  <Link href="/messages" onClick={() => setOpen(false)}>
                    <Button
                      variant="ghost"
                      className="relative w-full justify-start gap-2"
                    >
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
                    </Button>
                  </Link>

                  <Link href="/account" onClick={() => setOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <User className="h-4 w-4" />
                      Mi cuenta
                    </Button>
                  </Link>

                  <Link href="/account/listings" onClick={() => setOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <Package className="h-4 w-4" />
                      Mis anuncios
                    </Button>
                  </Link>

                  {effectiveCanAccessAdmin ? (
                    <Link href={adminHref} onClick={() => setOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        Panel Admin
                      </Button>
                    </Link>
                  ) : null}

                  <div className="my-2 border-t border-border" />

                  <button
                    type="button"
                    onClick={async () => {
                      setOpen(false);
                      const supabaseClient = createClient();
                      await supabaseClient.auth.signOut();
                      window.location.assign("/auth");
                    }}
                    className="w-full"
                  >
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      Cerrar sesión
                    </Button>
                  </button>
                </nav>
              </SheetContent>
            </Sheet>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/marketplace" className="hidden sm:block">
              <Button variant="ghost" size="sm">
                Marketplace
              </Button>
            </Link>

            <Link href="/auth">
              <Button variant="ghost" size="sm">
                Iniciar sesión
              </Button>
            </Link>

            <Link href="/auth?mode=signup">
              <Button variant="outline" size="sm">
                Crear cuenta
              </Button>
            </Link>

            <Link href={publishHref}>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Vender</span>
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}