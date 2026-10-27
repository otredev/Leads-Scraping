"use client";

import dynamic from "next/dynamic";
import type { SavedLead } from "@/core/lead";
import type { CrmSettings } from "@/core/crm";
import { Skeleton } from "../ui";
import { ColorDot } from "./parts";

// Leaflet usa `window`: se carga solo en el navegador.
const MapInner = dynamic(() => import("./MapInner"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

/** Vista de mapa de los leads filtrados (Leaflet + OpenStreetMap, gratis). */
export function MapView({ leads, settings, onOpen }: { leads: SavedLead[]; settings: CrmSettings; onOpen(lead: SavedLead): void }) {
  const withCoords = leads.filter((l) => typeof l.latitude === "number" && typeof l.longitude === "number").length;
  const missing = leads.length - withCoords;
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2.5 text-xs text-muted sm:px-5">
        {settings.stages.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1.5">
            <ColorDot color={s.color} /> {s.name}
          </span>
        ))}
        <span className="ml-auto">
          {withCoords} en el mapa
          {missing > 0 && ` · ${missing} sin ubicación (p. ej. importados sin coordenadas)`}
        </span>
      </div>
      <div className="h-[65vh] min-h-[420px]">
        <MapInner leads={leads} settings={settings} onOpen={onOpen} />
      </div>
      <p className="px-4 py-2 text-xs text-muted sm:px-5">Si un lead tiene color propio, el punto usa ese color en lugar del de su etapa.</p>
    </div>
  );
}
