# E3 y E3 ampliada

Rama de trabajo: `feature/e3-ampliada`. Las funciones están implementadas para revisión local. La migración y la conexión OAuth/MCP requieren activación posterior; no se ha actualizado `main` ni solicitado un despliegue de producción.

## Funciones

| Área | Comportamiento |
|---|---|
| Tareas | Subtareas con casillas, persona de quien se depende, seguimiento, importancia y urgencia explícitas. El progreso cuenta cada tarea una vez, con avance parcial por subtareas. |
| Planificación | Tabla, Kanban, Eisenhower, Gantt editable y calendarios de 7/30 días. Calendarios incluyen reuniones. Los colores identifican proyectos. |
| Guardado | Formularios, documentos, preferencias, fechas Gantt y clasificación Eisenhower requieren Guardar. Cada movimiento intencional del Kanban guarda el estado inmediatamente. Los borradores documentales locales siguen siendo recuperables. |
| Inicio | Indicadores, vencidos, seguimientos, reuniones, proyectos y contexto para resúmenes Hoy/Esta semana. Las tareas completadas se contabilizan por su fecha real de cierre; no se inventan fechas de registros antiguos. |
| Captura y búsqueda | Captura rápida de tareas/notas, Bandeja sin proyecto y búsqueda global en títulos/contenido. Carga paginada completa para no truncar el contexto a 50 registros. |
| Proyectos | Clic abre detalle con tareas, documentos, reuniones y progreso. Menú para editar, preparar archivo/cierre y duplicar ficha. Botón Atrás conserva proyecto, filtros y vista. |
| Documentos | Jerarquía de páginas, ruta, enlaces en negrita con icono y enlace navegable. Creación de subpágina hereda proyecto; después cada página conserva su asociación propia. Se impiden ciclos y cruces de propietario. Se mantienen editor, adjuntos, DOCX y PDF. |
| Presentación | Iconos y portadas en tareas/proyectos/documentos; color de proyecto, selectores visuales, navegación inferior móvil, favicon claro en fondo oscuro. Tema del editor independiente de la interfaz. |
| Configuración | Apariencia con Guardar, descarga de respaldo, salida, permisos y revocación MCP. |
| Reuniones | Registro manual con inicio/fin en Cancún, participantes, lugar, acuerdos, proyecto, acta/documento y tareas asociadas. Edición con control de versión. |
| MCP | Servidor autenticado para listar, leer, buscar, obtener contexto y crear/editar con permiso explícito. Sin SQL arbitrario, borrados ni cambios de permisos desde MCP. |

## IA y suscripción de ChatGPT

Deer prepara el contexto y permite copiarlo para usarlo en ChatGPT. No se ha activado una API de IA de pago ni se usa la suscripción como clave API. Tras configurar OAuth y conectar el servidor MCP, un cliente compatible puede consultar el contexto directamente. La disponibilidad de añadir un servidor personalizado se comprueba en la cuenta de ChatGPT del usuario. Los resúmenes se redactan allí, no automáticamente dentro de Deer.

## Actualización agrupada preparada

1. Descargar un respaldo desde la versión actual y conservarlo fuera del repositorio.
2. Ejecutar **el contenido** de `supabase/migrations/202611200001_deer_e3.sql` en Supabase SQL Editor. No pegar la ruta Windows. No ejecutar los archivos de `supabase/tests/` en producción.
3. La migración es aditiva, transaccional y conserva datos existentes. Amplía metadatos, reuniones, jerarquía, preferencias, control MCP, lotes atómicos y respaldo v5. No habilita clientes MCP por defecto.
4. Publicar el conjunto desde la rama revisada en una sola actualización de producción, después de terminar las pruebas y autorizar la publicación. Los permisos OAuth se activan por separado.
5. Comprobar desde ordenador e iPhone: guardar/reabrir tareas y documentos, mover Kanban, clasificar Eisenhower, guardar fechas, reuniones, búsqueda, regresar al proyecto y preferencias independientes.
6. Descargar el nuevo ZIP v5 y ejecutar `node scripts/verify-backup.mjs RUTA_AL_ZIP`. Se verifican los datos y archivos en una base embebida aislada; nunca se restaura sobre producción.

La visibilidad pública de producción en Netlify permite llegar a la pantalla de Deer. Auth/RLS siguen controlando los datos. Mantener las vistas previas privadas ayuda a evitar exposición de versiones de revisión. No cambiar esos ajustes como parte de este código.

## Activación OAuth/MCP posterior

El servidor usa OAuth nativo de Supabase. No almacena contraseñas OAuth ni necesita `service_role`.

1. Confirmar el dominio canónico: `DEER_PUBLIC_URL` en el servidor, por defecto `https://deer-anx0.netlify.app`. Debe coincidir con el recurso configurado en Deer: `https://deer-anx0.netlify.app/api/mcp`. Un cambio de dominio requiere actualizar ambos.
2. En Supabase Auth, habilitar OAuth Server y configurar la ruta de consentimiento `/oauth/consent` con el sitio de Deer como URL base. Mantener el registro dinámico desactivado; registrar el cliente compatible con el URI de retorno que ese cliente proporcione.
3. Obtener el ID del cliente registrado. En Deer → Configuración → Conexión con ChatGPT / MCP, guardar ese ID y activar lectura. Activar escritura solo si se desean crear/editar registros desde el cliente.
4. En Supabase Auth Hooks, activar **Custom Access Token Hook** apuntando a `public.deer_mcp_access_token_hook`. La migración prepara la función y sus permisos. Este paso vincula los tokens del cliente autorizado a la audiencia del recurso MCP; sin el hook, Deer rechazará el token.
5. Añadir el servidor HTTPS `/api/mcp` en el cliente compatible y completar la autorización en la pantalla de Deer. Usar la información OAuth del cliente registrado según la interfaz del cliente. No pegar secretos en el chat ni subirlos al repositorio.
6. Probar lectura y contexto Hoy/Esta semana; en modo lectura, una escritura debe rechazarse también si se intenta directamente contra las RPC de Supabase. Si se habilita escritura, probar una tarea de prueba con versión e ID de solicitud.
7. Para bloquear inmediatamente el acceso, desactivar lectura y guardar permisos en Deer. Revocar además la autorización OAuth. El bloqueo consulta permisos vigentes, incluso para tokens ya emitidos.

Metadatos públicos: `/.well-known/oauth-protected-resource` y `/.well-known/oauth-protected-resource/api/mcp`. Emisor OAuth de Supabase: `https://<proyecto>.supabase.co/auth/v1`.

Documentación oficial: [inicio de OAuth Server](https://supabase.com/docs/guides/auth/oauth-server/getting-started), [seguridad de tokens](https://supabase.com/docs/guides/auth/oauth-server/token-security), [Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook).

## Alcance de las pruebas

Las pruebas locales usan PostgreSQL embebido y persistencia simulada en navegador. Cubren restricciones, propiedad, conflictos, reintentos, lotes atómicos, bloqueos OAuth, respaldo v5, navegación, guardado y exportaciones. No sustituyen la prueba posterior de OAuth real, conexiones simultáneas independientes ni Safari instalado en iPhone.

Pendiente de activación: migración productiva, publicación agrupada, autorización OAuth real y aceptación en dispositivos. Historial completo, papelera y restauración operativa sobre otra instancia corresponden a E4.

## Evidencia local de esta entrega

- 75 pruebas de lógica, datos, exportación y respaldo aprobadas, sin omisiones.
- 12 escenarios de navegador aprobados: 7 de E3 y 5 de regresión E2/acceso. La última repetición de los 7 casos E3 incluye la comprobación de ausencia de errores de hidratación y el regreso al proyecto desde una subpágina.
- Las pruebas de E3 usan una sesión simulada y respuestas en memoria; bloquean solicitudes a servicios externos. El respaldo se restaura en una base embebida nueva.
- Revisión visual de editor de escritorio y navegación móvil. La aceptación de Safari instalado sigue pendiente tras publicar.
- TypeScript y compilación de producción aprobados. La salida de compilación está aislada de la vista de desarrollo; no incluye la ruta temporal de pruebas.
