import { Suspense } from "react";
import { SavedLeads } from "@/components/pages/SavedLeads";

export default function Page() {
  // useSearchParams (?lead=) necesita un límite de Suspense.
  return (
    <Suspense>
      <SavedLeads />
    </Suspense>
  );
}
