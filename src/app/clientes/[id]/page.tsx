import { Suspense } from "react";
import { ClientDetail } from "@/components/pages/ClientDetail";

export default function Page() {
  // useParams / useSearchParams (?proyecto=) necesitan un límite de Suspense.
  return (
    <Suspense>
      <ClientDetail />
    </Suspense>
  );
}
