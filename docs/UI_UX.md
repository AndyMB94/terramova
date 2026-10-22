# Diseño e interacción

Revisión 2 (2026-10-21): se añade un sistema de movimiento explícito, referencias visuales, tipografía, tokens de animación y proceso de diseño. Reemplaza la regla anterior "el giro solo comienza por una acción del usuario" por un giro en inactividad con pausa visible (ver D22).

## Dirección visual

Producto geográfico moderno: el planeta domina la pantalla y la interfaz se mantiene mínima a su alrededor. Lenguaje de referencia: visualizaciones como earth.nullschool.net o Windy, el globo de la portada de GitHub y la sobriedad de interfaces tipo Linear o Vercel. Se toma de ellas la idea (fondo profundo, planeta protagonista, paneles discretos, datos nítidos), no sus recursos ni su marca.

- **Paleta**: fondo azul noche casi negro, texto claro, acento cian para acciones y ámbar/naranja para eventos; versión clara equivalente. Dirección visual, no codificación científica de riesgo.
- **Tipografía**: una sans moderna para interfaz (Inter o Geist) y una monoespaciada (Geist Mono o JetBrains Mono) con `font-variant-numeric: tabular-nums` para magnitudes, profundidades, coordenadas y horas. Licencia OFL, autoalojadas.
- **Paneles**: fondo sólido o casi sólido (opacidad ≥ 90 %), borde sutil de 1 px y radio moderado. El desenfoque (blur) solo como acento; el contraste AA se mide sobre el globo, no sobre fondo liso.
- **Globo**: atmósfera de Cesium (sky/ground atmosphere), iluminación día/noche opcional con el terminador solar real e imágenes nocturnas (Black Marble) en el lado oscuro si el rendimiento lo permite. Fondo espacial sobrio, sin campo de estrellas animado ni partículas.
- **Imágenes base sin costo**: NASA Blue Marble (día) y Black Marble (noche), de dominio público, servidas como teselas estáticas autoalojadas. Verificar resolución, peso y créditos. Imágenes o terreno comerciales solo con proveedor y presupuesto verificados.

Definir tokens de color, espacio, radio, sombra, tipografía y **movimiento** antes de construir pantallas, en `frontend/src/shared/styles/tokens.css`. Implementado en la Fase 3 a partir de la maqueta aprobada (D63); la escala de profundidad se ajustó para cumplir 3:1 en sus cinco tonos (D64). Evitar neón excesivo, tarjetas de relleno y efectos que impidan leer.

## Sistema de movimiento

Principio: el movimiento **comunica** dónde está un evento, qué cambió y qué es reciente; no decora. Cada animación tiene una versión reducida.

| Momento | Efecto | Regla |
| --- | --- | --- |
| Carga inicial | La cámara se acerca desde órbita lejana hasta Sudamérica (fly-in), una vez por sesión | 1,5–2 s, ease-out; cualquier interacción la salta. Reducido: corte directo |
| Inactividad | Giro lento del globo hacia el este | Empieza tras ~8 s sin interacción, ~1 vuelta cada 90 s. Se detiene al arrastrar, tocar o usar el teclado. **Botón Pausar visible** (WCAG 2.2.2). Se detiene con la pestaña oculta. Desactivado con movimiento reducido |
| Eventos recientes (última hora) | Onda que se expande y desvanece desde el punto (ripple) | Ciclo de 2–3 s; máximo ~20 ondas simultáneas, priorizando por magnitud. Reducido: anillo estático |
| Nuevos eventos tras sincronizar | Punto aparece con escala 0→1; aviso "3 eventos nuevos" | 300–500 ms. No reordenar la lista bajo el cursor: el usuario pulsa el aviso para incorporarlos |
| Selección | Vuelo de cámara al evento; halo sobre el punto; el panel de detalle entra deslizando | Cámara 0,8–1,2 s; panel 200–250 ms con spring suave. Reducido: sin vuelo, cambio inmediato |
| Hover | El punto crece levemente y aparece tooltip | 120–150 ms. Toda información del tooltip también existe en la ficha |
| Cambio de filtros | Puntos que salen se desvanecen, los nuevos aparecen; los contadores animan el número | 200–300 ms |
| Cambio 3D ↔ 2D | Morph nativo de Cesium | ~1 s. Reducido: duración 0 |
| Lista | Entrada escalonada (stagger) solo en la primera carga | 20–30 ms por ítem, máximo 10 ítems animados |
| Reproducción temporal | Los eventos aparecen con onda según su hora; el cursor avanza | La cámara no se mueve sola durante la reproducción |

Reglas técnicas:

- En el DOM solo se animan `transform` y `opacity`.
- No animar al mismo tiempo vuelo de cámara, giro y gráficas.
- Cesium con `requestRenderMode`: renderiza solo cuando algo cambia; las animaciones activas piden render explícitamente. Ahorra batería y CPU con el globo quieto.
- Presupuesto: ~60 fps en el equipo de escritorio de referencia, ≥ 30 fps en un móvil medio documentado. Si se cae por debajo, pasar automáticamente a calidad baja (sin ondas ni atmósfera) y ofrecer selector de calidad.
- Herramientas: **Motion** (motion.dev, antes Framer Motion) para la interfaz React; API de cámara de Cesium (`flyTo`, `morphTo2D/3D`) para el globo; ondas con primitives o un material/shader ligero, medido antes de adoptarlo.
- Respetar `prefers-reduced-motion` **y** ofrecer un interruptor propio en la interfaz, porque muchos usuarios no conocen la opción del sistema.

Tokens de movimiento propuestos (ajustar en el prototipo):

```css
--duration-instant: 100ms;
--duration-fast: 150ms;
--duration-base: 220ms;
--duration-slow: 350ms;
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
```

## Pantalla de exploración

| Zona | Contenido y comportamiento |
| --- | --- |
| Cabecera | TerraMova, Explorar/Analítica, tema, movimiento reducido y acceso a fuentes |
| Filtros | Periodo, magnitud, profundidad y área; filtros activos visibles y restablecer |
| Globo/mapa | Ocupa el área principal; controles 3D/2D, zoom, pausa del giro y calidad |
| Lista | Fecha, lugar, magnitud; orden y paginación; selección sincronizada |
| Ficha | Datos del evento, coordenadas, hora local/UTC, fuente y enlace USGS |
| Estado | Periodo consultado, última sincronización, cobertura y avisos de truncamiento |

El globo arranca centrado aproximadamente en Sudamérica sin pedir geolocalización. El giro y los efectos siguen el sistema de movimiento.

## Marcas geográficas

- Posiciones reales a partir de coordenadas, no de nombres de lugares.
- Tamaño de punto según una escala visual documentada y limitada; no representa energía en proporción lineal.
- Color por profundidad con una escala secuencial accesible (por ejemplo, superficial claro → profundo oscuro), con leyenda, y la misma escala en lista y ficha.
- Puntos con `PointPrimitiveCollection` para miles de eventos; agrupar o simplificar según rendimiento e indicar qué se muestra.
- No exagerar profundidad con barras 3D sin explicar la escala. MVP: punto en superficie y profundidad numérica.
- Mostrar créditos de geometría, imágenes y proveedor; no usar endpoints de demostración como infraestructura de producción.

## Analítica y reproducción

Un bloque con periodo y filtros, gráficas etiquetadas con unidades y opción para consultar cifras en tabla. Las gráficas entran con una transición corta, sin animar cada actualización. Reproducción con cursor temporal visible, pausa y velocidad. Distinguir "sin eventos registrados en esta consulta" de "sin cobertura o sin datos".

## Adaptación móvil y accesibilidad

- A 360 px, filtros colapsables, mapa de altura acotada, lista y detalle apilados o en panel inferior accesible.
- Evitar tres columnas en móvil; todas las acciones disponibles sin hover.
- Etiquetas visibles, foco claro, controles táctiles de ~44 px y contraste AA como objetivo verificable.
- En móvil, calidad del globo reducida por defecto (sin atmósfera nocturna, menos ondas).
- Lista usable sin WebGL y mensajes útiles si el navegador no soporta el globo.
- Probar zoom del navegador al 200 %, teclado y lector de pantalla en el recorrido principal.

## Estados obligatorios

Skeleton limitado durante la carga; vacío con filtros visibles; fallo de API con reintento acotado; última sincronización antigua; eventos con campos incompletos; sin IA disponible. No ocultar información crítica tras tooltips.

## Proceso de diseño

Así trabaja habitualmente un equipo de diseño de producto; adaptado a un desarrollador solo:

1. **Moodboard**: 5–8 capturas de referencia y qué se toma de cada una (color, paneles, tipografía, movimiento).
2. **Tokens** en código desde el inicio: color, tipografía, espacio, radio, sombra, duraciones y curvas.
3. **Wireframes** de baja fidelidad de Explorar a 360, 768 y 1440 px.
4. **Alta fidelidad** en Figma (plan gratuito) o directamente como prototipo en código con fixtures etiquetadas.
5. **Prototipo de movimiento** dentro del spike de Cesium: intro, giro, ondas y selección, medidos en fps antes de pulir paneles.
6. **Revisión** con capturas y una grabación corta reales; ajustar tokens, no casos sueltos.

El prototipo mostrado en la conversación original era conceptual y no es el diseño final. No conservar datos ficticios como si fueran reales al conectar el backend.
