import { Suspense } from "react";
import { Messages } from "@/components/pages/Messages";

export const metadata = { title: "Mensajes" };

export default function Page() {
  // useSearchParams (?cliente=) necesita un límite de Suspense.
  return (
    <Suspense>
      <Messages />
    </Suspense>
  );
}
