import { Suspense } from "react";
import { Results } from "@/components/pages/Results";

export default function Page() {
  // useSearchParams (?search=) necesita un límite de Suspense.
  return (
    <Suspense>
      <Results />
    </Suspense>
  );
}
