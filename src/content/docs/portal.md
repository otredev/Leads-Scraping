---
title: Portal del cliente
description: Un enlace privado donde cada cliente ve el avance de sus proyectos.
order: 8
---

# Portal del cliente

Cada cliente puede tener un **enlace privado** a una web donde ve:

- Sus proyectos con el avance, el estado y la próxima entrega.
- El **cronograma** (hitos hechos, próximos y retrasados).
- Las **tareas** pendientes y completadas.
- El **presupuesto y los pagos**, solo si lo activas en el proyecto.
- Tus datos de contacto, con botón de WhatsApp y email.
- Las páginas legales: aviso legal, privacidad y cookies.

Funciona en el móvil y cambia solo a modo oscuro.

## Puesta en marcha (una vez)

El portal es una app aparte que se publica gratis en Cloudflare (carpeta `portal/`). Los pasos detallados están en `portal/README.md`. En resumen:

1. `cd portal`, `npm install`, `npx wrangler login` y `npx wrangler d1 create leads-portal`. Pega el id que te da en `wrangler.jsonc`.
2. `npm run db:migrate:remote`, `npx wrangler secret put PORTAL_SECRET` (invéntate un secreto de 16 caracteres o más) y `npm run deploy`.
3. En el `.env.local` de la app añade `PORTAL_URL` (la dirección del despliegue) y `PORTAL_SECRET` (el mismo secreto). Reinicia la app.
4. En [Ajustes → Portal del cliente](/ajustes) rellena los datos de tu negocio y los **datos legales**, y comprueba que pone "Conectado".

## Uso

En la ficha del cliente, tarjeta **Portal del cliente**:

- **Activar portal** y enviar el enlace por WhatsApp o email, o copiarlo.
- Ver cuándo lo **publicaste** y cuándo lo **abrió** el cliente por última vez.
- **Renovar enlace**: crea uno nuevo y el anterior deja de funcionar.
- **Desactivar portal**: el enlace deja de funcionar.

Se **actualiza solo**: cada cambio en sus proyectos, hitos o tareas se publica a los 2 segundos, mientras la app esté encendida. Si algo no se actualiza, pulsa **Publicar ahora**.

## Privacidad

Al portal solo se envía lo marcado como visible. Tus notas, horas, hitos internos y el resto del CRM no salen de tu equipo. El portal no guarda el enlace del cliente, solo una huella cifrada; no lo indexan los buscadores, no usa cookies propias ni JavaScript.
