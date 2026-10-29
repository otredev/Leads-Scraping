import { Suspense } from "react";
import { Documents } from "@/components/pages/Documents";

export const metadata = { title: "Documentos" };

export default function Page() {
  // La pestaña se lee de la dirección (useSearchParams necesita Suspense).
  return (
    <Suspense>
      <Documents />
    </Suspense>
  );
}
