"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import type { AppNotificationRow } from "@/lib/notifications";
import { Button } from "@/components/ui/button";

export function NavbarNotificationsBell({
  initialUnreadCount = 0,
}: {
  currentUserId?: string;
  initialNotifications?: AppNotificationRow[];
  initialUnreadCount?: number;
}) {
  return (
    <Button asChild variant={initialUnreadCount > 0 ? "secondary" : "ghost"} size="icon" className="relative">
      <Link href="/account/activity">
        <Bell className="h-5 w-5" />
        {initialUnreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
            {initialUnreadCount > 9 ? "9+" : initialUnreadCount}
          </span>
        ) : null}
        <span className="sr-only">Actividad</span>
      </Link>
    </Button>
  );
}

export default NavbarNotificationsBell;
