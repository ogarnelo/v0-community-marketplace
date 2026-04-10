type OfferAmountSource = {
  accepted_amount?: number | null;
  current_amount?: number | null;
  counter_price?: number | null;
  offered_price?: number | null;
};

export function getAcceptedOfferAmount(offer: OfferAmountSource) {
  return Number(
    offer.accepted_amount ??
    offer.current_amount ??
    offer.counter_price ??
    offer.offered_price ??
    0
  );
}
