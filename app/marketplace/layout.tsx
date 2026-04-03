import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";

export const dynamic = "force-dynamic";

export default async function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar
        isLoggedIn={navbarData.isLoggedIn}
        userName={navbarData.userName}
        isAdmin={navbarData.isAdmin}
        isSuperAdmin={navbarData.isSuperAdmin}
        adminHref={navbarData.adminHref}
        unreadMessagesCount={navbarData.unreadMessagesCount}
        unreadNotificationsCount={navbarData.unreadNotificationsCount}
        notifications={navbarData.notifications}
        currentUserId={navbarData.currentUserId}
      />

      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

