# Acceso desde pantalla de inicio de iPhone

## Diagnóstico confirmado

Jorge confirmó que el acceso directo termina en **This site is private**. Esa
pantalla pertenece a la protección de Netlify y aparece antes de ejecutar Deer.
La sesión de Netlify y la sesión propia de Deer/Supabase son independientes.
Safari y la aplicación de pantalla de inicio mantienen almacenamiento separado.
Deer no puede prolongar, renovar ni sustituir las cookies de Netlify.

## Preparación en código

- Manifest con identidad estable, alcance `/` e inicio `/?source=homescreen`.
- Modo standalone, nombre Deer, metadatos Apple y colores de tema.
- Íconos de instalación de 192/512 px derivados del isotipo original, sin red.
- Espera visible durante la recuperación inicial de sesión, evitando mostrar
  prematuramente el formulario de acceso.
- Relectura de sesión al recibir pageshow, volver a primer plano y reconectarse.
  Se conserva el control de visibilidad del SDK, que gestiona la renovación.
- Cada solicitud obtiene el token actual; respuestas HTML de la barrera externa
  se distinguen de un 401 JSON de Deer, sin redirecciones automáticas ni signOut
  provocado por Netlify. Los borradores existentes conservan su recuperación local.
- No se añade service worker ni caché de respuestas privadas.

Esto prepara la instalación y mejora el regreso a Deer, pero **no quita el
aviso externo mientras la producción siga protegida por Netlify**.

## Cambio de configuración propuesto, pendiente de autorización

Cambiar la visibilidad del proyecto de Netlify a Public para que la URL de
producción abra directamente Deer. La página de acceso y los recursos de interfaz
serán accesibles sin cuenta de Netlify. Los datos seguirán requiriendo la cuenta
habilitada de Deer: API autenticada, perfil habilitado, RLS y Storage privado.
El repositorio GitHub permanece privado. Este cambio no se ha ejecutado.

Revisión de solo lectura realizada antes de la propuesta:

- profiles, projects, tasks, documents, document_assets y document_links:
  peticiones sin sesión a Supabase respondieron 401 / 42501, cero filas expuestas.
- Auth informó `disable_signup=true`.
- Las pruebas SQL existentes verifican cuenta deshabilitada, otro propietario,
  acceso anónimo y acceso a archivos.

## Activación y aceptación

1. Publicar el commit de esta preparación, sin migraciones de base de datos.
2. Con autorización explícita, cambiar la visibilidad de Netlify. Verificar desde
   una ventana privada que aparezca el formulario de Deer y que ninguna API
   entregue datos sin sesión. Mantener los archivos de Storage privados.
3. En Safari del iPhone abrir https://deer-anx0.netlify.app/ y entrar con la cuenta
   de Deer. Confirmar guardado del texto antes de retirar un acceso directo antiguo;
   sus borradores locales pertenecen a ese contenedor del navegador.
4. Compartir → Añadir a pantalla de inicio → Deer. La webapp puede pedir su propio
   inicio de sesión una vez porque no comparte el almacenamiento de Safari.
5. Probar al abrir, volver de segundo plano, bloquear/desbloquear y dejar varias
   horas sin uso. Confirmar que no reaparezca la puerta de Netlify y que los
   documentos guardados y borradores locales se recuperen donde corresponde.

La sesión de aplicación sigue sujeta a revocación, cierre explícito y borrado de
datos del navegador; no se promete permanencia ilimitada ni funcionamiento offline.

## Pruebas

54 pruebas de datos y respuestas HTTP. Recorridos de navegador comprueban manifest,
dimensiones de íconos, sesión inicial/restaurada y aviso Netlify sin abandonar Deer.
Los recorridos documentales y kanban existentes se mantienen. La prueba física
de reanudación de iPhone y la aceptación de configuración quedan pendientes.

Fuentes: documentación oficial de [Netlify](https://docs.netlify.com/manage/security/secure-access-to-sites/password-protection/),
[WebKit](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/) y
[Supabase](https://supabase.com/docs/reference/javascript/auth-startautorefresh).
