# Referencias oficiales

Estos enlaces orientan la implementación. Revisar documentación vigente y compatibilidad al fijar versiones; no asumir que este plan certifica condiciones comerciales futuras.

## Datos

- USGS feeds: https://earthquake.usgs.gov/earthquakes/feed/v1.0/
- Formato GeoJSON: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
- Catálogo y filtros: https://earthquake.usgs.gov/fdsnws/event/1/
- Política de ciclo de vida: acceder desde la documentación de feeds.

## Frontend y geografía

- React: https://react.dev/
- Vite: https://vite.dev/guide/
- TypeScript: https://www.typescriptlang.org/docs/
- Tailwind: https://tailwindcss.com/docs/
- shadcn/ui: https://ui.shadcn.com/docs
- TanStack Query: https://tanstack.com/query/latest/docs/framework/react/overview
- CesiumJS: https://cesium.com/platform/cesiumjs/
- Código y licencia Cesium: https://github.com/CesiumGS/cesium
- Natural Earth: https://www.naturalearthdata.com/about/terms-of-use/
- Recharts: https://recharts.org/
- Motion (animación React): https://motion.dev/
- Rendimiento de escena Cesium (requestRenderMode): https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/
- NASA Blue Marble: https://visibleearth.nasa.gov/collection/1484/blue-marble
- NASA Black Marble: https://earthobservatory.nasa.gov/features/NightLights
- openapi-typescript / openapi-fetch: https://openapi-ts.dev/
- MSW: https://mswjs.io/

CesiumJS es abierto; servicios Cesium ion, imágenes, terreno u otros recursos se evalúan aparte. No asumir que un recurso de ejemplo es apto para tráfico de producción.

## Backend y operación

- Django: https://docs.djangoproject.com/
- Checklist despliegue Django: https://docs.djangoproject.com/en/stable/howto/deployment/checklist/
- DRF: https://www.django-rest-framework.org/
- drf-spectacular: https://drf-spectacular.readthedocs.io/
- Paginación por cursor DRF: https://www.django-rest-framework.org/api-guide/pagination/#cursorpagination
- uv: https://docs.astral.sh/uv/
- ruff: https://docs.astral.sh/ruff/
- import-linter: https://import-linter.readthedocs.io/
- supercronic: https://github.com/aptible/supercronic
- Caché de Nginx: https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_cache
- Cache-Control (MDN): https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control
- Caché DRF: https://www.django-rest-framework.org/api-guide/caching/
- Throttling DRF: https://www.django-rest-framework.org/api-guide/throttling/
- PostgreSQL: https://www.postgresql.org/docs/
- Redis: https://redis.io/docs/latest/
- Docker Compose: https://docs.docker.com/compose/
- Nginx: https://nginx.org/en/docs/
- Let's Encrypt: https://letsencrypt.org/docs/

## IA

- Inicio y autenticación: https://api-docs.deepseek.com/
- Chat completion: https://api-docs.deepseek.com/api/create-chat-completion/
- Tarifas: https://api-docs.deepseek.com/quick_start/pricing
- Límites: https://api-docs.deepseek.com/quick_start/rate_limit/
- Saldo: https://api-docs.deepseek.com/api/get-user-balance/
- Políticas: consultar los enlaces vigentes desde la plataforma oficial DeepSeek antes de activar la integración.

La API de saldo no representa un límite por proyecto ni una reserva de gasto. Confirmar modelo, tokens facturables, reintentos y controles de cuenta.

## Calidad y seguridad

- Git: https://git-scm.com/doc
- GitHub Actions: https://docs.github.com/en/actions
- Pytest: https://docs.pytest.org/
- Vitest: https://vitest.dev/guide/
- Playwright: https://playwright.dev/docs/intro
- OWASP API Security: https://owasp.org/www-project-api-security/
- Accesibilidad WCAG: https://www.w3.org/WAI/standards-guidelines/wcag/
- WCAG 2.2.2 Pausar, detener, ocultar: https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html

Documentar versiones y fecha de revisión en decisiones cuando se incorporen dependencias o servicios. Las referencias son fuentes para ejecutar el plan; no sustituyen validación de la implementación.
