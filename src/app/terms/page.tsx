import { LegalDocument } from "@/components/legal-document";

export const dynamic = "force-dynamic";

export default function TermsPage() {
  return <LegalDocument title="Terms" field="termsText" />;
}
