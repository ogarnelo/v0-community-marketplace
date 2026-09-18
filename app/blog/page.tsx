import type { Metadata } from "next";
import JsonLd from "@/components/seo/json-ld";
import { posts } from "@/lib/blog-data";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { BlogPageClient } from "@/components/blog/blog-page-client";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Guías para ahorrar y reutilizar material escolar",
  description: "Consejos prácticos sobre libros de texto usados, uniformes, ahorro familiar y reutilización de material escolar.",
  alternates: { canonical: "https://www.wetudy.com/blog" },
};

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

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Guías de Wetudy",
    itemListElement: posts.map((post, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `https://www.wetudy.com/blog/${post.slug}`,
      name: post.title,
    })),
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <JsonLd data={itemListJsonLd} />
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