import type { Metadata, Viewport } from "next";
// Fuente autoalojada (sin peticiones a Google Fonts, funciona sin conexión).
import "@fontsource-variable/schibsted-grotesk";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { DataProvider } from "@/components/data/DataProvider";
import { themeInitScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Leads Scraping",
  description: "Extrae, filtra y exporta leads de negocios locales.",
  applicationName: "Leads Scraping",
  appleWebApp: { capable: true, title: "Leads", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#141414" },
  ],
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
