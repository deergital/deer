# E2 — Contexto documental e identidad Deergital

19 de noviembre de 2026. Implementación local preparada; pendiente de aplicar
la migración y comprobar archivos reales en Supabase/Netlify e iPhone.

## Funciones

- Biblioteca privada, filtros proyecto/tipo, clasificación y documentos vinculados.
- Visual, Markdown y Lectura sobre una misma revisión. Tiptap conserva el contenido
  admitido en la conversión; abrir Visual no modifica la fuente. Se mantiene el
  Markdown como formato persistido de E2.1 para conservar documentos existentes.
- Tablas editables, listas con casillas, imágenes con alt/pie, adjuntos, destacados
  Nota/Hallazgo/Decisión/Próximos pasos y Mermaid con renderización restrictiva.
- Enlaces tipados por UUID entre documentos, proyectos y tareas; búsqueda de
  referencias con @ y enlaces de vuelta indexados en la transacción de guardado.
  Renombrar el destino mantiene el vínculo; Lectura muestra su título actual.
- Autoguardado tras un segundo de inactividad con título válido, además de botón
  Guardar. Se pausa ante error/conflicto y durante subidas. Nunca fuerza versiones.
- Borradores locales en IndexedDB separados por cuenta/documento. Se ofrece
  recuperación al reabrir; recuperar pausa el autoguardado hasta confirmar Guardar.
  Si cambió la versión del servidor se informa para comparar ambos contenidos.
- Importar/exportar .md literal; ZIP con Markdown, inventario y recursos. Se valida
  integridad, rutas y límites antes de subir; las referencias se remapean al importar.
- Respaldo ZIP v3 incluye registros y bytes privados con SHA-256. El verificador
  restaura en PostgreSQL embebido y comprueba relaciones y contenido binario.
- Manrope local con licencia OFL, paleta Deergital para claro/oscuro e isotipo
  original en navegación, favicon y apple-icon.

## Límites explícitos

- Documento: 50,000 caracteres. Archivo: 4 MB. Paquete documental: 20 recursos y
  20 MB descomprimidos. Respaldo desde navegador: 100 MB en archivos.
- Tipos: PNG/JPG/WebP/GIF, PDF, TXT/MD, ZIP y Office DOCX/XLSX/PPTX. No SVG ni HTML activo.
- Markdown con HTML, YAML, fórmulas, referencias o sintaxis no admitida permanece
  editable/exportable en Markdown; Visual avisa antes de convertirlo.
- Mermaid se edita como bloque de código y se dibuja en Lectura. Los pies se
  conservan como título Markdown de imagen. Enlaces externos siguen siendo externos.
- La búsqueda @ está en el selector de referencias del editor; no es búsqueda
  global E3 ni menú flotante al escribir dentro de un párrafo.
- Archivos inmutables y privados: quitar la referencia no elimina sus bytes. Si
  una importación falla a mitad, sus archivos ya registrados permanecen disponibles
  y privados; el borrador anterior se conserva. Limpieza de huérfanos e historial
  recuperable se reservan al mantenimiento/ciclo de vida de E4.
- IndexedDB depende del navegador y puede borrarse; no reemplaza el respaldo.
  No se recuperan credenciales Auth ni se importa directamente a producción.

## Activación

1. Descargar un respaldo previo desde la versión actualmente publicada.
2. Ejecutar una vez `supabase/migrations/202611190003_deer_e2_complete.sql`, después
   de E1, respaldo y E2.1 ya aplicadas. No ejecutar ningún bootstrap de pruebas.
3. Publicar la aplicación por GitHub/Netlify. No cambiar las variables publicables.
4. Crear documento de prueba; comprobar Visual/Markdown/Lectura, autoguardado y
   reapertura en ordenador/iPhone, incluyendo un conflicto entre dos editores.
5. Subir imagen con alt/pie y PDF; reabrir y descargar desde el segundo dispositivo.
6. Vincular documento, proyecto y tarea; comprobar navegación/backlinks y renombrado.
7. Exportar ZIP documental, importarlo en otro documento vacío y comparar recursos.
8. Descargar respaldo ZIP y ejecutar `node scripts/verify-backup.mjs RUTA_AL_ZIP`.
9. Simular error de red con texto editado, recargar, recuperar borrador y comparar
   antes de guardar. Confirmar acceso denegado desde una cuenta no habilitada.

## Verificación local

Pruebas de dominio, PostgreSQL embebido, RLS, reintentos, rollback, conflictos,
enlaces, registro de archivos, restauración binaria, paquetes corruptos/límites y
conversión real Tiptap. Compilación de producción con webpack y TypeScript.
Revisión visual con datos temporales en claro/oscuro, tabla, casillas y Mermaid.
Autoguardado confirmado; fallo simulado conservó el borrador en IndexedDB y
recargar ofreció recuperarlo, con aviso de versión distinta y guardado pausado.
Las comprobaciones locales no sustituyen los pasos de activación anteriores.
