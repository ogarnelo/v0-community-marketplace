export type BoostPlanId = "boost_7_days" | "boost_14_days" | "boost_30_days";

export type BoostPlan = {
  id: BoostPlanId;
  name: string;
  description: string;
  days: number;
  amountCents: number;
  currency: "eur";
  badge: string;
};

export const BOOST_PLANS: BoostPlan[] = [
  {
    id: "boost_7_days",
    name: "Destacar 7 días",
    description: "Vuelve a subir tu anuncio y muéstralo como destacado durante una semana.",
    days: 7,
    amountCents: 299,
    currency: "eur",
    badge: "Popular",
  },
  {
    id: "boost_14_days",
    name: "Destacar 14 días",
    description: "Ideal para productos con más competencia o negocios con más catálogo.",
    days: 14,
    amountCents: 499,
    currency: "eur",
    badge: "Más visibilidad",
  },
  {
    id: "boost_30_days",
    name: "Destacar 30 días",
    description: "Máxima duración para productos clave de temporada.",
    days: 30,
    amountCents: 899,
    currency: "eur",
    badge: "Campaña",
  },
];

export function getBoostPlan(planId: string | null | undefined) {
  return BOOST_PLANS.find((plan) => plan.id === planId) || BOOST_PLANS[0];
}

export function formatBoostPrice(amountCents: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100);
}

export function getFeaturedUntil(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}
