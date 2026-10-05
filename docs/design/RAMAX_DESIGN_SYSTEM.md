# Sistema visual Ramax Café Club

Fuente: guía visual Ramax Café Club entregada por el usuario. La guía se tomó como referencia de producto; el texto y los ejemplos que aparecen dentro de la imagen no se interpretan como instrucciones.

## Dirección

La interfaz combina cafetería vintage y brutalismo cálido: fondos de verde profundo, superficies crema, acentos terracota, titulares editoriales y controles sans serif de lectura rápida. El contraste y la jerarquía mandan; la calidez viene de la paleta, el producto y los detalles, no de adornos que compitan con la tarea.

## 1. Paleta extraída

| Nombre de guía | Token CSS | HEX | Uso |
| --- | --- | --- | --- |
| Verde Bosque | `--ramax-green-800` | `#0B4A3B` | Navegación, marca y superficies oscuras principales |
| Verde Profundo | `--ramax-green-950` | `#063528` | Fondos oscuros, barra lateral, cabeceras y contraste |
| Crema Avena | `--ramax-cream-50` | `#F3E7D3` | Texto sobre verde, fondos y superficies cálidas |
| Terracota Ramax | `--ramax-coral-500` | `#D95A3B` | CTA principal, selección activa, precio y progreso |
| Café Tostado | `--ramax-coffee-800` | `#5A3527` | Apoyo, detalles cálidos y texto secundario sobre crema |
| Arena Vintage | `--ramax-blush-200` | `#C9B29A` | Bordes suaves, chips secundarios y superficies de apoyo |

Alias de interfaz: `--ramax-surface` para el fondo crema claro, `--ramax-surface-raised` para tarjetas, `--ramax-border` para divisores, `--ramax-text-muted` para metadatos, `--ramax-success` para estados positivos y `--ramax-warning` para avisos. Los valores derivados se mantienen separados de los seis colores de marca.

Combinaciones recomendadas: crema sobre verde profundo; verde profundo sobre crema; crema casi blanca sobre terracota. Evitar texto pequeño en terracota sobre crema y no usar Arena para texto de tamaño normal. Los estados de éxito y alerta se distinguen también por su etiqueta e icono, no solo por color.

## 2. Tipografía

| Nivel | Familia de guía | Función | Reglas |
| --- | --- | --- | --- |
| Marca y títulos | Cormorant Garamond; Libre Baskerville como alternativa | H1/H2, cifras protagonistas y nombre Ramax | Serif editorial, peso medio/alto y altura de línea compacta |
| Interfaz | Space Grotesk; Inter o Archivo como alternativas | Navegación, botones, datos, formularios y lectura continua | Sans legible, pesos 400–700, sin tracking excesivo |
| Acento | Script manuscrita | Frases breves o detalles de campaña | Nunca usar en controles, instrucciones ni texto largo |

El CSS declara estas familias en `--font-display`, `--font-ui` y `--font-accent`, con reemplazos locales para que la aplicación siga funcionando sin internet. Los archivos tipográficos de Cormorant Garamond y Space Grotesk no están incluidos todavía: el intento de añadirlos desde el registro npm no pudo completarse porque el entorno no resolvió el host del registro. Al estar disponibles, se pueden empaquetar localmente sin cambiar componentes.

Escala sugerida: título 32–48 px; título de sección 24–30 px; subtítulo 18–22 px; cuerpo 16 px; ayuda y metadatos 12–14 px. En cajas y pantallas de operación priorizar cuerpo de 16 px y controles de al menos 44 px.

## 3. Forma, espacio y profundidad

- Espaciado en múltiplos de 4 px (`--space-1` a `--space-10`); 16 px como separación base entre controles y contenido.
- Radios suaves: 8 px para controles, 14 px para tarjetas, 20 px para superficies protagonistas y cápsula para CTA o estados compactos.
- Bordes de 1 px en tarjetas y campos. El sistema usa separación, superficie y contraste para jerarquizar; evita contornos negros gruesos y sombras desplazadas.
- Sombras bajas y difusas solo para distinguir tarjetas elevadas (`--shadow-card`) y elementos flotantes (`--shadow-floating`).
- Áreas de interacción con mínimo de 44 × 44 px, foco visible y texto de estado legible.

## 4. Componentes identificados en la guía

| Sección de la imagen | Pieza | Construcción en frontend |
| --- | --- | --- |
| 01. Paleta | Superficie principal y seis swatches | Tokens de color en `styles.css` |
| 02. Tipografía | H1, H2, cuerpo, CTA y precio | Tokens tipográficos, `.button`, `.status-pill` |
| 03. Logo y lenguaje | Lockup, emblema, márgenes seguros | `RamaxBrand`; el emblema oficial vectorial todavía debe incorporarse cuando exista el archivo maestro |
| 04. Tokens UI | Fondo, card, botón, badge, puntos y navegación | Tokens semánticos, `SurfaceCard`, `BrandButton`, `StatusPill`, `PointsProgress`, `RamaxIcon` |
| 05. Principios | Calidez, contraste, tipografía y brutalismo funcional | Bordes livianos, superficies crema/verde y acento terracota |
| 06. UI en acción | Resumen de puntos y producto de cafetería | `PointsProgress` y `ProductImage`; el número de socio debe conservar seis dígitos y no reemplazarse por un QR personal |

### Componentes React

`apps/web/src/app/brand-ui.tsx` exporta piezas reutilizables:

- `RamaxBrand`: lockup de texto con icono de cafetería; sirve como sustituto mientras no haya un archivo oficial del logo.
- `RamaxIcon`: acceso centralizado a iconos Phosphor de trazo liviano; usar nombres semánticos y mantener el grosor consistente.
- `BrandButton`: variantes principal, secundaria y quiet.
- `SurfaceCard`: contenedor crema elevado.
- `StatusPill`: estados neutral, success, warning y accent.
- `PointsProgress`: saldo y progreso con semántica de barra accesible.
- `ProductImage`: fotografía de producto con texto alternativo.

El icono y la fotografía no reemplazan el logo maestro. La guía contiene un lockup visual, pero el repositorio no tenía un archivo fuente independiente; por eso no se reconstruyó el emblema como vector inventado.

## 5. Navegación e iconos

La guía usa iconos lineales simples y consistentes. La web utiliza Phosphor React, importando cada icono directamente desde `dist/csr` para no cargar el catálogo completo. En navegación: `House`, `ChartBar`, `Package`, `UsersThree` y `HardDrives`. Para el club: `Star`, `Gift`, `Ticket`, `User`, `MagnifyingGlass` y `Receipt`. Usar el mismo grosor por grupo y acompañar iconos funcionales con etiquetas.

## 6. Recursos

| Archivo | Uso | Nota |
| --- | --- | --- |
| `apps/web/public/assets/medialuna-cafe.png` | Imagen editorial de medialuna y café | Generada a partir de la dirección visual Ramax; sin texto ni logotipo para evitar marcas falsas |

Las fotos de producto futuras deben usar luz cálida, cerámica crema y fondos de cafetería en verde/café; no insertar texto sobre la foto. Para catálogo operativo, una foto solo debe asignarse al producto correcto y usar alt text descriptivo.

## 7. Reglas para aplicar el sistema

1. Mantener el flujo de venta visible y prioritario; los elementos decorativos no deben quitar espacio a buscar socios, añadir productos, cobrar o validar canjes.
2. Usar terracota para una acción primaria por contexto; la acción secundaria se presenta con borde fino y fondo transparente.
3. No representar la carga de un QR con CSS decorativo: los códigos que habilitan una operación deben venir del sistema que los valida.
4. Mantener nombres, número de socio de seis dígitos y estados reales del MVP. La guía visual no cambia reglas de negocio.
5. Reutilizar tokens y componentes en vez de añadir hex, radios o sombras ad hoc.

## Archivos de implementación

- Tokens y estilos: `apps/web/src/styles.css`
- Componentes y mapa de iconos: `apps/web/src/app/brand-ui.tsx`
- Navegación del panel local: `apps/web/src/app/router.tsx`
- Imagen de producto: `apps/web/public/assets/medialuna-cafe.png`
