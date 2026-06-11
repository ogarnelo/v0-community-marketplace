"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export default function OpportunityActionLink({
  href,
  opportunityKey,
  actionType,
  roleContext,
  children,
  className,
}: {
  href: string;
  opportunityKey: string;
  actionType: "publish_clicked" | "business_contact_clicked" | "saved_for_later" | "supplier_outreach";
  roleContext?: string;
  children: ReactNode;
  className?: string;
}) {
  const track = () => {
    void fetch("/api/demand/opportunity-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        opportunityKey,
        actionType,
        roleContext,
        metadata: {
          href,
        },
      }),
    }).catch(() => null);
  };

  return (
    <Link href={href} onClick={track} className={className}>
      {children}
    </Link>
  );
}
