// Reemplazo de @nestjs/throttler en los tests unitarios (ver jest.config.ts).
// El paquete es CommonJS e importa @nestjs/common, que en Nest 12 es ESM: Node
// lo carga bien al correr la app, pero el cargador de módulos de Jest no. Los
// tests unitarios no prueban el rate limiting, así que los decoradores no
// hacen nada.
const noopDecorator = () => () => undefined;

export const Throttle = noopDecorator;
export const SkipThrottle = noopDecorator;
