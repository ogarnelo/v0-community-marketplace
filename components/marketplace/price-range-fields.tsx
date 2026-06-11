"use client";

import { useState } from "react";

export default function PriceRangeFields({
  minPrice,
  maxPrice,
}: {
  minPrice: string;
  maxPrice: string;
}) {
  const [min, setMin] = useState(minPrice || "");
  const [max, setMax] = useState(maxPrice || "");

  return (
    <div className="space-y-3 rounded-2xl border bg-muted/30 p-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Precio mín.</span>
          <input
            name="minPrice"
            value={min}
            onChange={(event) => setMin(event.target.value)}
            placeholder="0"
            inputMode="decimal"
            className="h-11 w-full rounded-xl border bg-background px-3 text-sm shadow-sm"
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Precio máx.</span>
          <input
            name="maxPrice"
            value={max}
            onChange={(event) => setMax(event.target.value)}
            placeholder="50"
            inputMode="decimal"
            className="h-11 w-full rounded-xl border bg-background px-3 text-sm shadow-sm"
          />
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>0 €</span>
          <span>250 €+</span>
        </div>
        <input
          type="range"
          min="0"
          max="250"
          step="5"
          value={max || "250"}
          onChange={(event) => setMax(event.target.value)}
          className="w-full"
          aria-label="Precio máximo"
        />
      </div>
    </div>
  );
}
