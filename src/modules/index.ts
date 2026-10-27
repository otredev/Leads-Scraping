/**
 * ─── REGISTRO DE MÓDULOS ────────────────────────────────────────────────
 *
 * Único sitio donde se conectan los módulos con la app. Para añadir uno:
 *   1. Crea su carpeta/fichero en src/modules/<tipo>/...
 *   2. Impórtalo aquí y añádelo a la lista correspondiente.
 * No hay que tocar nada más: la API, el formulario y la tabla se adaptan solos.
 */

import type { SourceDefinition, LeadProvider } from "@/core/provider";
import type { Exporter } from "@/core/exporter";
import type { StorageModule } from "@/core/storage";
import type { NotifierModule } from "@/core/notifier";
import type { Enricher } from "@/core/enricher";

// Fuentes
import googleMaps from "./sources/google-maps";

// Proveedores
import gosom from "./providers/gosom";
import demo from "./providers/demo";

// Exportadores
import csv from "./exporters/csv";
import json from "./exporters/json";

// Almacenamiento
import jsonFile from "./storage/json-file";
import mongodb from "./storage/mongodb";

// Notificaciones
import webPush from "./notifiers/web-push";

// Enriquecedores
import websiteContacts from "./enrichers/website-contacts";

export const sources: SourceDefinition[] = [googleMaps];

/** El primero es el que aparece seleccionado por defecto. */
export const providers: LeadProvider[] = [gosom, demo];

export const exporters: Exporter[] = [csv, json];

/**
 * Se elige con la variable STORAGE. Si no se indica, se usa MongoDB cuando
 * existe MONGODB_URI y, si no, ficheros JSON locales.
 */
export const storages: StorageModule[] = [jsonFile, mongodb];

/** Canales de notificación: todos los registrados reciben los avisos de tareas. */
export const notifiers: NotifierModule[] = [webPush];

/** Enriquecedores: completan datos de leads guardados (redes, emails…) desde otras fuentes. */
export const enrichers: Enricher[] = [websiteContacts];
