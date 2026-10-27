"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import type { SavedLead } from "@/core/lead";
import type { CrmSettings } from "@/core/crm";

function cssVar(name: string) {
  if (typeof window === "undefined") return "#888";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
}

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [map, bounds]);
  return null;
}

/** Mapa con un punto por lead, del color de su etapa. Se carga solo en el navegador. */
export default function MapInner({
  leads,
  settings,
  onOpen,
}: {
  leads: SavedLead[];
  settings: CrmSettings;
  onOpen(lead: SavedLead): void;
}) {
  const points = leads.filter((l) => typeof l.latitude === "number" && typeof l.longitude === "number");
  const bounds = useMemo<LatLngBoundsExpression>(
    () => (points.length ? points.map((l) => [l.latitude!, l.longitude!] as [number, number]) : [[40.4, -3.7], [40.42, -3.68]]),
    [points],
  );
  const stageOf = (id: string) => settings.stages.find((s) => s.id === id);
  const surface = cssVar("--surface");

  return (
    <MapContainer bounds={bounds} scrollWheelZoom className="h-full w-full" style={{ background: "var(--surface-2)" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds bounds={bounds} />
      {points.map((l) => {
        const stage = stageOf(l.stage);
        const color = cssVar(`--label-${l.color ?? stage?.color ?? "gray"}`);
        return (
          <CircleMarker
            key={l.id}
            center={[l.latitude!, l.longitude!]}
            radius={8}
            pathOptions={{ color: surface, weight: 2, fillColor: color, fillOpacity: 1 }}
          >
            <Popup>
              <div className="flex min-w-48 flex-col gap-1 font-sans">
                <strong className="text-sm">{l.name}</strong>
                <span className="text-xs text-muted">{[stage?.name, l.category].filter(Boolean).join(" · ")}</span>
                {l.phone && <span className="text-xs">{l.phone}</span>}
                {l.address && <span className="text-xs text-muted">{l.address}</span>}
                <button className="btn btn-primary btn-sm mt-1" onClick={() => onOpen(l)}>
                  Abrir ficha
                </button>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
