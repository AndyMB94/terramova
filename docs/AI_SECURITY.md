# IA, costos y seguridad pública

## Modelo de amenazas

Aplicación accesible sin login: bots pueden consultar APIs, variar filtros para llenar cachés, agotar conexiones o intentar consumir IA. Controles de aplicación reducen abuso, pero no garantizan resistir un ataque volumétrico: para eso hay que evaluar protección del proveedor/CDN y capacidad del VPS. No alojar esta demo con acceso privilegiado a otros proyectos.

## Decisión para la primera producción

Exploración y analítica son públicas. La IA es opcional y solo produce resúmenes programados. Un GET sirve texto almacenado, incluso cuando llegan miles de visitantes. Si no existe resumen, la interfaz informa que no está disponible; nunca genera uno a petición ni tras un cache miss.

Un resumen global cada seis horas es una propuesta: cuatro oportunidades de generación al día, antes de aplicar caché y presupuesto. No equivale a un costo monetario fijo; tokens, modelo, tarifas y fallos afectan el costo. IA apagada hasta autorización del presupuesto.

## Contexto enviado y función del modelo

Django obtiene agregados deterministas y construye un JSON pequeño: ventana UTC, filtros, cobertura, cantidad, distribución, máximo y algunos eventos públicos relevantes con IDs. El modelo redacta una explicación basada en eso. No se le entrega conexión DB, credenciales, consultas SQL ni herramientas de acceso a red.

No entrenamos ni ajustamos el modelo. Dar contexto en una petición no lo convierte en un modelo entrenado con TerraMova. El tratamiento de datos por DeepSeek depende de sus condiciones vigentes: no prometer ausencia de retención o entrenamiento del proveedor. Enviar solo información pública mínima.

No se requiere base vectorial ni embeddings para resumir resultados estructurados. Si después hay un chat con herramientas, deberá aceptar solo operaciones de lectura tipadas, autorizadas y acotadas. La IA nunca decide permisos, presupuesto ni consultas SQL arbitrarias.

## Contrato de generación

- Entrada de tamaño máximo, agregados validados y texto externo tratado como datos no confiables.
- Instrucción: no inventar cifras, no predecir sismos, distinguir magnitud/profundidad y explicar límites de cobertura.
- Salida estructurada propuesta: `headline`, `paragraphs`, `referenced_event_ids` y `limitations` con límites de longitud.
- Validación de esquema, referencias permitidas y cifras antes de publicar. Mostrar estadísticas calculadas directamente desde backend como valores autoritativos.
- Renderizar texto plano o Markdown sanitizado sin HTML arbitrario. No convertir enlaces sugeridos por el modelo en URLs confiables.
- Texto marcado como IA, con fecha, ventana y fuente; revisión manual disponible.
- En caso de error o validación fallida, conservar el último resumen válido sin mostrarlo como reciente.

## Protección del presupuesto

### Secretos y aislamiento

Crear clave exclusiva de TerraMova, guardada solo en backend; no reutilizar la de otro proyecto. Esto facilita revocación y auditoría, pero no demuestra saldo o cuota separados. Verificar controles disponibles de DeepSeek y, si hace falta aislamiento financiero real, evaluar una cuenta/proyecto con facturación separada según condiciones del proveedor.

Nunca incluir claves en `VITE_*`, bundles, repositorios, mensajes de error o logs. `.env` ignorado; `.env.example` con valores vacíos o ficticios. El secreto no forma parte de imágenes Docker.

### Puerta global y reservas atómicas

Antes de llamar al proveedor, el servicio debe:

1. Comprobar `AI_ENABLED`, permiso de job y presupuesto configurado positivo. Si falta configuración de precios o conteo fiable, bloquear.
2. Calcular hash canónico del contexto, ventana, idioma y versión de prompt. Una restricción única impide duplicar la misma solicitud lógica.
3. Contar tokens de entrada con un método compatible y validado, o usar una cota conservadora documentada. Reservar entrada + salida máxima con tarifa versionada y margen. Incluir todas las categorías facturables del modelo, como razonamiento si aplica.
4. Dentro de una transacción PostgreSQL con bloqueo de fila, verificar que confirmado + reservas + nueva reserva no supera límites diario y mensual configurados. Usar Decimal o unidades monetarias enteras, nunca floats.
5. Crear la reserva y registrar la solicitud. Liberar la transacción antes del HTTP y limitar llamadas simultáneas.
6. Enviar con timeout; obtener uso, conciliar costo y liberar solo la porción no gastada confirmada. Registrar tarifa/modelo usados.
7. Ante timeout o estado ambiguo, conservar reserva y marcar `unknown`; no reintentar ni liberar automáticamente sin reconciliación. Un timeout local puede haber consumido tokens.

Persistir presupuesto en DB; reiniciar un contenedor no restablece el gasto. Alertas acompañan al bloqueo y no lo reemplazan. Si DB/contador falla, denegar la llamada. Un saldo consultado en DeepSeek es una señal adicional, no reserva transaccional de tu aplicación.

No prometer límite financiero exacto del proveedor si faltan tarifas completas, conteo conservador o aislamiento de cuenta. El límite local protege las solicitudes controladas por TerraMova; no las realizadas por otra app o una clave filtrada.

### Configuración propuesta

`AI_ENABLED=false`, `DEEPSEEK_API_KEY`, `AI_MODEL`, `AI_DAILY_BUDGET_USD=0`, `AI_MONTHLY_BUDGET_USD=0`, `AI_MAX_INPUT_TOKENS`, `AI_MAX_OUTPUT_TOKENS`, `AI_TIMEOUT_SECONDS`, `AI_MAX_CONCURRENT_REQUESTS=1`.

Los valores de tokens y timeout se fijan tras elegir un modelo y verificar la API. Los límites monetarios son decisiones del propietario; no establecer un presupuesto pagado por defecto. Los límites no deben ser modificables por requests públicos.

## Protección del resto del sistema

- Nginx: HTTPS, límites de tamaño y tasa, timeouts; no tratar esto como defensa completa contra DDoS.
- Django: `DEBUG=False`, hosts y orígenes explícitos, cabeceras de seguridad, CSRF para administración, cookies seguras y validación de proxy confiable.
- Identificar correctamente IP tras proxies; no confiar en `X-Forwarded-For` enviado libremente por el cliente.
- Parámetros acotados y consultas indexadas; sin URLs externas suministradas por usuarios para fetch (prevención de SSRF).
- PostgreSQL y Redis solo en red interna, sin puertos publicados (Docker se salta UFW; ver Reglas de red en DEPLOYMENT.md); Redis con contraseña; usuario DB de privilegios mínimos.
- Panel admin reservado al propietario, preferiblemente tras VPN o restricción adicional; contraseñas fuertes. No crear endpoints de sincronización públicos.
- CORS no es autenticación ni impide scripts externos. CSRF protege acciones concretas del navegador, no evita scraping ni consumo de un endpoint público.
- Logs con IDs técnicos, errores redactados y retención limitada. Copias de seguridad protegidas y restauración probada.
- Dependencias fijadas y revisión de vulnerabilidades; CSP ajustada a Cesium/Web Workers y recursos reales, no desactivada globalmente para hacer funcionar el globo.

## Si se añade chat después

Exigir decisión de alcance nueva: login verificado, cuotas por cuenta + IP + globales, control anti-bot si procede, límites de conversación y tokens, presupuesto atómico y autorización de herramientas. Ni login ni CAPTCHA garantizan ausencia de abuso. No abrir el chat hasta probar concurrencia, manipulación de contexto y cortes de gasto.

## Pruebas obligatorias

- Cien lecturas del resumen, con caché presente o vacía, hacen cero llamadas al adapter IA.
- Dos jobs simultáneos no gastan dos veces el presupuesto restante ni generan duplicados.
- Presupuesto agotado o DB no disponible impide toda llamada pagada.
- Timeout deja reserva pendiente y no provoca reintento automático facturable.
- Reinicio conserva reservas y totales.
- Salida inválida, enlaces externos o referencias inventadas no se publican.
- Bundle y logs no contienen claves. No utilizar una clave real para demostrar estas pruebas.
