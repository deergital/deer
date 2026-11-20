# Documentos: procesador de texto, adjuntos y visor PDF

Esta entrega sustituye la experiencia Visual/Markdown/Lectura de E2 por el
procesador solicitado por Jorge. El contenido y los archivos existentes se conservan.

## Experiencia

- Escritorio: panel izquierdo 75% y panel derecho 25%, descontando el espacio entre
  columnas. En pantallas pequeñas se apilan para mantener controles legibles.
- El procesador abre por defecto. Barra con íconos y etiquetas accesibles para
  títulos, texto, listas, imágenes, separadores, citas, código y enlaces.
- Negrita, cursiva, subrayado, tachado, cinco fuentes, tamaño, color, resaltado y
  alineación izquierda/centro/derecha/justificada.
- Tablas por inserción o pegado HTML desde ChatGPT. Filas/columnas, combinación y
  división de celdas, encabezados, anchos ajustables, relleno y borde de celdas.
- DOCX editable y PDF paginado: formato, tablas, imágenes, pies y texto alternativo
  en DOCX. El título del documento se incluye al inicio de ambas exportaciones.
- La columna derecha muestra adjuntos, proyecto, clasificación, fechas, versión y
  acceso. Clic en PDF reemplaza solo el procesador por el visor; volver conserva
  el estado del documento. El visor permite páginas, zoom, ajuste, giro y descarga.
- Las imágenes se insertan desde la barra, desde un adjunto existente o pegando
  un archivo de imagen del portapapeles. Los demás adjuntos no se insertan en el
  cuerpo automáticamente; permanecen en el panel derecho.
- Autoguardado y borradores recuperables por cuenta/documento, con pausa ante
  conflicto. Ctrl/Cmd+clic abre enlaces desde el editor.

## Persistencia y compatibilidad

`content_json` es la fuente del formato enriquecido. `content_md` se conserva como
representación portable y para compatibilidad. Abrir un documento antiguo no lo
reescribe: se convierte a formato enriquecido al editarlo. La sintaxis antigua no
admitida se conserva como código con aviso, evitando eliminar texto silenciosamente.

La migración `202611190004_deer_word_processor.sql` añade una columna y actualiza
las funciones existentes. No elimina documentos, adjuntos, relaciones ni cuentas.
Estilos sin cambios de texto también incrementan la versión. Reintentos, auditoría,
RLS e indexación de referencias permanecen transaccionales. Un cliente antiguo
no puede sobrescribir como Markdown un documento que ya tiene formato enriquecido;
recibe `DEER_REFRESH_REQUIRED` y debe recargarse.

Los paquetes documentales v2 incluyen `document.json`, Markdown y recursos; importar
remapea referencias a archivos. Se aceptan paquetes v1. El respaldo completo v4
incluye JSON enriquecido y archivos; el verificador acepta respaldos históricos v1–v3.

## Kanban y tipografía

Arrastre con ratón y asa táctil, más selector de estado para teclado. Las escrituras
usan la versión esperada y solo confirman el nuevo estado al responder el servidor.
Las tarjetas comparten el relleno de su columna en claro/oscuro. Al abrir kanban
desde el filtro Activas se muestran todos los estados, incluido Completado.

Manrope: cuerpo regular 400, botones/etiquetas 600, secciones 700 y títulos principales
800. Texto introductorio 300 y cursiva en contenido que la requiere. Manrope no tiene
una cursiva propia: se usa oblicua. Para PDF se incluyen derivados estáticos OFL
renombrados Deer Text, con pesos regular/negrita y sus variantes oblicuas.

## Límites

- Siguen vigentes 4 MB por adjunto, 50,000 caracteres de texto y 500 KB de JSON.
- El procesador no es una réplica de Word con maquetación editorial por página.
  DOCX y PDF adaptan líneas, tablas y saltos a su motor de composición.
- PDF incorpora Manrope; Arial, Georgia/Times y Courier usan los equivalentes
  estándar Helvetica, Times y Courier. DOCX declara la fuente seleccionada y su
  apariencia depende también de las fuentes instaladas en el equipo receptor.
- El visor no edita el PDF ni añade anotaciones/OCR. Las imágenes externas necesitan
  permitir descarga por CORS; si fallan, la exportación avisa en lugar de omitirlas.
- Los destacados y diagramas antiguos se mantienen como texto/código compatible.
  Markdown aislado no representa colores, fuentes ni estilos avanzados de tabla;
  el paquete enriquecido conserva esa información.

## Verificación

49 pruebas de datos, RLS, conflictos, restauración v4, seguridad de contenido,
paquetes, DOCX editable y definición PDF. Tres recorridos en Chrome sin acceso a
Supabase: pegar/colorear tablas e insertar imagen, reabrir, descargar DOCX/PDF
reales, navegar/girar PDF, volver al texto, revisar 360 px/oscuro y arrastrar tareas.
La maqueta temporal se elimina al terminar; no se publica ningún registro de prueba.

Comandos: `pnpm test`, `pnpm test:interface`, `pnpm typecheck`, `pnpm build`.
La prueba de interfaz usa Chrome instalado, puerto 3011 y una carpeta de salida
aislada. Los recursos estáticos PDF están fijados a la versión de las dependencias.
Regenerar las fuentes PDF requiere Python + fonttools y ejecutar
`python scripts/prepare-pdf-fonts.py`; no se necesita Python en Netlify.

## Activación

1. Descargar un respaldo desde la versión publicada.
2. Aplicar una vez `202611190004_deer_word_processor.sql`, después de E2 completa.
3. Subir el commit y esperar Published en Netlify.
4. Recargar sin caché. Reabrir un documento anterior y comprobar texto/adjuntos.
5. Probar estilos, tabla pegada, PDF adjunto y exportaciones desde la cuenta real.
6. Comprobar arrastre y reapertura de estado, también en iPhone. Exportar respaldo
   v4 y validarlo antes de considerar cerrada la aceptación en producción.
