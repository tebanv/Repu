# Flujo de la aplicación

Qué hace el usuario y qué ve. La mecánica interna está en [DATAFLOW.md](./DATAFLOW.md) y lo que falta construir en [ROADMAP.md](./ROADMAP.md).

## 1. Producto y actores

Repu conecta a conductores con tiendas de autopartes cercanas para pedir baterías, llantas y repuestos con entrega a domicilio.

| Actor | Aplicación |
|---|---|
| Cliente | `front-user` (este repositorio) |
| Tienda | `front-store` (futuro) |
| Repartidor | `front-driver` (futuro) |
| Administrador | `front-admin` (futuro) |

## 2. Flujo del cliente

**Acceso.** Inicia sesión en `/login`. Sin sesión válida, cualquier ruta del grupo `(main)` redirige allí.

**Descubrimiento (`/`).**
1. Concede el GPS y el mapa se centra en su ubicación. Si lo deniega o lo pospone, navega desde una ubicación por defecto y puede activarlo con la cápsula flotante.
2. Ve las tiendas cercanas y las filtra por batería, llanta o repuesto.
3. Selecciona una tienda (pin o lista), ve su tarjeta y entra al catálogo.

**Selección (`/store/[slug]`).**
4. Navega el catálogo y abre el detalle de un producto en un modal.
5. Agrega productos al carrito. Si ya tiene productos de otra tienda, un diálogo le pide vaciar el carrito o cancelar.
6. Revisa el carrito en un drawer, disponible también desde el header.

**Checkout (`/checkout`): pedido real, pago simulado.**
7. Con el carrito vacío, se le redirige a `/`.
8. Elige una de sus direcciones guardadas (precargada la principal) o agrega una nueva: con "Usar mi ubicación" o escribiéndola. La nueva se guarda en su cuenta. Agrega instrucciones para el repartidor.
9. Revisa el total. El envío aparece "por confirmar" y no entra en el total hasta que el backend lo calcule ([ROADMAP.md](./ROADMAP.md) §4). La tarifa de servicio es 0.
10. Elige Wompi, la única opción en la UI, y confirma.
    - El pedido se crea en `ms-orders` con su número (`#123`) y el carrito se vacía.
    - El pago no es real.
    - Si la red falla, puede reintentar sin duplicar el pedido.

**Seguimiento (`/order/[id]`), simulado.**
11. Ve la línea de tiempo, el mapa, el repartidor mock y el detalle del pedido.
12. Avanza el estado a mano con "Simular avance". No hay ubicación en vivo ni notificaciones.
13. Al llegar a `ENTREGADO`, se abre el modal para calificar tienda y repartidor.

Puede tener varios pedidos activos a la vez; los consulta desde el drawer del header (pestañas *En curso* e *Historial*).

## 3. Pantallas

| Ruta | Pantalla |
|---|---|
| `/login` | Inicio de sesión |
| `/` | Mapa, filtros y tiendas |
| `/store/[slug]` | Catálogo de una tienda |
| `/checkout` | Dirección, pago y confirmación |
| `/order/[id]` | Seguimiento del pedido |

El detalle de producto y el carrito no son rutas: son `ProductModal` y `CartDrawer`.

## 4. Estados del pedido en el front

Definidos en `src/types/order.ts`. Un pedido pagado con Wompi nace en `PAGADO`; con cualquier otro método, en `CREADO`.

```text
CREADO → PAGADO → ACEPTADO → PREPARANDO → LISTO → RECOGIDO → EN_CAMINO → ENTREGADO
```

| Estado | Significado |
|---|---|
| `CREADO` | Pedido iniciado, pago pendiente |
| `PAGADO` | Pago confirmado |
| `ACEPTADO` | La tienda aceptó |
| `PREPARANDO` | La tienda alista los productos |
| `LISTO` | Listo para recoger |
| `RECOGIDO` | El repartidor tiene el pedido |
| `EN_CAMINO` | En ruta al cliente |
| `ENTREGADO` | Recibido |
| `CANCELADO` | Cancelado; no se permite desde `EN_CAMINO` ni `ENTREGADO` |

El botón de simulación salta estados intermedios: `PAGADO`/`ACEPTADO → PREPARANDO`, `PREPARANDO`/`LISTO → RECOGIDO`, `RECOGIDO → EN_CAMINO` y `EN_CAMINO → ENTREGADO`.

El backend modela los estados de otra forma; la brecha está en [DATA_MODEL.md](./DATA_MODEL.md) §6.
