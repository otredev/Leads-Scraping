import { Suspense } from "react";
import { DocumentEditor } from "@/components/pages/DocumentEditor";

export default function Page() {
  // useParams necesita un límite de Suspense.
  return (
    <Suspense>
      <DocumentEditor />
    </Suspense>
  );
}
