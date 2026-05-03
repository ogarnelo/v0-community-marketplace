"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  HeartHandshake,
  MessageCircle,
  PlusCircle,
  Rss,
  ShieldCheck,
  Store,
  User,
} from "lucide-react";

function CountBadge({ count }: { count: number }) {
  if (!count || count <= 0) return null;

  return (
    <span className="absolute -right-2 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export default function MobileBottomNavigation({
  isLoggedIn,
  unreadMessagesCount = 0,
}: {
  isLoggedIn: boolean;
  currentUserId?: string;
  unreadMessagesCount?: number;
}) {
  const pathname = usePathname();

  const hideOnRoutes = ["/marketplace/listing/", "/messages/", "/checkout", "/boosts", "/auth"];
  if (hideOnRoutes.some((route) => pathname?.startsWith(route))) return null;

  const loggedItems = [
    { href: "/marketplace", label: "Explorar", icon: BookOpen, match: "/marketplace" },
    { href: "/feed", label: "Feed", icon: Rss, match: "/feed" },
    { href: "/marketplace/new", label: "Publicar", icon: PlusCircle, match: "/marketplace/new", featured: true },
    { href: "/messages", label: "Chats", icon: MessageCircle, match: "/messages", count: unreadMessagesCount },
    { href: "/account", label: "Cuenta", icon: User, match: "/account" },
  ];

  const publicItems = [
    { href: "/marketplace", label: "Explorar", icon: BookOpen, match: "/marketplace" },
    { href: "/negocios", label: "Negocios", icon: Store, match: "/negocios" },
    { href: "/seguridad", label: "Seguridad", icon: ShieldCheck, match: "/seguridad" },
    { href: "/marketplace/new", label: "Vender", icon: PlusCircle, match: "/marketplace/new", featured: true },
    { href: "/auth", label: "Entrar", icon: User, match: "/auth" },
  ];

  const items = isLoggedIn ? loggedItems : publicItems;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-1.5 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {items.map((item) => {
          const active =
            item.match === "/marketplace/new"
              ? pathname === item.match
              : pathname?.startsWith(item.match);
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-medium transition active:scale-[0.98] ${
                item.featured
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground"
              }`}
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                <CountBadge count={item.count || 0} />
              </span>
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
