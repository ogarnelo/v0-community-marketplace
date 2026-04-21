export type ShipmentTier = "none" | "small" | "medium" | "large";

export type SendcloudAddress = {
  name: string;
  company_name?: string | null;
  address: string;
  address_2?: string | null;
  city: string;
  postal_code: string;
  country: string;
  email?: string | null;
  telephone?: string | null;
};

export type SendcloudCreateShipmentInput = {
  shipmentId: string;
  orderNumber: string;
  itemAmount: number;
  shipmentTier: ShipmentTier;
  recipient: SendcloudAddress;
};

type SendcloudMethod = {
  id: number;
  name: string;
  carrier?: string;
  min_weight?: string;
  max_weight?: string;
};

const SENDCLOUD_BASE_URL = "https://panel.sendcloud.sc/api/v2";

function getAuthHeader() {
  const publicKey = process.env.SENDCLOUD_PUBLIC_KEY;
  const secretKey = process.env.SENDCLOUD_SECRET_KEY;

  if (!publicKey || !secretKey) {
    return null;
  }

  const token = Buffer.from(`${publicKey}:${secretKey}`).toString("base64");
  return `Basic ${token}`;
}

export function isSendcloudConfigured() {
  return Boolean(getAuthHeader());
}

async function sendcloudFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeader = getAuthHeader();
  if (!authHeader) {
    throw new Error("Sendcloud no está configurado.");
  }

  const response = await fetch(`${SENDCLOUD_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Sendcloud ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

function getApproxWeightForTier(tier: ShipmentTier) {
  switch (tier) {
    case "small":
      return 1;
    case "medium":
      return 3;
    case "large":
      return 8;
    default:
      return 1;
  }
}

function getConfiguredMethodIdForTier(tier: ShipmentTier): number | null {
  const raw =
    tier === "small"
      ? process.env.SENDCLOUD_SHIPPING_METHOD_ID_SMALL
      : tier === "medium"
        ? process.env.SENDCLOUD_SHIPPING_METHOD_ID_MEDIUM
        : tier === "large"
          ? process.env.SENDCLOUD_SHIPPING_METHOD_ID_LARGE
          : null;

  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

async function resolveShippingMethodId(recipient: SendcloudAddress, shipmentTier: ShipmentTier) {
  const explicitMethodId = getConfiguredMethodIdForTier(shipmentTier);
  if (explicitMethodId) {
    return explicitMethodId;
  }

  const params = new URLSearchParams();
  if (process.env.SENDCLOUD_SENDER_ADDRESS_ID) {
    params.set("sender_address", process.env.SENDCLOUD_SENDER_ADDRESS_ID);
  }
  params.set("to_country", recipient.country);
  params.set("to_postal_code", recipient.postal_code);

  const data = await sendcloudFetch<{ shipping_methods?: SendcloudMethod[] }>(`/shipping_methods?${params.toString()}`);
  const methods = data.shipping_methods || [];
  if (methods.length === 0) {
    throw new Error("No hay métodos de envío disponibles en Sendcloud para ese destino.");
  }

  const weight = getApproxWeightForTier(shipmentTier);
  const matchByWeight = methods.find((method) => {
    const min = Number(method.min_weight ?? 0);
    const max = Number(method.max_weight ?? 9999);
    return weight >= min && weight <= max;
  });

  return matchByWeight?.id || methods[0].id;
}

export async function createSendcloudParcel(input: SendcloudCreateShipmentInput) {
  const shippingMethodId = await resolveShippingMethodId(input.recipient, input.shipmentTier);
  const weight = getApproxWeightForTier(input.shipmentTier).toFixed(3);

  const payload = {
    parcel: {
      name: input.recipient.name,
      company_name: input.recipient.company_name || undefined,
      address: input.recipient.address,
      address_2: input.recipient.address_2 || undefined,
      city: input.recipient.city,
      postal_code: input.recipient.postal_code,
      telephone: input.recipient.telephone || undefined,
      email: input.recipient.email || undefined,
      country: input.recipient.country,
      request_label: true,
      shipment: { id: shippingMethodId },
      weight,
      quantity: 1,
      order_number: input.orderNumber,
      insured_value: 0,
      total_order_value_currency: "EUR",
      total_order_value: Number(input.itemAmount || 0).toFixed(2),
      data: {
        wetudy_shipment_id: input.shipmentId,
      },
      ...(process.env.SENDCLOUD_SENDER_ADDRESS_ID
        ? { sender_address: Number(process.env.SENDCLOUD_SENDER_ADDRESS_ID) }
        : {}),
    },
  };

  const data = await sendcloudFetch<{
    parcel?: {
      id: number;
      tracking_number?: string | null;
      tracking_url?: string | null;
      documents?: Array<{ type?: string; link?: string }>;
      label?: { normal_printer?: string[]; label_printer?: string | null };
      shipment?: { id?: number; name?: string };
      status?: { message?: string };
    };
  }>("/parcels", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const parcel = data.parcel;
  if (!parcel?.id) {
    throw new Error("Sendcloud no devolvió un parcel válido.");
  }

  const labelDocument = parcel.documents?.find((doc) => doc.type === "label")?.link || null;
  const labelUrl = labelDocument || parcel.label?.label_printer || parcel.label?.normal_printer?.[0] || null;

  return {
    providerShipmentId: String(parcel.id),
    trackingCode: parcel.tracking_number || null,
    trackingUrl: parcel.tracking_url || null,
    labelUrl,
    serviceName: parcel.shipment?.name || null,
    providerStatus: parcel.status?.message || null,
    shippingMethodId,
  };
}
