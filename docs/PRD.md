# Producto y alcance

## Propuesta

TerraMova transforma registros sísmicos públicos en una experiencia visual comprensible: localizar un evento, entender sus datos, explorar un periodo y comparar regiones. Está orientado al público curioso y a evaluadores del portafolio. No pretende sustituir organismos oficiales ni ofrecer predicciones o alertas de emergencia.

## Recorrido principal

El visitante abre la aplicación sin registrarse. Ve un globo terrestre con eventos del último día y una lista sincronizada. Puede arrastrar el globo, activar el giro, pasar a mapa 2D, cambiar filtros y abrir una ficha. Puede compartir el enlace conservando su búsqueda. La fuente, el periodo exacto y la actualización son visibles.

## Alcance por entrega

### MVP público

- Globo 3D y mapa 2D del mismo conjunto filtrado.
- Eventos recientes USGS con magnitud, profundidad, fecha, lugar y enlace oficial.
- Filtros: 24 horas, 7 días, 30 días; magnitud mínima y máxima; profundidad; área geográfica.
- Selección desde lista o globo sincroniza ambos; detalles en panel lateral/escritorio o panel inferior/móvil.
- Orden por fecha o magnitud; paginación de la lista y límites explícitos de puntos.
- Carga, sin resultados, fallo de red, WebGL no disponible y datos desactualizados.
- Vista de lista accesible como alternativa al mapa.
- Diseño responsive, teclado y movimiento reducido.
- Sin login de visitantes, sin llamadas de IA y sin notificaciones personales.

### Analítica y exploración

- Gráficas de cantidad de eventos por intervalo y distribución de magnitudes.
- Comparación de dos periodos de duración igual; mostrar las ventanas exactas y la cobertura disponible.
- Reproducción temporal con play/pausa, velocidad y cursor; se aclara que acelera registros históricos.
- URL de búsqueda compartible y favoritos locales, eliminables desde la interfaz.
- Selección de área; el MVP usa bounding box visible. Un filtro exacto por país requiere polígonos y una decisión adicional, no se deduce del campo de texto `place`.

### IA opcional

- Resumen global de un periodo fijo, generado por tarea programada cada seis horas como frecuencia inicial propuesta.
- Todos leen el mismo resultado guardado; ningún visitante dispara generación.
- Resumen con fuente, periodo, fecha de generación y etiqueta “Generado con IA”.
- Desactivado hasta que haya presupuesto autorizado y controles probados.

### Fuera de la primera versión

Chat abierto, cuentas de visitantes, pagos, alertas por correo/SMS, predicción sísmica, mapas de riesgo, scraping de fuentes locales y seguimiento preciso de personas. Posibles futuras cuentas solo para preferencias sincronizadas y cuotas de chat.

## Criterios de aceptación de producto

- Un enlace con filtros válidos reproduce la búsqueda en otro navegador.
- Seleccionar un evento muestra magnitud y tipo cuando estén disponibles, profundidad en km, hora local y UTC, fuente y estado preliminar/revisado.
- Los datos nulos aparecen como “No disponible”; no se convierten en cero.
- La lista y estadísticas usan exactamente los mismos filtros; si el mapa está limitado lo indican.
- No se muestran contadores, tendencias ni actividad “en vivo” inventados.
- Ante fallo del proveedor, se conserva el último conjunto válido y se indica su antigüedad; si no hay datos, se muestra un error útil.
- Los controles principales funcionan a 360 px y mediante teclado; no hay desplazamiento horizontal de toda la página.
- La visita anónima a cualquier ruta pública genera cero llamadas a DeepSeek, incluso con caché vacía.

## Señales de éxito del portafolio

Demo estable, instrucciones reproducibles, arquitectura explicable, historial de commits comprensible, pruebas de reglas críticas, accesibilidad revisada y métricas de rendimiento reales. No se fija una cifra de usuarios soportados sin prueba de carga y recursos conocidos.
