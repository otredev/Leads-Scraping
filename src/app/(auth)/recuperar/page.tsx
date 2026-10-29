import { Suspense } from "react";
import type { Metadata } from "next";
import { RecoverForm } from "@/components/auth/RecoverForm";

export const metadata: Metadata = { title: "Recuperar la contraseña" };

export default function RecoverPage() {
  return (
    <Suspense>
      <RecoverForm />
    </Suspense>
  );
}
