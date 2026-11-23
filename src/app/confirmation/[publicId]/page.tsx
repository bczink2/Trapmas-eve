import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getStore } from "@/lib/store";
import { STATUS_LABELS, type SubmissionStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { publicId } = await params;
  const { token } = await searchParams;
  const submission = token ? await (await getStore()).getByResumeToken(token) : null;
  const matches = submission?.publicId === publicId ? submission : null;
  const label = matches ? STATUS_LABELS[matches.status as SubmissionStatus] || matches.status : "";
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl space-y-4 px-4 py-10">
        <h1 className="display text-5xl text-primary">{publicId}</h1>
        {matches ? (
          <>
            <p>Status: {label}.</p>
            <p className="text-muted-foreground">
              {matches.status === "payment_pending"
                ? "Our team still needs to confirm the Cash App payment. The confirmation email is sent after that."
                : matches.paidAt
                  ? "Payment is confirmed. Watch your email for the decision."
                  : "This application is saved."}
            </p>
          </>
        ) : (
          <p>If this payment was yours, the confirmation email arrives after our team marks it paid. This page does not show another artist&apos;s application.</p>
        )}
        <Link href="/" className="underline">
          Back to TRAPMAS EVE
        </Link>
      </main>
    </>
  );
}
