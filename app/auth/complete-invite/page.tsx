import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompleteSchoolInviteForm } from "@/components/auth/complete-school-invite-form";

export default async function CompleteInvitePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?auth_error=invalid_link");
  }

  const schoolName =
    typeof user.user_metadata?.school_name === "string"
      ? user.user_metadata.school_name
      : null;

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center px-4 py-10">
      <div className="w-full">
        <CompleteSchoolInviteForm schoolName={schoolName} />
      </div>
    </main>
  );
}
