"use client";

import { Children, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";

export function ExpandableAdminList({
  children,
  initialCount = 5,
}: {
  children: ReactNode;
  initialCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = Children.toArray(children);
  const visible = expanded ? items : items.slice(0, initialCount);
  const hiddenCount = Math.max(0, items.length - initialCount);

  return (
    <>
      {visible}
      {hiddenCount > 0 ? (
        <div className="pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Ver menos" : `Ver más (${hiddenCount})`}
          </Button>
        </div>
      ) : null}
    </>
  );
}
