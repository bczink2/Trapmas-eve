import { Suspense } from "react";
import { SubmissionsTable } from "@/components/admin/submissions-table";

export default function SubmissionsPage() {
  return (
    <Suspense fallback={<p>Loading submissions…</p>}>
      <SubmissionsTable />
    </Suspense>
  );
}
