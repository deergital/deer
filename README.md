# Deer — Proyectos, tareas y contexto documental

Aplicación privada Next.js/React/Material UI con Supabase y despliegue desde GitHub
en Netlify. Jorge ha comprobado el núcleo E1 y los documentos E2.1 desde ordenador
e iPhone. La ampliación E2 está preparada localmente y requiere activación.

## E2 e identidad Deergital

Visual/Markdown/Lectura, autoguardado, borradores recuperables, imágenes y adjuntos
privados, tablas, destacados, Mermaid, enlaces internos y enlaces de vuelta.
Importación/exportación Markdown y paquetes con recursos. Tipografía local Manrope,
paleta Deergital e isotipo original para navegación/favicon.

Instrucciones completas, límites y aceptación: [E2-completa.md](docs/E2-completa.md).
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

Aplicar en orden las migraciones de supabase/migrations. Para actualizar E2.1,
aplicar solo `202611190003_deer_e2_complete.sql` una vez, después de respaldar.
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

Descargar respaldo produce ZIP v3 con perfil, proyectos, tareas, documentos,
relaciones, metadatos y bytes privados. Conservarlo fuera del repositorio.

```sh
node scripts/verify-backup.mjs RUTA_AL_ZIP
```

También se aceptan los JSON históricos v1/v2. El verificador restaura en PostgreSQL
embebido y compara valores, relaciones y archivos; nunca escribe en Supabase.
No incluye contraseñas/sesiones ni aprovisiona cuentas. La restauración operativa a
otro servicio y el historial recuperable siguen siendo parte del cierre E4.

## Verificación

40 pruebas automatizadas cubren reglas, RLS, restricciones, reintentos, conflictos,
rollback, enlaces, archivos, conversión Tiptap, paquetes e integridad de respaldo.
Compilación de producción y TypeScript aprobados. Revisión de interfaz con datos
temporales: claro/oscuro, tablas, casillas, Mermaid, autoguardado y recuperación
local tras fallo simulado.

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
