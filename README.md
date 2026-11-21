# Deer — Proyectos, tareas y contexto documental

Aplicación privada Next.js/React/Material UI con Supabase y despliegue desde GitHub
en Netlify. Jorge ha comprobado el núcleo E1 y los documentos E2.1 desde ordenador
e iPhone. E3 y E3 ampliada se preparan en `feature/e3-ampliada` para una publicación agrupada.
Estado, activación y límites: [E3-estado.md](docs/E3-estado.md).

## Documentos, kanban e identidad Deergital

Procesador visual, guardado manual, borradores recuperables, imágenes y adjuntos
privados, tablas, destacados, Mermaid, enlaces internos y enlaces de vuelta.
Importación/exportación Markdown y paquetes con recursos. Tipografía local Manrope,
paleta Deergital e isotipo original para navegación/favicon.

Experiencia actual, actualización y aceptación: [E2-procesador.md](docs/E2-procesador.md).
La implementación anterior se documenta en [E2-completa.md](docs/E2-completa.md).
El registro de la primera entrega se conserva en [E2-primera-entrega.md](docs/E2-primera-entrega.md).
No declarar cerrada la aceptación E2 hasta probar los archivos reales y el recorrido
desde ambos dispositivos después de publicar.

## Ejecutar

Node.js 22 o posterior y pnpm. Dependencias fijadas y enlace hoisted para Windows.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
pnpm dev
```

El desarrollo escucha en 127.0.0.1. Producción local: `pnpm start`.
Manrope se sirve localmente; su licencia OFL está en public/fonts.

## Supabase

Aplicar en orden las migraciones de supabase/migrations. Para actualizar E2 completa (migración 202611190003 ya aplicada),
aplicar `202611190004_deer_word_processor.sql` si aún falta. Para E3 sobre E2 ya operativa, aplicar solo `202611200001_deer_e3.sql` después de respaldar; ver el procedimiento E3.
No ejecutar los archivos bootstrap de pruebas en Supabase.

La cuenta Auth debe tener un perfil habilitado explícitamente. El acceso ordinario
usa su identidad y RLS; no hay clave administrativa en cliente. Configurar las dos
variables publicables de .env.example en .env.local y Netlify. Nunca subir .env.local.
Sin configuración, las tareas/proyectos son una demostración temporal; la biblioteca
no simula persistencia documental.

La nueva migración crea el bucket privado deer-private, metadatos inmutables y
relaciones tipadas. El archivo guarda un ID estable; el acceso usa URL temporal.
No cambia las cuentas habilitadas ni permite registro público desde la aplicación.

## Respaldo y recuperación

Tras activar E3, Descargar respaldo produce ZIP v5 con perfil, proyectos, tareas, documentos,
relaciones, metadatos, reuniones y bytes privados. Conservarlo fuera del repositorio.

```sh
node scripts/verify-backup.mjs RUTA_AL_ZIP
```

También se aceptan los JSON/ZIP históricos v1/v2/v3/v4. El verificador restaura en PostgreSQL
embebido y compara valores, relaciones y archivos; nunca escribe en Supabase.
No incluye contraseñas/sesiones ni aprovisiona cuentas. La restauración operativa a
otro servicio y el historial recuperable siguen siendo parte del cierre E4.

## Verificación

Ejecutar `pnpm test`, `pnpm typecheck`, `pnpm test:interface` y `pnpm build`.
Las pruebas de navegador usan Chrome instalado, datos de prueba y una ruta temporal
que el ejecutor elimina al terminar. No escriben en Supabase ni publican en Netlify.
Se cubren reglas, RLS, reintentos, conflictos, rollback, jerarquía, reuniones,
respaldo, MCP, guardado manual, Kanban, tablas, DOCX/PDF y recuperación de sesión.

PGlite usa una conexión embebida: no sustituye la prueba con conexiones independientes
contra Supabase. La activación pendiente requiere comprobar subidas/descargas,
conflictos, importación/exportación y respaldo desde ordenador/iPhone.

## Archivos principales

| Ruta | Responsabilidad |
|---|---|
| src/components/DeerApp.tsx | Navegación, temas, tareas y proyectos |
| src/components/Documents.tsx | Biblioteca, edición y guardado documental |
| src/components/RichDocumentEditor.tsx | Edición visual Tiptap |
| src/components/DocumentReading.tsx | Lectura, archivos, enlaces y Mermaid |
| src/app/api/ | Lecturas/escrituras autenticadas |
| src/lib/document-* | Formatos, paquetes, recursos y borradores |
| supabase/migrations/ | Esquema, RLS y RPC transaccionales |
| tests/ | Pruebas ejecutables |

Acceso de pantalla de inicio en iPhone: diagnóstico, preparación y activación en
[Acceso-iPhone.md](docs/Acceso-iPhone.md). El cambio de visibilidad en Netlify
es una decisión separada y no se modifica desde el código.
