---
title: Primeros pasos
description: Instala la app, conecta la base de datos y lanza tu primera búsqueda.
order: 1
---

# Primeros pasos

Leads Scraping funciona en tu ordenador. Extrae negocios de Google Maps, te ayuda a organizarlos como un CRM y a convertirlos en clientes. Todo con herramientas gratuitas.

## Qué necesitas

| Herramienta | Para qué |
|---|---|
| Node.js 20 o posterior | Ejecutar la app |
| Docker Desktop | Ejecutar **gosom**, el programa que recorre Google Maps |
| MongoDB Atlas (opcional) | Guardar los datos en la nube. Sin él, se guardan en la carpeta `data/` |

> Sin Docker también puedes usar el ejecutable de gosom para Windows. Lo explica el README del proyecto.

## Arrancar la app

```bash
npm install
cp .env.example .env.local      # en Windows: copy .env.example .env.local
docker compose up -d            # arranca gosom
npm run dev                     # abre http://localhost:3000
```

En la barra lateral, abajo, verás si **gosom** y la **base de datos** están conectados (punto verde).

## Conectar MongoDB Atlas

1. En `.env.local` pon tu cadena de conexión en `MONGODB_URI`. Si la contraseña tiene caracteres especiales (`@ : / ? #`), codifícalos (`@` → `%40`).
2. En Atlas, **Network Access**, añade tu IP.
3. Reinicia la app. En [Ajustes](/ajustes) verás "MongoDB · Conectada".

Si antes usabas ficheros locales, en Ajustes tienes **Importar datos locales**.

## Tu primera búsqueda

1. Ve a [Búsquedas](/busquedas) y escribe una búsqueda por línea, como en Google Maps: `dentistas en Valencia`.
2. Pulsa **Buscar**. Tarda unos minutos: puedes cerrar la pestaña y la búsqueda sigue.
3. Al terminar, revisa lo encontrado en [Resultados](/resultados) y guarda lo que te interese en [Leads](/leads).

¿Sin gosom a mano? Elige el proveedor **Demo**: genera datos ficticios para probar la app.

## Siguientes pasos

- [Búsquedas y resultados](/ayuda/busquedas): opciones, URLs de Google Maps y exportar.
- [Leads y CRM](/ayuda/leads): etapas, etiquetas, notas y acciones masivas.
- [Clientes y proyectos](/ayuda/clientes): cuando un lead se convierte en cliente.
