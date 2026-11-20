# E3 ampliada: recuperación local del primer bloque

El paquete del entorno anterior dejó de estar disponible. Se reconstruyeron sus cambios desde el registro de trabajo directamente en la rama local `feature/e3-ampliada`. Es una recuperación funcional; el nuevo commit no tiene el identificador del paquete perdido.

## Implementado
- Guardado manual de documentos, conservando los borradores locales y la protección de conflictos.
- Adjuntar a documentos nuevos requiere guardar primero; se conserva el guardado automático intencional del Kanban.
- Configuración reúne apariencia, respaldo y salida; apariencia tiene botón Guardar.
- Menú inferior móvil con iconos y etiquetas.
- Avisos de descarte de formularios al cerrarlos y protección beforeunload.
- Proyecto abierto con tareas, documentos, progreso y menú de edición.
- Gantt de consulta y calendarios de tareas a 7/30 días, navegación y tareas sin fecha.
- Colección completa de tareas para evitar truncar las vistas y los indicadores a 50 registros.
- Dependencia directa de @tiptap/core, ya importada por el código.

## Pendiente: no considerar E3 completa
- Eisenhower explícito; subtareas, dependencias personales y seguimiento.
- Captura rápida, bandeja sin proyecto y búsqueda global por contenido.
- Dashboard completo, reuniones persistentes e integración de reuniones con calendario.
- Portadas, iconos, colores de proyecto y selectores visuales.
- Jerarquía real de documentos y referencias a páginas hijas.
- Tema del editor independiente, favicon adaptativo.
- MCP autenticado, conexión real con ChatGPT y resúmenes Hoy/Esta semana.
- Guardado/edición de fechas del Gantt y regreso con contexto.
- Extender respaldo/restauración al incorporar entidades nuevas.
- Validación visual de las funciones nuevas y validación final agrupada.

ChatGPT Plus no se configura como credencial API. No se ha activado un proveedor con cargos. No se ha aplicado migración a Supabase ni enviado cambios a main.

## Verificación de la recuperación en Windows
- 57 pruebas de lógica, datos y exportación aprobadas.
- 5 pruebas de interfaz aprobadas con Chrome local, incluyendo guardado manual, DOCX/PDF, visor PDF, Kanban y recuperación de sesión.
- El caso de pegado parte de párrafos: pegar una tabla dentro de otra tabla reemplaza sus celdas seleccionadas. Se verifica que el texto previo se conserve al insertar la tabla en el cuerpo del documento.
- Compilación de producción y TypeScript aprobados con salida aislada de la vista de desarrollo.
- La publicación de la rama requiere ejecutar Git desde la terminal del usuario: el proceso del agente no puede leer las credenciales de Windows.
