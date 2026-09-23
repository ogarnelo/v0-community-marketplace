import { Suspense } from "react";
import { SchoolInviteActivation } from "@/components/auth/school-invite-activation";

export default function SchoolInvitePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center px-4 py-10">
      <div className="w-full">
        <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-muted" />}>
          <SchoolInviteActivation />
        </Suspense>
      </div>
    </main>
  );
}
