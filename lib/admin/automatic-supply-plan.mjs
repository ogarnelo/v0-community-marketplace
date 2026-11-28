// Pure, bounded planning; no writes or notification side effects.
export async function planAutomaticSupply({load, candidates, revalidate}, limits = {}) {
  const maxOpportunities = limits.maxOpportunities ?? 5;
  const maxTargets = limits.maxTargets ?? 20;
  if (!Number.isInteger(maxOpportunities) || maxOpportunities < 1 || maxOpportunities > 5 ||
      !Number.isInteger(maxTargets) || maxTargets < 1 || maxTargets > 20) throw new Error("invalid_supply_budget");
  const opportunities = await load();
  if (!Array.isArray(opportunities)) throw new Error("invalid_demand_snapshot");
  const plan = [];
  const seen = new Set();
  let inspected = 0;
  for (const opportunity of opportunities) {
    if (inspected >= maxOpportunities || seen.size >= maxTargets) break;
    if (!["new","offer_search","sellers_contacted","supply_generated"].includes(opportunity.status) ||
        !Number.isInteger(opportunity.familiesCount) || opportunity.familiesCount < 1 ||
        !Number.isInteger(opportunity.supplyCount) || opportunity.supplyCount < 0 ||
        opportunity.supplyCount >= opportunity.familiesCount) continue;
    inspected++;
    const batch = await candidates(opportunity);
    const cap = Math.min(maxTargets - seen.size, opportunity.familiesCount - opportunity.supplyCount);
    const requested = [...new Set(batch.candidates.filter(c => c.contactAllowed === true && !seen.has(c.userId) &&
      !opportunity.demandUserIds.includes(c.userId)).map(c => c.userId))].slice(0,cap);
    if (!requested.length) continue;
    const valid = new Set(await revalidate(opportunity, requested));
    const targets = requested.filter(id => valid.has(id));
    for (const id of targets) seen.add(id);
    if (targets.length) plan.push({key: opportunity.key, targets});
  }
  return {plan, inspected, targets: seen.size};
}
