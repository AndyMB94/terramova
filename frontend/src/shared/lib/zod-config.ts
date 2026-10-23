import { z } from "zod";

// zod comprueba si puede compilar validadores con Function(), lo que la CSP de producción
// prohíbe (sin 'unsafe-eval', D114). Sin JIT valida igual. Debe ejecutarse antes de crear
// o usar cualquier esquema: main.tsx lo importa el primero (algunos módulos validan al
// importarse, como DEFAULT_FILTERS).
z.config({ jitless: true });
