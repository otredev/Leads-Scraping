import { Suspense } from "react";
import { Settings } from "@/components/pages/Settings";

export const metadata = { title: "Ajustes" };

export default function Page() {
  // La sección se lee de la dirección (?seccion=crm); useSearchParams necesita Suspense.
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}
