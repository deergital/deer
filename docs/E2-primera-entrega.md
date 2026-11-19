# E2.1 — Biblioteca y documentos Markdown

Fecha: 19 de noviembre de 2026. No representa E2 completa.

## Implementación

- Biblioteca privada, filtros por proyecto y tipo, paginación de 50 registros.
- Crear y editar título, tipo, proyecto opcional y contenido Markdown.
- Lectura de encabezados, negrita, listas, citas, código y enlaces HTTP/HTTPS.
  HTML no se ejecuta; otra sintaxis se conserva y aparece como texto.
- Importación .md como borrador y exportación del contenido literal.
- Guardado manual: confirmación después de RPC, conflicto sin sobrescritura,
  reintentos idempotentes y aviso al descartar cambios o cerrar la página.
- Snapshot de respaldo v2 incluye documentos. Verificador compatible con v1/v2.
- Documento máximo: 50,000 caracteres, título: 240 caracteres.

No hay todavía editor visual WYSIWYG, imágenes, adjuntos, tablas renderizadas,
Mermaid, enlaces internos/backlinks ni vínculos desde tareas. Siguen en E2.
Tampoco hay historial restaurable de versiones: el número de versión protege
el guardado concurrente; los eventos no son copias históricas del contenido.

## Activación

Aplicar únicamente `supabase/migrations/202611190002_deer_documents.sql` después
de las dos migraciones anteriores, y publicar el commit de aplicación.
No ejecutar bootstrap.sql en Supabase.

Si falta la migración, la biblioteca indica error y no simula guardado.
El resto de E1 mantiene sus operaciones de proyectos/tareas.

## Verificación ejecutada

26 pruebas aprobadas en PostgreSQL embebido y validaciones de dominio:
E1 más permisos documentales, campos protegidos, restricciones, relaciones,
reintentos, conflictos, no-op, rollback de eventos y restauración completa.
Esto no sustituye la prueba E2 contra Supabase y dos dispositivos.
TypeScript: sin errores. La compilación de producción local quedó bloqueada
por EPERM al crear carpetas de salida; debe ejecutarse desde PowerShell del
usuario o comprobarse en Netlify antes de dar esta entrega por verificada.

## Recorrido de aceptación pendiente

1. Crear «Documento de prueba E2», tipo Brief, proyecto Prueba Deer.
2. Escribir encabezado, negrita, lista, cita y enlace en Markdown; guardar.
3. Cambiar a Lectura y volver a Markdown sin alterar el contenido.
4. Volver a biblioteca, filtrar proyecto/tipo, recargar y reabrir.
5. Abrir desde iPhone: mismo título, proyecto, tipo, contenido y versión.
6. Con ambos editores abiertos guardar primero en uno; el otro rechaza
   versión antigua conservando el borrador. Recargar biblioteca antes de reabrir.
7. Importar/exportar .md y comparar el contenido, incluida sintaxis no admitida.
8. Descargar respaldo v2 y verificar con scripts/verify-backup.mjs en aislamiento.

No incorporar documentos reales hasta completar este recorrido.
