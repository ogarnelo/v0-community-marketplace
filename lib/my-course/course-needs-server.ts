import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_TITLE_LENGTH = 180;
const MAX_ISBN_LENGTH = 32;
const MAX_CATEGORY_LENGTH = 80;

export type CourseNeedInput = {
  studentId: string;
  title: string;
  isbn: string | null;
  category: string;
};

export type CourseNeedRow = {
  id: string;
  owner_user_id: string;
  student_id: string;
  title: string;
  isbn: string | null;
  category: string;
  academic_year: string;
  demand_request_id: string | null;
  status: "active" | "fulfilled" | "archived";
  created_at: string;
  updated_at: string;
};

export class CourseNeedError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "invalid_request") {
    super(message);
    this.name = "CourseNeedError";
    this.status = status;
    this.code = code;
  }
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIsbn(value: string) {
  return value.replace(/[^0-9xX]/g, "").toUpperCase();
}

export function parseCourseNeedInput(body: any): CourseNeedInput {
  const studentId = cleanText(body?.studentId, 64);
  const title = cleanText(body?.title, MAX_TITLE_LENGTH);
  const rawIsbn = cleanText(body?.isbn, MAX_ISBN_LENGTH);
  const isbn = rawIsbn ? normalizeIsbn(rawIsbn) : "";
  const category = cleanText(body?.category, MAX_CATEGORY_LENGTH);

  if (!UUID_RE.test(studentId)) {
    throw new CourseNeedError("Selecciona un estudiante válido.", 400, "invalid_student");
  }

  if (!title && !isbn) {
    throw new CourseNeedError("Añade un título o un ISBN.", 400, "missing_need");
  }

  if (!category) {
    throw new CourseNeedError("Selecciona una categoría.", 400, "missing_category");
  }

  return {
    studentId,
    title: title || isbn,
    isbn: isbn || null,
    category,
  };
}

async function getOwnedActiveStudent(userId: string, studentId: string) {
  const admin = createAdminClient();
  const { data: student, error } = await admin
    .from("account_students")
    .select("id, owner_user_id, active, academic_year")
    .eq("id", studentId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (!student || !student.active) {
    throw new CourseNeedError(
      "Ese estudiante ya no está disponible en tu cuenta.",
      404,
      "student_not_found"
    );
  }

  return student;
}

export async function listCourseNeeds(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("course_needs")
    .select(
      "id, owner_user_id, student_id, title, isbn, category, academic_year, demand_request_id, status, created_at, updated_at"
    )
    .eq("owner_user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as CourseNeedRow[];
}

export type FulfilledCourseNeedSummary = {
  id: string;
  student_id: string;
  title: string;
  isbn: string | null;
  category: string;
  academic_year: string;
  demand_request_id: string | null;
  fulfilled_at: string;
  listing_id: string | null;
  listing_title: string | null;
  listing_status: string | null;
  agreement_id: string | null;
  agreement_type: string | null;
  agreement_amount: number | null;
  agreement_confirmed_at: string | null;
  conversation_id: string | null;
};

export async function listFulfilledCourseNeeds(
  userId: string
): Promise<FulfilledCourseNeedSummary[]> {
  const admin = createAdminClient();
  const { data: needs, error: needsError } = await admin
    .from("course_needs")
    .select(
      "id, student_id, title, isbn, category, academic_year, demand_request_id, created_at, updated_at"
    )
    .eq("owner_user_id", userId)
    .eq("status", "fulfilled")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (needsError) throw needsError;
  if (!needs?.length) return [];

  const demandIds = Array.from(
    new Set(
      needs
        .map((need: any) => need.demand_request_id)
        .filter((id: string | null): id is string => Boolean(id))
    )
  );

  let demands: any[] = [];
  if (demandIds.length > 0) {
    const { data, error } = await admin
      .from("demand_requests")
      .select(
        "id, resolved_at, confirmed_agreement_id, matched_listing_id, conversation_id"
      )
      .eq("user_id", userId)
      .eq("source", "course_need")
      .in("id", demandIds);

    if (error) throw error;
    demands = data || [];
  }

  const agreementIds = Array.from(
    new Set(
      demands
        .map((demand: any) => demand.confirmed_agreement_id)
        .filter((id: string | null): id is string => Boolean(id))
    )
  );

  let agreements: any[] = [];
  if (agreementIds.length > 0) {
    const { data, error } = await admin
      .from("agreements")
      .select(
        "id, listing_id, conversation_id, agreement_type, status, amount, confirmed_at, demand_request_id"
      )
      .eq("status", "confirmed")
      .in("id", agreementIds);

    if (error) throw error;
    agreements = data || [];
  }

  const demandById = new Map(demands.map((demand: any) => [demand.id, demand]));
  const agreementById = new Map(
    agreements.map((agreement: any) => [agreement.id, agreement])
  );

  const listingIds = Array.from(
    new Set(
      demands
        .flatMap((demand: any) => {
          const agreement = demand.confirmed_agreement_id
            ? agreementById.get(demand.confirmed_agreement_id)
            : null;
          return [agreement?.listing_id, demand.matched_listing_id];
        })
        .filter((id: string | null | undefined): id is string => Boolean(id))
    )
  );

  let listings: any[] = [];
  if (listingIds.length > 0) {
    const { data, error } = await admin
      .from("listings")
      .select("id, title, status")
      .in("id", listingIds);

    if (error) throw error;
    listings = data || [];
  }

  const listingById = new Map(listings.map((listing: any) => [listing.id, listing]));

  return needs.map((need: any) => {
    const demand = need.demand_request_id
      ? demandById.get(need.demand_request_id) || null
      : null;
    const agreement = demand?.confirmed_agreement_id
      ? agreementById.get(demand.confirmed_agreement_id) || null
      : null;
    const listingId = agreement?.listing_id || demand?.matched_listing_id || null;
    const listing = listingId ? listingById.get(listingId) || null : null;
    const rawAmount = agreement?.amount;
    const agreementAmount =
      rawAmount == null || Number.isNaN(Number(rawAmount))
        ? null
        : Number(rawAmount);

    return {
      id: need.id,
      student_id: need.student_id,
      title: need.title,
      isbn: need.isbn || null,
      category: need.category,
      academic_year: need.academic_year,
      demand_request_id: need.demand_request_id || null,
      fulfilled_at:
        agreement?.confirmed_at ||
        demand?.resolved_at ||
        need.updated_at ||
        need.created_at,
      listing_id: listing?.id || listingId,
      listing_title: listing?.title || null,
      listing_status: listing?.status || null,
      agreement_id: agreement?.id || null,
      agreement_type: agreement?.agreement_type || null,
      agreement_amount: agreementAmount,
      agreement_confirmed_at: agreement?.confirmed_at || null,
      conversation_id:
        agreement?.conversation_id || demand?.conversation_id || null,
    };
  });
}

export async function createCourseNeed(userId: string, input: CourseNeedInput) {
  const admin = createAdminClient();
  const student = await getOwnedActiveStudent(userId, input.studentId);

  const { data: existingRows, error: existingError } = await admin
    .from("course_needs")
    .select("id, title, isbn, category")
    .eq("owner_user_id", userId)
    .eq("student_id", input.studentId)
    .eq("academic_year", student.academic_year)
    .eq("status", "active")
    .limit(200);

  if (existingError) throw existingError;

  const normalizedTitle = normalizeText(input.title);
  const normalizedIsbn = input.isbn ? normalizeIsbn(input.isbn) : "";

  const duplicate = (existingRows || []).find((row) => {
    if (normalizedIsbn && row.isbn) {
      return normalizeIsbn(row.isbn) === normalizedIsbn;
    }

    return (
      !normalizedIsbn &&
      !row.isbn &&
      normalizeText(row.title || "") === normalizedTitle &&
      normalizeText(row.category || "") === normalizeText(input.category)
    );
  });

  if (duplicate) {
    throw new CourseNeedError(
      "Esta necesidad ya está en Mi curso.",
      409,
      "need_exists"
    );
  }

  const { data, error } = await admin
    .from("course_needs")
    .insert({
      owner_user_id: userId,
      student_id: input.studentId,
      title: input.title,
      isbn: input.isbn,
      category: input.category,
      academic_year: student.academic_year,
      status: "active",
    })
    .select(
      "id, owner_user_id, student_id, title, isbn, category, academic_year, demand_request_id, status, created_at, updated_at"
    )
    .single();

  if (error) throw error;
  return data as CourseNeedRow;
}

export async function archiveCourseNeed(userId: string, needId: string) {
  if (!UUID_RE.test(needId)) {
    throw new CourseNeedError("La necesidad no es válida.", 400, "invalid_need");
  }

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("course_needs")
    .select("id, status")
    .eq("id", needId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (!existing || existing.status !== "active") {
    throw new CourseNeedError(
      "Esa necesidad ya no está disponible.",
      404,
      "need_not_found"
    );
  }

  const { data, error } = await admin
    .from("course_needs")
    .update({
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("id", needId)
    .eq("owner_user_id", userId)
    .select("id, status, updated_at")
    .single();

  if (error) throw error;
  return data;
}
