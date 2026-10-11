import "server-only";

import { after } from "next/server";
import { track } from "@vercel/analytics/server";

export type ProductEventName =
  | "signup_completed"
  | "school_linked"
  | "course_need_created"
  | "conversation_started"
  | "agreement_confirmed";

type ProductEventData = Record<
  string,
  string | number | boolean | null | undefined
>;

function sanitizeEventData(data: ProductEventData) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) =>
        value === null ||
        value === undefined ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      )
      .filter(([key]) => !/(email|phone|name|address|postal|user_id|student_id|school_id|listing_id|conversation_id|agreement_id)$/i.test(key))
      .map(([key, value]) => [key, value ?? null])
  );
}

export function deferProductEvent(
  eventName: ProductEventName,
  data: ProductEventData = {}
) {
  const safeData = sanitizeEventData(data);

  after(async () => {
    try {
      await track(eventName, safeData);
    } catch (error) {
      console.warn(`No se pudo registrar el evento de producto ${eventName}`, error);
    }
  });
}
