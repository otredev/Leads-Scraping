---
title: Mensajes con clientes
description: Tus clientes te escriben desde su portal y tú respondes desde la app, con notas internas.
order: 8.5
---

# Mensajes con clientes

Cada cliente con el [portal](/ayuda/portal) activo puede escribirte desde su enlace: dudas, cambios, contenidos que faltan… Tú lo lees y respondes en [Mensajes](/mensajes).

## En el portal del cliente

- En su página principal ve los **últimos mensajes** y un acceso a **Mensajes**.
- Escribe y, si quiere, elige **sobre qué proyecto** es. Tus respuestas le aparecen en la misma conversación.
- No necesita registrarse: le basta su enlace privado.

## En la app

- **Mensajes** (menú lateral) muestra las conversaciones con el número de **sin leer**, que también aparece en el menú.
- Al abrir una conversación sus mensajes quedan leídos. Escribe y pulsa **Enviar** (o Ctrl + Enter): le llega al portal al momento.
- Bajo tu último mensaje verás **Enviado** o **Visto** (cuando el cliente abrió sus mensajes después).
- **Nota interna**: marca la casilla para guardar una nota que **solo ves tú** (aparece en amarillo, con un candado). Sirve para apuntar acuerdos, precios o recordatorios en la propia conversación. Las notas se pueden borrar; los mensajes enviados no, porque el cliente ya los tiene.
- En la ficha de cada cliente hay una tarjeta **Mensajes** con lo último y un acceso a la conversación.

La app busca mensajes nuevos **cada minuto** (y cada 20 segundos mientras tienes Mensajes abierto) y te avisa con una **notificación push** si las tienes activadas. Tiene que estar encendida para recibirlos al momento; si no, los recoge al arrancar.

## Aceptación de las condiciones

La primera vez que el cliente abre su portal, antes de ver nada, tiene que **aceptar el aviso legal y la política de privacidad** marcando una casilla. Se guardan la fecha y hora, la IP y el navegador y la versión de los textos aceptados, a nombre del contacto del cliente (el enlace es personal).

- En Mensajes y en la ficha del cliente verás **Condiciones aceptadas** (pasa el ratón para ver quién, cuándo y desde qué IP) o **Aún no ha aceptado las condiciones**.
- Si cambias tus **datos legales** (titular, NIF, domicilio) o tu nombre comercial o email, los textos cambian y se le **vuelve a pedir** la aceptación la próxima vez que entre.
- Las páginas legales se pueden leer antes de aceptar.

## Ten en cuenta

- Los mensajes se guardan en el portal (Cloudflare) y una copia en la app, incluida en la copia de seguridad. Si **desactivas el portal** de un cliente, se borran del portal, pero conservas la copia en la app.
- Para evitar abusos, un cliente puede enviar hasta 30 mensajes por hora.
- No se pueden adjuntar archivos: para enviar ficheros, usad email o un enlace (WeTransfer, Drive…).
- Claude puede leer las conversaciones y añadir notas internas (`list_messages`, `add_note`), pero no responde a los clientes por ti.
