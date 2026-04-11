import { getListingTypeFromRow } from "@/lib/marketplace/listing-type";
import { isValidListingStatus, type ListingStatus } from "@/lib/marketplace/listing-status";

export const MAX_OFFER_ROUNDS = 10;

export function normalizeListingStatus(value?: string | null): ListingStatus {
  if (isValidListingStatus(value)) return value;
  return "archived";
}

export function canStartConversationForStatus(status?: string | null) {
  return normalizeListingStatus(status) === "available";
}

export function canCreateOffer(params: {
  listing?: {
    status?: string | null;
    type?: string | null;
    listing_type?: string | null;
    seller_id?: string | null;
  } | null;
  currentUserId: string;
}) {
  const listing = params.listing;

  if (!listing) {
    return { ok: false as const, error: "El anuncio no existe." };
  }

  if (getListingTypeFromRow(listing) !== "sale") {
    return { ok: false as const, error: "Solo se permiten ofertas en anuncios de venta." };
  }

  if (!canStartConversationForStatus(listing.status)) {
    return { ok: false as const, error: "Este anuncio ya no acepta nuevas ofertas." };
  }

  if (!listing.seller_id || listing.seller_id === params.currentUserId) {
    return { ok: false as const, error: "No puedes ofertar sobre tu propio anuncio." };
  }

  return { ok: true as const };
}

export function canRequestDonation(params: {
  listing?: {
    status?: string | null;
    type?: string | null;
    listing_type?: string | null;
    seller_id?: string | null;
  } | null;
  currentUserId: string;
}) {
  const listing = params.listing;

  if (!listing) {
    return { ok: false as const, error: "El anuncio no existe." };
  }

  if (getListingTypeFromRow(listing) !== "donation") {
    return { ok: false as const, error: "Solo se permiten solicitudes en anuncios de donación." };
  }

  if (!canStartConversationForStatus(listing.status)) {
    return { ok: false as const, error: "Este anuncio ya no acepta nuevas solicitudes." };
  }

  if (!listing.seller_id || listing.seller_id === params.currentUserId) {
    return { ok: false as const, error: "No puedes solicitar tu propia donación." };
  }

  return { ok: true as const };
}

export function getOfferCurrentTurn(params: {
  status?: string | null;
  currentActor?: string | null;
}) {
  if (params.currentActor === "buyer" || params.currentActor === "seller") {
    return params.currentActor;
  }

  return params.status === "countered" ? "buyer" : "seller";
}

export function canRespondToOfferTurn(params: {
  buyerId: string;
  sellerId: string;
  actorUserId: string;
  currentActor?: string | null;
  status?: string | null;
}) {
  const turn = getOfferCurrentTurn({
    currentActor: params.currentActor,
    status: params.status,
  });

  if (turn === "seller" && params.actorUserId !== params.sellerId) {
    return { ok: false as const, error: "No puedes responder a esta oferta en este momento." };
  }

  if (turn === "buyer" && params.actorUserId !== params.buyerId) {
    return { ok: false as const, error: "No puedes responder a esta oferta en este momento." };
  }

  return { ok: true as const, turn };
}
