import type { Metadata } from "next";
// Fuente autoalojada (sin peticiones a Google Fonts, funciona sin conexión).
import "@fontsource-variable/schibsted-grotesk";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { DataProvider } from "@/components/data/DataProvider";
import { themeInitScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Leads Scraping",
  description: "Extrae, filtra y exporta leads de negocios locales.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning>
      <head>
        {/* Aplica el tema guardado antes de pintar (sin destello). */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <DataProvider>
          <AppShell>{children}</AppShell>
        </DataProvider>
      </body>
    </html>
  );
}
