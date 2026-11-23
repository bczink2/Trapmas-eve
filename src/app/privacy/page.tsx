import { LegalDocument } from "@/components/legal-document";

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return <LegalDocument title="Privacy" field="privacyText" />;
}
