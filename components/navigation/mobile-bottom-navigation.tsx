"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Heart, MessageCircle, PlusCircle, User } from "lucide-react";
import { NavbarMessagesBadge } from "@/components/messages/navbar-messages-badge";

export default function MobileBottomNavigation({
  isLoggedIn,
  currentUserId,
  unreadMessagesCount = 0,
}: {
  isLoggedIn: boolean;
  currentUserId?: string;
  unreadMessagesCount?: number;
}) {
  const pathname = usePathname();
  const publishHref = isLoggedIn ? "/marketplace/new" : "/auth?next=/marketplace/new";
  const accountHref = isLoggedIn ? "/account" : "/auth";
  const messagesHref = isLoggedIn ? "/messages" : "/auth?next=/messages";
  const favoritesHref = isLoggedIn ? "/favorites" : "/auth?next=/favorites";

  const items = [
    { href: "/marketplace", label: "Explorar", icon: BookOpen, match: "/marketplace" },
    { href: favoritesHref, label: "Guardados", icon: Heart, match: "/favorites" },
    { href: publishHref, label: "Publicar", icon: PlusCircle, match: "/marketplace/new", featured: true },
    { href: messagesHref, label: "Chats", icon: MessageCircle, match: "/messages", messages: true },
    { href: accountHref, label: "Cuenta", icon: User, match: "/account" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-1.5 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {items.map((item) => {
          const active = item.match === "/marketplace/new" ? pathname === item.match : pathname?.startsWith(item.match);
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
                {item.messages && currentUserId ? (
                  <NavbarMessagesBadge currentUserId={currentUserId} initialCount={unreadMessagesCount} />
                ) : null}
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
