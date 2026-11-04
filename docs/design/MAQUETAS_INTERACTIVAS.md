# Maquetas interactivas

Las **39 pantallas** de `admin-e0-e1`, `app-equipo`, `app-socio` y `futuro-admin` se pueden abrir desde [el índice de maquetas](http://localhost:5173/maquetas).

```bash
corepack pnpm dev:web
```

Las rutas `/maquetas/*` usan datos de ejemplo en el navegador y funcionan sin API ni base de datos. El índice enlaza cada PNG con su pantalla homónima. Los flujos principales también se pueden recorrer desde sus botones: venta del equipo, búsqueda y validación de canjes, canje del socio, gestión del equipo y creación de campañas.

| Módulo | Inicio del flujo | Referencias |
| --- | --- | --- |
| Administración E0/E1 | `/maquetas/admin/acceso` | 6 PNG |
| Caja y canjes del equipo | `/maquetas/equipo/caja` | 16 PNG |
| Club de socios | `/maquetas/club/acceso` | 12 PNG |
| Campañas futuras | `/maquetas/campanias/listado` | 5 PNG |

Las rutas habituales `/login`, `/operacion`, `/ventas`, `/productos`, `/inventario`, `/equipo` y `/copias` conservan su conexión con la API local. Las campañas futuras solo aparecen en el índice de maquetas, no en la navegación del producto actual.

Para verificar el maquetado, ejecutar los cuatro archivos `*-visual.spec.ts` con `apps/web/playwright.visual.config.ts`. Las pruebas recorren acciones, comprueban errores de JavaScript y detectan desbordamiento horizontal a 320, 390 y 1440 píxeles según el módulo.
