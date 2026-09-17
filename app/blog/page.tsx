import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { BlogPageClient } from "@/components/blog/blog-page-client";
import { createClient } from "@/lib/supabase/server";
import { createPublicMetadata } from "@/lib/seo/site";

export const metadata = createPublicMetadata({
  title: "Guías para reutilizar material escolar",
  description:
    "Consejos prácticos sobre libros de texto usados, uniformes escolares, ahorro familiar y reutilización de material educativo.",
  path: "/blog",
});

export default async function BlogPage() {
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
        <BlogPageClient />
      </main>
      <Footer />
    </div>
  );
}