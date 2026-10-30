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

La app te pedirá **crear tu cuenta**: hazlo la primera vez, guarda el código de recuperación y ya estás dentro. Lo explica [Cuenta, inicio de sesión y perfil](/ayuda/cuenta).

En la barra lateral, abajo, verás si **gosom** y la **base de datos** están conectados (punto verde).

## Conectar MongoDB Atlas

1. En `.env.local` pon tu cadena de conexión en `MONGODB_URI`. Si la contraseña tiene caracteres especiales (`@ : / ? #`), codifícalos (`@` → `%40`).
2. En Atlas, **Network Access**, añade tu IP.
3. Reinicia la app. En [Ajustes → General](/ajustes?seccion=general) verás "MongoDB · Conectada".

Si antes usabas ficheros locales, en Ajustes tienes **Importar datos locales**.

## Tu primera búsqueda

1. Ve a [Búsquedas](/busquedas) y escribe una búsqueda por línea, como en Google Maps: `dentistas en Valencia`.
2. Pulsa **Buscar**. Tarda unos minutos: puedes cerrar la pestaña y la búsqueda sigue.
3. Al terminar, revisa lo encontrado en [Resultados](/resultados) y guarda lo que te interese en [Leads](/leads).

¿Sin gosom a mano? Elige el proveedor **Demo**: genera datos ficticios para probar la app.

## Empieza el día en el Panel

Arriba del todo del [Panel](/) tienes la bandeja **Hoy**: en una sola lista, lo que pide tu atención.

- **Vencido**: tareas que se pasaron de fecha y facturas emitidas sin cobrar cuyo vencimiento ya pasó.
- **Para hoy**: tareas de hoy y facturas que vencen hoy.
- **Esperando respuesta**: clientes que te escribieron y aún no has contestado, y propuestas o contratos enviados que el cliente todavía no ha aceptado ni firmado (marca *Validez vencida* si ya pasó su fecha).

Filtra por tipo con los botones de arriba, marca las tareas como hechas ahí mismo y pulsa cualquier otra fila para ir al mensaje o al documento. Se actualiza sola cada minuto.

**Quitar algo de la lista**: pulsa la **×** de la fila y elige:

- **Ocultar hasta mañana**: vuelve a salir al día siguiente si sigue pendiente.
- **Quitar de la lista**: se guarda en *ocultos* y no vuelve a salir mientras no cambie nada. Si el cliente te escribe otra vez, cambias la fecha de la tarea o el vencimiento de la factura, vuelve a aparecer.
- **Eliminar de la lista**: desaparece del todo (no sale en *ocultos*), pero vuelve a aparecer si hay algo nuevo, como un mensaje del cliente.

Justo después puedes pulsar **Deshacer**. Abajo de la bandeja verás cuántos tienes **ocultos** (los de *hasta mañana* y los *quitados*); ábrelos para **volver a mostrar** cualquiera. Se guarda en tu cuenta, así que vale en todos tus dispositivos.

## Siguientes pasos

- [Búsquedas y resultados](/ayuda/busquedas): opciones, URLs de Google Maps y exportar.
- [Leads y CRM](/ayuda/leads): etapas, etiquetas, notas y acciones masivas.
- [Clientes y proyectos](/ayuda/clientes): cuando un lead se convierte en cliente.
