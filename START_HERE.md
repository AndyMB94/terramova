# Empezar con Claude Code

## Primer mensaje: copia este bloque

```text
Vamos a construir TerraMova siguiendo la documentación de este repositorio.

Primero lee CLAUDE.md, README.md, docs/DECISIONS.md, docs/ROADMAP.md y docs/STRUCTURE.md; después consulta los documentos relevantes para la fase inicial.

Inspecciona los archivos existentes sin sobrescribir trabajo previo. Resume el estado real, las decisiones pendientes que bloquean y la primera fase implementable. Las decisiones de implementación rutinarias puedes resolverlas con criterio y documentarlas.

Implementa únicamente la Fase 0 del roadmap y su validación. No implementes todas las fases de una vez. Crea o adapta el entorno de desarrollo, fija dependencias compatibles y documenta comandos reales. No conectes IA de pago ni modifiques mi VPS.

Si no hay repositorio Git, inicialízalo localmente. Si ya existe, respeta su historial y revisa los cambios pendientes. No hagas commits, push, despliegues ni cambios en infraestructura sin que te los pida.

Al terminar, informa qué cambió, qué comprobaste, los bloqueos y los siguientes pasos. Actualiza el roadmap solo con evidencia. No declares terminado lo que no se haya probado.
```

## Para continuar una fase

```text
Lee CLAUDE.md, docs/DECISIONS.md, docs/STRUCTURE.md y el estado actual de docs/ROADMAP.md. Revisa el código y Git. Implementa la siguiente fase pendiente cuyo prerrequisito esté cumplido. Mantén el alcance de esa fase, ejecuta sus verificaciones y documenta el resultado. Pregunta solo por información realmente bloqueante. No hagas commits, push ni despliegues sin mi indicación.
```

## Para revisar antes de guardar una versión

```text
Revisa el diff de esta fase: funcionalidad, contratos API, seguridad, datos sensibles, pruebas y documentación. Corrige fallos dentro del alcance, vuelve a ejecutar las verificaciones afectadas y dame un mensaje de commit propuesto. No cambies archivos ajenos ni hagas commit todavía.
```

## Información que hará falta más adelante

- RAM, vCPU y disco libres del VPS y consumo actual de Vacantia; datos de diagnóstico sin secretos.
- (Ya resuelto: dominio, DNS, Nginx del host, convivencia y puertos; ver docs/DEPLOYMENT.md.)
- Zona horaria preferida de la interfaz; valor propuesto: hora local del navegador, con UTC visible en detalles.
- Presupuesto de IA que autorizas; hasta definirlo, IA desactivada.
- Acceso operativo al despliegue cuando llegue esa fase; no colocar contraseñas aquí.

No hace falta resolver todo esto para construir el entorno local y la interfaz.
