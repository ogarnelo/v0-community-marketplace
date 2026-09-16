type DemandSignal = {
  query?: string | null;
  isbn_query?: string | null;
  category?: string | null;
  grade_level?: string | null;
  results_count?: number | null;
  created_at?: string | null;
};

export type DemandInsight = {
  label: string;
  kind: "query" | "isbn" | "category" | "grade";
  searches: number;
  zeroResults: number;
  lastSeenAt: string | null;
};

function addInsight(map: Map<string, DemandInsight>, key: string, kind: DemandInsight["kind"], createdAt?: string | null, zero = false) {
  const label = key.trim();
  if (!label) return;
  const mapKey = `${kind}:${label.toLowerCase()}`;
  const current = map.get(mapKey) || { label, kind, searches: 0, zeroResults: 0, lastSeenAt: null };
  current.searches += 1;
  if (zero) current.zeroResults += 1;
  if (createdAt && (!current.lastSeenAt || new Date(createdAt) > new Date(current.lastSeenAt))) {
    current.lastSeenAt = createdAt;
  }
  map.set(mapKey, current);
}

export function buildDemandInsights(signals: DemandSignal[]) {
  const map = new Map<string, DemandInsight>();

  for (const signal of signals) {
    const zero = (signal.results_count || 0) === 0;
    addInsight(map, signal.query || "", "query", signal.created_at, zero);
    addInsight(map, signal.isbn_query || "", "isbn", signal.created_at, zero);
    addInsight(map, signal.category || "", "category", signal.created_at, zero);
    addInsight(map, signal.grade_level || "", "grade", signal.created_at, zero);
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.zeroResults !== a.zeroResults) return b.zeroResults - a.zeroResults;
    return b.searches - a.searches;
  });
}

export function buildDemandActionLabel(insight: DemandInsight) {
  if (insight.kind === "isbn") return "Pedir este ISBN";
  if (insight.kind === "category") return "Reforzar categoría";
  if (insight.kind === "grade") return "Reforzar curso";
  return "Crear campaña";
}
