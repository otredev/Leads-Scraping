import { Suspense } from "react";
import { Leads } from "@/components/pages/Leads";

export default function Page() {
  // useSearchParams (?search=) necesita un límite de Suspense.
  return (
    <Suspense>
      <Leads />
    </Suspense>
  );
}
