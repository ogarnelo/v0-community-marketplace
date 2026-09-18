import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export const metadata: Metadata = {
  title: "Cambiar contraseña | Wetudy",
  robots: {
    index: false,
    follow: false,
  },
};

export default function UpdatePasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-card p-6 lg:p-10">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold font-mono text-foreground">Wetudy</span>
          </Link>
        </div>
        <UpdatePasswordForm />
      </div>
    </div>
  );
}
