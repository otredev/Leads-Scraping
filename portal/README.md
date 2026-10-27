# Portal del cliente (Cloudflare Workers + D1)

Web pública donde cada cliente ve, con su enlace privado, el avance de sus proyectos: progreso, cronograma, tareas pendientes y (si lo activas) presupuesto y pagos. Tu app (local) le envía solo lo marcado como visible; el portal no tiene acceso a tu CRM.

Todo cabe en el plan gratuito de Cloudflare.

## Desplegar (una vez)

Necesitas una cuenta gratuita de Cloudflare y Node.js.

```bash
cd portal
npm install
npx wrangler login                       # abre el navegador para autorizar
npx wrangler d1 create leads-portal      # copia el "database_id" que imprime
```

1. Pega ese `database_id` en `wrangler.jsonc` (sustituye `PEGA-AQUI-EL-ID-DE-TU-BASE-DE-DATOS`).
2. Crea las tablas y el secreto compartido con tu app (invéntate uno largo, mínimo 16 caracteres):

   ```bash
   npm run db:migrate:remote
   npx wrangler secret put PORTAL_SECRET
   ```

3. Publica:

   ```bash
   npm run deploy
   ```

   Te devuelve la dirección, algo como `https://leads-portal.tu-subdominio.workers.dev`.

4. En el `.env.local` de tu app (la carpeta de arriba) añade:

   ```
   PORTAL_URL=https://leads-portal.tu-subdominio.workers.dev
   PORTAL_SECRET=el-mismo-secreto-del-paso-2
   ```

   Reinicia la app. En **Ajustes → Portal del cliente** debe salir "Conectado".

Para usar tu propio dominio (p. ej. `clientes.tudominio.com`), añádelo en el panel de Cloudflare: Workers → leads-portal → Settings → Domains & Routes, y cambia `PORTAL_URL`.

## Actualizar el portal

Cuando cambie el código del portal: `cd portal && npm run deploy`. Si hay migraciones nuevas en `migrations/`, antes `npm run db:migrate:remote`.

## Probar en local

```bash
cd portal
cp .dev.vars.example .dev.vars           # pon un PORTAL_SECRET de pruebas
npm run db:migrate:local
npm run dev                              # http://localhost:8787
```

Y en el `.env.local` de la app: `PORTAL_URL=http://localhost:8787` con el mismo secreto.

## Seguridad

- Cada cliente tiene un enlace con un token aleatorio. El portal solo guarda su hash, no el token.
- Puedes renovar el enlace (el anterior deja de funcionar) o desactivar el portal desde la ficha del cliente.
- La API de publicación exige `PORTAL_SECRET`. Las páginas no se indexan en buscadores y no envían el enlace a otras webs (sin Referer).
- No usa JavaScript ni cookies.
