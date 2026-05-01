import Link from "next/link";

export default function ReportTransactionIssueButton({
  paymentIntentId,
}: {
  paymentIntentId: string;
}) {
  return (
    <Link
      href={`/account/issues/new?payment_intent_id=${paymentIntentId}`}
      className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
    >
      Tengo un problema
    </Link>
  );
}
