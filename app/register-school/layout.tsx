import { Navbar } from "@/components/navbar";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { createClient } from "@/lib/supabase/server";

export default async function RegisterSchoolLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);

  return (
    <>
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
      {children}
    </>
  );
}
