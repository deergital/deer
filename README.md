# Deer — base funcional E1

Componentes reales en Next.js/React/Material UI y migración SQL para Supabase. Esta entrega implementa el núcleo; todavía no declara completados todos los criterios E1.

## Qué funciona

- Inicio con tareas por estado y proyectos.
- Tabla y kanban sobre el mismo conjunto de tareas, filtros y paginación en modo conectado.
- Crear/editar proyectos y tareas, fechas, importancia y cambio de estado desde panel.
- Temas claro/oscuro/automático, interfaz adaptable y fuentes locales Inter/Montserrat.
- API autenticada con identidad de usuario; escrituras transaccionales mediante RPC, sin clave administrativa en cliente.
- Migración con RLS, protección de campos, idempotencia, control de versión y eventos mínimos.

Sin variables Supabase la interfaz inicia en **demostración temporal** con datos ficticios: se puede interactuar, pero los cambios desaparecen al recargar. Con variables configuradas exige sesión y perfil habilitado; no permite registro público desde Deer. Documentos indica E2 y no simula edición o guardado.

## Ejecutar

Requisitos: Node.js 22 o posterior y pnpm. Dependencias fijadas en package.json y pnpm-lock.yaml.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
pnpm dev
```

Para iniciar la compilación de producción: `pnpm start`. Abrir la URL local que indique Next.js. No exponer el servidor de desarrollo a internet.

## Conectar Supabase

1. Crear/seleccionar un proyecto de prueba separado de producción. No se ha creado uno durante esta entrega.
2. Aplicar `supabase/migrations/202611160001_deer_e1.sql` como administrador de migraciones. Requiere las tablas y funciones Auth y roles que ya incluye Supabase.
3. Crear tu cuenta por el flujo administrativo de Supabase y deshabilitar altas públicas. No usar contraseñas de ejemplo.
4. Aprovisionar el perfil mediante consulta administrativa parametrizada: id = UUID real de la cuenta, is_enabled = true y display_name = Jorge. No habilitar cuentas ajenas.
5. Copiar `.env.example` a `.env.local`; configurar la URL del proyecto y su clave publicable. Nunca usar service_role en variables NEXT_PUBLIC.
6. Reiniciar Next.js e iniciar sesión. La API verifica usuario y perfil, y consulta con su identidad; RLS añade protección en la base.
7. Ejecutar pruebas de integración en ese proyecto antes de incorporar datos reales. Configurar recuperación de cuenta, MFA y respaldo según el plan.

## SQL y límites de la prueba

- `supabase/tests/bootstrap.sql` solo simula la pequeña superficie Auth necesaria para PostgreSQL embebido; **no ejecutar en Supabase**.
- `tests/database.test.mjs` aplica la migración completa en PGlite y prueba permisos por rol, RLS, restricciones, reintentos, conflictos y rollback.
- La prueba de solicitudes repetidas simultáneas usa una conexión embebida que serializa operaciones; no sustituye prueba de carreras entre conexiones independientes en Supabase/PostgreSQL servidor.
- Restauración comprobada mediante dump y reapertura de la base embebida. La exportación/importación portable para usuario aún está pendiente de E1/E4 según el nivel del plan.
- El estado de guardado real solo se confirma cuando responde la RPC. Ante fallo la edición queda abierta; ante conflicto de versión no se sobrescribe.

## Archivos principales

| Ruta | Responsabilidad |
|---|---|
| src/components/DeerApp.tsx | Navegación, temas, vistas y formularios |
| src/app/api/data/route.ts | Identidad, lecturas paginadas y frontera de escritura |
| src/lib/domain.mjs | Validación de tarea y fechas |
| src/app/globals.css | Diseño y adaptación |
| supabase/migrations/202611160001_deer_e1.sql | Esquema, políticas y guardado atómico |
| tests/ | Pruebas ejecutables |

## Pendientes para cerrar E1

- Conectar y probar Supabase real, autenticación y sesión desde otro dispositivo.
- Probar concurrencia con conexiones independientes y errores reales de red.
- Implementar exportación/restauración técnica desde el flujo de aplicación y cerrar su criterio completo.
- Completar revisión manual de teclado, móvil y recorrido de Jorge.
- Refactorizar el componente de aplicación en módulos al ampliar funciones; las reglas de datos ya están separadas.

Código preparado para repositorio; no contiene claves ni datos reales de clientes. Fuentes con licencias OFL incluidas en public/fonts. No se ha contratado ni publicado un servicio externo.
