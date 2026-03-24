import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { RegisterSchoolForm } from "@/components/register-school/register-school-form";
import { createClient } from "@/lib/supabase/server";

export default async function RegisterSchoolPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userName = "Mi cuenta";

  if (user?.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle<{ full_name: string | null }>();

    userName = profile?.full_name?.trim() || user.email || "Mi cuenta";
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar
        isLoggedIn={Boolean(user)}
        userName={userName}
        currentUserId={user?.id}
      />
      <main className="flex-1">
        <RegisterSchoolForm />
      </main>
      <Footer />
    </div>
  );
}