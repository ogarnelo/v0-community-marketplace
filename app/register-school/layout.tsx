import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function RegisterSchoolLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/register-school");
  }

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
