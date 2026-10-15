# Diagral e-ONE

## Presentación

Esta integración conecta su alarma **Diagral e-ONE** con Gladys a través de la nube Diagral, la que
usa la aplicación Diagral e-ONE de su teléfono. Gladys ve:

- el **estado de la alarma**: Desarmada, Retardo de salida, Armada (total), Armada (parcial), Modo
  presencia;
- los **grupos armados**, con los nombres dados en la instalación;
- las **anomalías** de los detectores, teclados, mandos, sirenas y de la central: pilas bajas,
  autoprotección (una caja abierta o arrancada), fallo de enlace radio o de transmisión;
- con **Gladys Plus**, las **alarmas** en tiempo real (intrusión, pánico, incendio, alarma técnica).

Gladys también puede **armar o desarmar la alarma** desde un widget o una escena, pero solo si usted
lo permite: por defecto, Gladys solo muestra el estado.

Desarrollada sin el hardware: se agradecen sus comentarios en
[github.com/guim31/gladys-diagral/issues](https://github.com/guim31/gladys-diagral/issues). Esta
integración no está afiliada a Diagral ni a Hager.

## Requisitos

- Una alarma Diagral e-ONE conectada a Internet por su **caja**: una caja DIAG56AAX (ya no se vende) o
  la caja integrada en una central DIAG99AGX. Si la aplicación Diagral e-ONE controla su alarma a
  distancia, todo está listo.
- La **cuenta de la aplicación Diagral e-ONE**: correo electrónico y contraseña.
- El **número de serie de la caja**: 14 caracteres, en la etiqueta con código QR **dentro** de la caja.
  Hay que abrir su tapa (vea el manual de la caja).
- El **código de acceso** que introduce en la aplicación para ver y controlar la alarma: el código
  maestro o el de un usuario.
- Gladys 5.1 o posterior. Para las alarmas en tiempo real: una suscripción a **Gladys Plus**.

## Configuración

En Gladys, abra **Integraciones**, instale **Diagral e-ONE** («Instalar desde GitHub» si aún no está
en el catálogo) y abra su pantalla de **Configuración**.

### Cuenta Diagral

- **Correo electrónico** y **Contraseña**: los de la aplicación Diagral e-ONE.
- **Número de serie de la caja**: los 14 caracteres de la etiqueta. Mayúsculas, espacios y guiones no
  importan.
- **Código de acceso de la alarma**: Diagral lo pide en cada lectura del estado, no solo para las
  órdenes.

En la primera conexión, la integración crea una **clave de API** en la nube Diagral, como hace la
integración de Home Assistant. Después, cada lectura usa esa clave: la contraseña solo vuelve a
Diagral para crear una clave nueva.

### Armado desde Gladys

- **Desactivado (solo estado)**, el valor por defecto: Gladys muestra el estado de la alarma sin
  cambiarlo nunca.
- **Solo armar**: el widget y las escenas pueden armar la alarma, nunca desarmarla.
- **Armar y desarmar**: quien use sus paneles y escenas también puede desarmar la alarma.

En todos los casos, la alarma **nunca se controla como un interruptor ni por voz**: su estado es una
función de solo lectura. Desarmar desde el widget pide una confirmación.

### Lectura de la alarma

**Lectura de la alarma** fija la frecuencia de lectura del estado y de las anomalías: cada minuto,
cada 2 minutos, cada **5 minutos** (por defecto, como Home Assistant) o cada 10 minutos. Cada lectura
hace dos peticiones a la nube Diagral (estado y anomalías); la configuración de la alarma (nombres,
grupos) solo se vuelve a leer cada 6 horas. Diagral no publica ninguna cuota: sea razonable. Si
Diagral pide ir más despacio, las lecturas se detienen un minuto, luego dos, y así hasta dos horas.

Durante un retardo de salida, la alarma se lee cada 30 segundos hasta que queda armada.

### Idioma

**Idioma de nombres y textos**: el idioma de los nombres de las funciones y de los textos de las
anomalías (francés por defecto). Gladys conserva los nombres elegidos al añadir el dispositivo.

### Webhook de Gladys Plus (tiempo real)

La nube Diagral puede avisar de un evento mediante un **webhook**: alarma, armado o desarmado, nueva
anomalía. Como Gladys está en su casa, ese webhook pasa por **Gladys Plus**.

> **Atención: Diagral solo guarda un webhook por caja.** Si Home Assistant, Jeedom u otro software ya
> recibe los eventos de su alarma, marcar la opción de abajo lo sustituye: ese otro software dejará de
> recibir nada de Diagral.

Por eso la opción **Alarmas en tiempo real (sustituye otro webhook)** está **desactivada por
defecto**. Mientras lo esté, Gladys nunca lee, modifica ni elimina el webhook de su caja. Para
activarla:

1. En Gladys Plus, cree una clave Open API (Ajustes → Open API).
2. Péguela en el bloque «Webhooks de Gladys Plus» de la pantalla de Configuración de la integración:
   indica «Eventos Diagral (alarmas, armados, anomalías)».
3. Marque **Alarmas en tiempo real (sustituye otro webhook)**: la integración registra la dirección en
   Diagral.

Si desmarca la opción o retira la clave, la integración elimina su webhook en Diagral, pero solo si
sigue siendo el suyo. El webhook de otro software nunca se elimina.

**Sin la opción**, lo que queda y lo que se pierde: la API de Diagral no tiene historial de eventos.
El estado, los grupos armados y las anomalías se siguen leyendo al ritmo elegido (5 minutos por
defecto), y los disparadores de armado y de anomalía funcionan, con ese retraso. Pero una **alarma**
nunca se ve: «Alarma en curso» queda sin valor y el disparador «Alarma Diagral disparada» nunca se
produce. «Cambiado por» queda vacío.

### Acciones

- **Probar la conexión**: lee el estado y las anomalías de la alarma y los resume. No se arma ni se
  desarma nada.
- **Renovar la clave de API**: crea una nueva clave de API en la nube Diagral y elimina la anterior.
  Útil si cree que se ha filtrado, o si Diagral la rechaza.

## El dispositivo

Tras la conexión, la pestaña **Descubrir** propone un dispositivo **Alarma Diagral** (seguido del
nombre de su alarma). Sus funciones, todas de solo lectura:

- **Estado de la alarma**: Desarmada, Retardo de salida, Armada (total), Armada (parcial), Modo
  presencia. El armado total arma todos los grupos; un armado con parte de los grupos es parcial.
- **Alarma en curso**: 1 en cuanto Diagral señala una alarma, hasta que la alarma se desarma. Solo con
  el webhook de Gladys Plus: sin él, esta función no tiene valor, pues nada permite saberlo.
- **Grupos armados**: los nombres de los grupos armados, o «Ninguno».
- **Anomalías**: las anomalías en curso, por ejemplo «(2) Porte garage: pilas bajas, Central:
  autoprotección».
- **Número de anomalías**: la misma cuenta, para las escenas.
- **Pilas bajas**: 1 si un dispositivo de la alarma señala pilas bajas o un fallo de alimentación.
- **Autoprotección**: 1 si un dispositivo señala una autoprotección (caja abierta o arrancada).
- **Fallo de enlace**: 1 si un dispositivo señala un fallo de enlace radio o de transmisión (GSM,
  línea telefónica, Internet).
- **Nube Diagral**: 0 cuando la nube Diagral deja de responder.

## El widget

El widget **Alarma Diagral** muestra el estado de la alarma («ALARMA EN CURSO» en rojo durante una
alarma), los grupos armados y las anomalías. Según **Armado desde Gladys**, ofrece hasta cuatro
botones: **Armar total**, **Parcial 1** (o **Parcial 2** si su alarma no tiene parcial 1),
**Presencia** y **Desarmar**, que pide una confirmación. El modo actual se marca con una casilla.

## Disparadores de escena

- **Alarma Diagral disparada**: la alarma se disparó. Filtro: el tipo de alarma (Intrusión, Pánico,
  Incendio, Técnica (agua, temperatura…), Otra). Variables: el tipo de alarma, el detector, el grupo y
  el código Diagral. Requiere el webhook de Gladys Plus. Una alarma recibida con más de 15 minutos de
  retraso no dispara nada.
- **Diagral armada o desarmada**: la alarma cambió de modo, desde un teclado, un mando, la aplicación
  o Gladys. Filtro: el nuevo modo (Desarmada, Armada (total), Armada (parcial), Modo presencia).
  Variables: el nuevo modo y «Cambiado por» (el nombre del usuario cuando Diagral lo indica por el
  webhook, «Gladys» para una orden de Gladys). El fin de un retardo de salida es el armado.
- **Anomalía Diagral señalada**: apareció una nueva anomalía. Filtro: el tipo de anomalía (Pilas o
  alimentación, Autoprotección, Enlace radio o transmisión, Otra). Variables: el tipo de anomalía, el
  dispositivo y la anomalía en palabras.

Las anomalías ya presentes al iniciarse la integración no disparan nada.

## Acción de escena

**Armar o desarmar Diagral**, en la medida en que lo permita «Armado desde Gladys»:

- **Orden**: Desarmar, Armar total, Presencia, Parcial 1, Parcial 2 o Grupos elegidos;
- **Grupos**: solo para «Grupos elegidos», los números de los grupos separados por comas, por ejemplo
  `1,3`.

Resultado: «Estado tras la orden», casi siempre un retardo de salida justo después de armar.

## Ejemplos de escenas

- **Intrusión**: disparador «Alarma Diagral disparada», tipo Intrusión → encender todas las luces,
  enviar un mensaje «Intrusión detectada por {{triggerEvent.data.device}}» y la imagen de la cámara de
  la entrada.
- **Salir de casa**: cuando el último miembro de la familia sale de casa → acción «Armar o desarmar
  Diagral», orden Armar total (hace falta al menos «Solo armar»).
- **Pilas que cambiar**: disparador «Anomalía Diagral señalada», tipo Pilas o alimentación → mensaje
  «Pilas que cambiar: {{triggerEvent.data.fault}}».
- **Noche**: disparador «Diagral armada o desarmada», modo Modo presencia → bajar la calefacción y
  apagar el televisor.

## Solución de problemas

- **«Diagral rechaza el correo electrónico o la contraseña»**: revíselos en la aplicación Diagral
  e-ONE. La integración no vuelve a intentarlo hasta el próximo cambio de la configuración, para no
  bloquear su cuenta.
- **«Diagral rechaza el número de serie de la caja o el código de acceso»**: revise los 14 caracteres
  de la etiqueta y el código. Un escaneo en la pestaña Descubrir vuelve a intentarlo.
- **«La nube Diagral no responde»**: la integración sigue intentándolo y lo escribe una sola vez en
  los registros. ¿Funciona la aplicación Diagral e-ONE?
- **Nada en tiempo real**: ¿Está marcada la opción «Alarmas en tiempo real»? Revise también la clave Open API en el bloque «Webhooks de Gladys Plus». Otra
  herramienta puede haber recuperado el webhook de su caja: Diagral solo guarda uno.
- **Más detalles**: defina la variable `LOG_LEVEL=debug`. Los registros nunca contienen la contraseña,
  el código, la clave de API ni la dirección del webhook.

## Límites

- Desarrollada **sin el hardware ni una cuenta Diagral**: la conexión con la nube real no se pudo
  probar. Las respuestas de la API vienen de la biblioteca pydiagral y de la integración de Home
  Assistant de Marc Guyard. Sus comentarios son valiosos.
- La nube Diagral no tiene historial de eventos: las alarmas solo llegan por el webhook (Gladys Plus),
  los armados y las anomalías también por las lecturas.
- Quién armó o desarmó («Cambiado por») solo se conoce con el webhook.
- Un webhook por caja en Diagral: Gladys y otra herramienta no pueden usarlo a la vez.
- Los detectores no son dispositivos separados: la API no da su estado (puerta abierta, movimiento),
  solo sus anomalías.
- Una alarma de seguridad sigue siendo su responsabilidad: no confíe solo en Gladys para enterarse de
  una intrusión.

## Datos y seguridad

- La contraseña y el código de acceso se quedan en la configuración de Gladys. La clave de API y su
  secreto están en `/data/diagral-state.json`, legible solo por el contenedor. La dirección del webhook
  no se guarda (solo su huella), porque contiene su clave Open API.
- La integración solo habla con la nube Diagral (`appv3.tt-monitor.com`) y con Gladys.
- Un evento del webhook solo se acepta si viene del transmisor de su caja; los armados y las anomalías
  siempre se vuelven a leer en la API antes de mostrarse.
