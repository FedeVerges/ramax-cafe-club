# Ramax Café Club

Monorepo de la SPA React y la API NestJS.

```text
apps/web  -> ramax.app, rutas /club, /operacion y /admin
apps/api  -> /api/v1
db        -> esquema y migraciones PostgreSQL
docs      -> producto, arquitectura y decisiones
```

## Inicio local

1. Copiar `.env.example` a `.env` y completar `DATABASE_URL`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
2. Instalar dependencias con `corepack pnpm install`.
3. Ejecutar `docker compose up -d postgres` y `corepack pnpm --filter @ramax/api db:migrate`.
4. Crear el administrador con `corepack pnpm --filter @ramax/api seed:admin`.
5. Ejecutar `corepack pnpm dev:api` y `corepack pnpm dev:web` en terminales separadas.

El corte actual de E1 permite iniciar sesión como personal, crear productos con stock inicial y cerrar ventas desde caja. La API registra venta, cobro, descuento de stock y auditoría en una sola transacción. Consultá el alcance pendiente de E1 en el [plan de desarrollo](docs/PLAN_DESARROLLO_INCREMENTAL.md).
