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
- La conversación **se actualiza sola**: si le respondes con su portal abierto, tu mensaje le aparece en unos segundos, sin recargar.
- En todas las páginas del portal hay un botón flotante **Mensajes** abajo a la derecha, con un punto cuando le has respondido.
- La conversación ocupa la pantalla y el cuadro para escribir queda siempre abajo. En el ordenador, **Enter** envía y **Mayús + Enter** hace un salto de línea.

## Notificaciones para el cliente

En la página principal de su portal, encima de Mensajes, el cliente ve la tarjeta **Notificaciones** con **Activar** y **Ahora no**. Desaparece en cuanto las activa, las bloquea en el navegador o pulsa *Ahora no*. Desde **Mensajes** (debajo de la conversación) puede activarlas o desactivarlas cuando quiera. Con ellas activadas le llega una **notificación push** a ese dispositivo cuando:

- le **respondes** en Mensajes, o
- le **envías** una propuesta o un contrato, o **emites** una factura visible en su portal. Al pulsar la notificación se abre directamente el documento.

Los envía tu app con las mismas claves que tus propios avisos, así que **tiene que estar encendida** cuando respondes (lo estará, porque respondes desde ella). Es gratis y no hace falta ningún servicio más.

- En la ficha del cliente, la tarjeta del portal muestra en cuántos **dispositivos** los tiene activados.
- En **iPhone y iPad**, primero tiene que añadir el portal a la pantalla de inicio (Compartir → *Añadir a pantalla de inicio*) y abrirlo desde allí; el portal se lo explica.
- Si **renuevas su enlace**, las notificaciones se desactivan y tendrá que activarlas otra vez.
- Si prefieres no ofrecerlos, desmarca **Ofrecer notificaciones push en el portal** en [Ajustes → Portal del cliente](/ajustes?seccion=portal#avisos-clientes).

## En la app

- **Mensajes** (menú lateral) muestra las conversaciones con el número de **sin leer**, que también aparece en el menú.
- Se cargan los **últimos 50 mensajes**; los anteriores aparecen solos al subir hasta arriba (igual en el portal del cliente).
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
