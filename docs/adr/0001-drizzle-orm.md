# ADR 0001. Drizzle para acceso a PostgreSQL

## Estado

Aceptada.

## Contexto

Ventas, inventario, puntos y canjes requieren transacciones explícitas, restricciones únicas y migraciones auditables. El proyecto usa una SPA Vite, NestJS y TypeScript en un monorepo.

## Decisión

Usar Drizzle ORM y Drizzle Kit. El esquema se define en TypeScript y las migraciones SQL se versionan en `db/migrations`.

## Consecuencias

Los tipos se infieren del esquema y el equipo puede usar transacciones y SQL específico de PostgreSQL cuando el caso lo requiera. A cambio, los repositorios escriben más consultas que con un ORM de más alto nivel. Es un intercambio adecuado para reglas financieras y de inventario que deben ser explícitas.
