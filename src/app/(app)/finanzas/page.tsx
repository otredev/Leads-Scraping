import { Suspense } from "react";
import { Finance } from "@/components/pages/Finance";

export const metadata = { title: "Finanzas" };

export default function Page() {
  // La pestaña se lee de la dirección (useSearchParams necesita Suspense).
  return (
    <Suspense>
      <Finance />
    </Suspense>
  );
}
