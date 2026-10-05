package co.com.bancolombia.r2dbc;

import co.com.bancolombia.model.cart.Cart;
import co.com.bancolombia.model.cart.gateways.CartRepository;
import co.com.bancolombia.model.itemcart.ItemCart;
import co.com.bancolombia.model.order.CheckoutContext;
import co.com.bancolombia.model.order.CheckoutProduct;
import co.com.bancolombia.model.order.DeliveryStatus;
import co.com.bancolombia.model.order.IdempotencyRecord;
import co.com.bancolombia.model.order.IdempotencyStatus;
import co.com.bancolombia.model.order.LocationSnapshot;
import co.com.bancolombia.model.order.MerchantStatus;
import co.com.bancolombia.model.order.NewOrder;
import co.com.bancolombia.model.order.Order;
import co.com.bancolombia.model.order.OrderActorType;
import co.com.bancolombia.model.order.OrderException;
import co.com.bancolombia.model.order.OrderPage;
import co.com.bancolombia.model.order.OrderStateDomain;
import co.com.bancolombia.model.order.OrderStatus;
import co.com.bancolombia.model.order.gateways.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class OrderPostgresqlAdapter implements CartRepository, OrderRepository {
    private static final String ORDER_SELECT = """
            SELECT o.id_orden, o.numero_orden_legible, o.id_usuario_comprador, o.id_empresa, o.version,
                   o.estado_orden, o.estado_pago, o.estado_comercio, o.estado_envio,
                   o.subtotal, o.costo_envio, o.descuentos, o.impuestos, o.costo_servicio, o.total_final,
                   o.direccion_entrega_snapshot, o.notas_cliente, o.fecha_creacion,
                   COALESCE(jsonb_agg(jsonb_build_object(
                       'id', d.id_detalle, 'productId', d.id_producto, 'name', d.nombre_producto_snapshot,
                       'sku', d.sku_snapshot, 'quantity', d.cantidad, 'unitPrice', d.precio_unitario_snapshot,
                       'lineTotal', d.total_linea, 'characteristics', d.caracteristicas_snapshot,
                       'selectedOptions', d.opciones_seleccionadas_snapshot
                   )) FILTER (WHERE d.id_detalle IS NOT NULL), '[]'::jsonb) AS items_json
            FROM repu.ordenes o
            LEFT JOIN repu.detalles_orden d ON d.id_orden = o.id_orden
            """;

    private final DatabaseClient database;
    private final OrderPersistenceMapper mapper;

    @Override
    public Mono<Cart> findActive(UUID userId, UUID companyId) {
        return touchCart(userId, companyId)
                .flatMap(rows -> rows == 1 ? loadCart(userId, companyId)
                        : Mono.empty());
    }

    @Override
    public Mono<Cart> lockActive(UUID userId, UUID companyId) {
        return database.sql("""
                        SELECT id_carrito FROM repu.carritos_compras
                        WHERE id_usuario = :userId AND id_empresa = :companyId AND estado = 'ACTIVO'
                        FOR UPDATE
                        """)
                .bind("userId", userId)
                .bind("companyId", companyId)
                .fetch().one()
                .switchIfEmpty(Mono.error(OrderException.notFound("CART_NOT_FOUND", "No existe un carrito activo para esta empresa.")))
                .then(touchCart(userId, companyId))
                .then(loadCart(userId, companyId));
    }

    @Override
    public Mono<Cart> addItem(UUID userId, UUID companyId, UUID productId, int quantity,
                              Map<String, Object> selectedOptions) {
        String createCart = """
                INSERT INTO repu.carritos_compras (id_usuario, id_empresa, estado)
                SELECT :userId, e.id_empresa, 'ACTIVO'
                FROM repu.empresas e
                WHERE e.id_empresa = :companyId AND e.activo = TRUE
                ON CONFLICT (id_usuario, id_empresa) WHERE estado = 'ACTIVO'
                DO UPDATE SET fecha_ultimo_acceso = CURRENT_TIMESTAMP
                RETURNING id_carrito
                """;
        return database.sql(createCart)
                .bind("userId", userId)
                .bind("companyId", companyId)
                .fetch().one()
                .switchIfEmpty(Mono.error(OrderException.notFound("COMPANY_NOT_FOUND", "La empresa no existe o está inactiva.")))
                .flatMap(cartRow -> {
                    UUID cartId = uuid(cartRow.get("id_carrito"));
                    return database.sql("""
                                    SELECT id_producto FROM repu.productos
                                    WHERE id_producto = :productId AND id_empresa = :companyId
                                      AND activo = TRUE AND inventario_disponible > 0
                                    """)
                            .bind("productId", productId)
                            .bind("companyId", companyId)
                            .fetch().one()
                            .switchIfEmpty(Mono.error(OrderException.notFound("PRODUCT_NOT_AVAILABLE",
                                    "El producto no está disponible para esta empresa.")))
                            .then(database.sql("""
                                    INSERT INTO repu.items_carrito
                                        (id_carrito, id_producto, cantidad, datos_seleccionados)
                                    VALUES (:cartId, :productId, :quantity, :selectedOptions)
                                    ON CONFLICT (id_carrito, id_producto)
                                    DO UPDATE SET cantidad = repu.items_carrito.cantidad + EXCLUDED.cantidad,
                                                  datos_seleccionados = EXCLUDED.datos_seleccionados,
                                                  fecha_agregado = CURRENT_TIMESTAMP
                                    """)
                                    .bind("cartId", cartId)
                                    .bind("productId", productId)
                                    .bind("quantity", quantity)
                                    .bind("selectedOptions", mapper.json(selectedOptions))
                                    .fetch().rowsUpdated()
                                    .flatMap(rows -> rows == 1
                                            ? loadCart(userId, companyId)
                                            : Mono.error(new IllegalStateException("Cart item upsert affected no rows."))));
                });
    }

    @Override
    public Mono<Cart> removeItem(UUID userId, UUID itemId) {
        return database.sql("""
                        SELECT c.id_carrito, c.id_empresa
                        FROM repu.carritos_compras c
                        JOIN repu.items_carrito i ON i.id_carrito = c.id_carrito
                        WHERE i.id_item_carrito = :itemId AND c.id_usuario = :userId AND c.estado = 'ACTIVO'
                        FOR UPDATE OF c
                        """)
                .bind("itemId", itemId)
                .bind("userId", userId)
                .fetch().one()
                .switchIfEmpty(Mono.error(OrderException.notFound("CART_ITEM_NOT_FOUND",
                        "El producto no existe en un carrito activo del comprador.")))
                .flatMap(row -> database.sql("""
                                DELETE FROM repu.items_carrito
                                WHERE id_item_carrito = :itemId AND id_carrito = :cartId
                                """)
                        .bind("itemId", itemId)
                        .bind("cartId", uuid(row.get("id_carrito")))
                        .fetch().rowsUpdated()
                        .flatMap(rows -> rows == 1
                                ? touchCart(userId, uuid(row.get("id_empresa"))).then(
                                        loadCart(userId, uuid(row.get("id_empresa"))))
                                : Mono.error(OrderException.notFound("CART_ITEM_NOT_FOUND",
                                        "El producto ya no pertenece al carrito activo."))));
    }

    @Override
    public Mono<Void> convert(UUID cartId) {
        return database.sql("""
                        UPDATE repu.carritos_compras SET estado = 'CONVERTIDO'
                        WHERE id_carrito = :cartId AND estado = 'ACTIVO'
                        """)
                .bind("cartId", cartId)
                .fetch().rowsUpdated()
                .flatMap(rows -> rows == 1 ? Mono.empty()
                        : Mono.error(OrderException.conflict("CART_NOT_ACTIVE", "El carrito ya no está activo.")))
                .then();
    }

    private Mono<Long> touchCart(UUID userId, UUID companyId) {
        return database.sql("""
                        UPDATE repu.carritos_compras SET fecha_ultimo_acceso = CURRENT_TIMESTAMP
                        WHERE id_usuario = :userId AND id_empresa = :companyId AND estado = 'ACTIVO'
                        """)
                .bind("userId", userId)
                .bind("companyId", companyId)
                .fetch().rowsUpdated();
    }

    private Mono<Cart> loadCart(UUID userId, UUID companyId) {
        String sql = """
                SELECT c.id_carrito, c.id_empresa, c.fecha_ultimo_acceso,
                       i.id_item_carrito, i.id_producto, i.cantidad, i.datos_seleccionados,
                       p.nombre, p.sku_referencia, COALESCE(p.precio_oferta, p.precio_base) AS precio_actual
                FROM repu.carritos_compras c
                LEFT JOIN repu.items_carrito i ON i.id_carrito = c.id_carrito
                LEFT JOIN repu.productos p ON p.id_producto = i.id_producto AND p.id_empresa = c.id_empresa
                WHERE c.id_usuario = :userId AND c.id_empresa = :companyId AND c.estado = 'ACTIVO'
                ORDER BY i.fecha_agregado ASC
                """;
        return database.sql(sql)
                .bind("userId", userId)
                .bind("companyId", companyId)
                .fetch().all()
                .collectList()
                .flatMap(rows -> {
                    if (rows.isEmpty()) {
                        return Mono.empty();
                    }
                    Map<String, Object> first = rows.getFirst();
                    List<ItemCart> items = rows.stream()
                            .filter(row -> row.get("id_item_carrito") != null)
                            .map(mapper::cartItem)
                            .toList();
                    BigDecimal total = items.stream().map(ItemCart::subtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
                    return Mono.just(new Cart(uuid(first.get("id_carrito")), uuid(first.get("id_empresa")), items,
                            total, instant(first.get("fecha_ultimo_acceso"))));
                });
    }

    @Override
    public Mono<CheckoutContext> checkoutContext(UUID userId, UUID companyId, UUID addressId) {
        return database.sql("""
                        SELECT a.nombre_direccion, a.direccion_completa, a.ciudad, a.codigo_postal, a.notas_entrega,
                               ST_Y(a.ubicacion::geometry) AS latitude, ST_X(a.ubicacion::geometry) AS longitude
                        FROM repu.direcciones_usuario a
                        JOIN repu.empresas e ON e.id_empresa = :companyId AND e.activo = TRUE
                        WHERE a.id_direccion = :addressId AND a.id_usuario = :userId AND a.activo = TRUE
                        """)
                .bind("userId", userId)
                .bind("companyId", companyId)
                .bind("addressId", addressId)
                .fetch().one()
                .switchIfEmpty(Mono.error(OrderException.notFound("ADDRESS_NOT_FOUND",
                        "La dirección no existe, está inactiva o no pertenece al comprador.")))
                .map(row -> {
                    var snapshot = new java.util.LinkedHashMap<String, Object>();
                    snapshot.put("name", text(row.get("nombre_direccion")));
                    snapshot.put("fullAddress", text(row.get("direccion_completa")));
                    snapshot.put("city", text(row.get("ciudad")));
                    putIfPresent(snapshot, "postalCode", row.get("codigo_postal"));
                    putIfPresent(snapshot, "deliveryNotes", row.get("notas_entrega"));
                    snapshot.put("lat", decimal(row.get("latitude")));
                    snapshot.put("lng", decimal(row.get("longitude")));
                    return new CheckoutContext(snapshot);
                });
    }

    @Override
    public Mono<CheckoutProduct> lockProduct(UUID companyId, UUID productId) {
        return database.sql("""
                        SELECT p.id_producto, p.nombre, p.sku_referencia,
                               COALESCE(p.precio_oferta, p.precio_base) AS precio_actual,
                               p.caracteristicas_tecnicas
                        FROM repu.productos p
                        JOIN repu.empresas e ON e.id_empresa = p.id_empresa AND e.activo = TRUE
                        WHERE p.id_producto = :productId AND p.id_empresa = :companyId AND p.activo = TRUE
                        FOR UPDATE OF p
                        """)
                .bind("productId", productId)
                .bind("companyId", companyId)
                .fetch().one()
                .switchIfEmpty(Mono.error(OrderException.notFound("PRODUCT_NOT_AVAILABLE",
                        "El producto no está disponible para esta empresa.")))
                .map(row -> new CheckoutProduct(uuid(row.get("id_producto")), text(row.get("nombre")),
                        textOrNull(row.get("sku_referencia")), decimal(row.get("precio_actual")),
                        mapper.jsonObject(row.get("caracteristicas_tecnicas"))));
    }

    @Override
    public Mono<Void> reserveInventory(UUID companyId, UUID productId, int quantity) {
        return database.sql("""
                        UPDATE repu.productos
                        SET inventario_disponible = inventario_disponible - :quantity,
                            inventario_reservado = inventario_reservado + :quantity
                        WHERE id_producto = :productId AND id_empresa = :companyId
                          AND activo = TRUE AND inventario_disponible >= :quantity
                        """)
                .bind("quantity", quantity)
                .bind("productId", productId)
                .bind("companyId", companyId)
                .fetch().rowsUpdated()
                .flatMap(rows -> rows == 1 ? Mono.empty()
                        : Mono.error(OrderException.conflict("INSUFFICIENT_STOCK",
                                "El inventario disponible no alcanza para completar la orden.")))
                .then();
    }

    @Override
    public Mono<IdempotencyRecord> beginIdempotency(UUID requestId, UUID userId, UUID companyId, String requestHash) {
        return database.sql("""
                        INSERT INTO repu.idempotencias_checkout
                            (clave_idempotencia, id_usuario, id_empresa, request_hash, estado)
                        SELECT :requestId, u.id_usuario, e.id_empresa, :requestHash, 'PROCESANDO'
                        FROM repu.usuarios u
                        JOIN repu.empresas e ON e.id_empresa = :companyId AND e.activo = TRUE
                        WHERE u.id_usuario = :userId
                        ON CONFLICT (clave_idempotencia) DO NOTHING
                        """)
                .bind("requestId", requestId)
                .bind("userId", userId)
                .bind("companyId", companyId)
                .bind("requestHash", requestHash)
                .fetch().rowsUpdated()
                .then(database.sql("""
                                SELECT id_usuario, id_empresa, request_hash, estado, id_orden
                                FROM repu.idempotencias_checkout
                                WHERE clave_idempotencia = :requestId
                                FOR UPDATE
                                """)
                        .bind("requestId", requestId)
                        .fetch().one()
                        .switchIfEmpty(Mono.error(OrderException.notFound("COMPANY_NOT_FOUND",
                                "La empresa indicada no existe o está inactiva.")))
                        .map(row -> new IdempotencyRecord(uuid(row.get("id_usuario")), uuid(row.get("id_empresa")),
                                text(row.get("request_hash")), IdempotencyStatus.valueOf(text(row.get("estado"))),
                                nullableUuid(row.get("id_orden")))));
    }

    @Override
    public Mono<Void> completeIdempotency(UUID requestId, UUID orderId) {
        return database.sql("""
                        UPDATE repu.idempotencias_checkout
                        SET estado = 'COMPLETADA', id_orden = :orderId
                        WHERE clave_idempotencia = :requestId AND estado = 'PROCESANDO'
                        """)
                .bind("requestId", requestId)
                .bind("orderId", orderId)
                .fetch().rowsUpdated()
                .flatMap(rows -> rows == 1 ? Mono.empty()
                        : Mono.error(OrderException.conflict("IDEMPOTENCY_CONFLICT", "No se pudo completar la clave idempotente.")))
                .then();
    }

    @Override
    public Mono<Long> createOrder(NewOrder order) {
        var query = database.sql("""
                        INSERT INTO repu.ordenes
                            (id_orden, id_usuario_comprador, id_empresa, estado_orden, estado_pago,
                             estado_comercio, estado_envio, subtotal, costo_envio, costo_servicio,
                             impuestos, descuentos, total_final, direccion_entrega_snapshot, notas_cliente)
                        VALUES (:id, :buyerId, :companyId, 'CREADA', 'PENDIENTE',
                                'PENDIENTE_CONFIRMACION', 'NO_ASIGNADO', :subtotal, :shippingCost, :serviceFee,
                                :taxes, :discounts, :total, :address, :notes)
                        RETURNING numero_orden_legible
                        """)
                .bind("id", order.id())
                .bind("buyerId", order.buyerUserId())
                .bind("companyId", order.companyId())
                .bind("subtotal", order.subtotal())
                .bind("shippingCost", order.shippingCost())
                .bind("serviceFee", order.serviceFee())
                .bind("taxes", order.taxes())
                .bind("discounts", order.discounts())
                .bind("total", order.finalTotal())
                .bind("address", mapper.json(order.addressSnapshot()));
        return bindNullable(query, "notes", order.customerNotes(), String.class)
                .fetch().one()
                .map(row -> longValue(row.get("numero_orden_legible")))
                .switchIfEmpty(Mono.error(new IllegalStateException("Order insert did not return its readable number.")));
    }

    @Override
    public Mono<Void> addOrderItem(UUID orderId, CheckoutProduct product, int quantity,
                                   Map<String, Object> selectedOptions) {
        BigDecimal lineTotal = product.unitPrice().multiply(BigDecimal.valueOf(quantity));
        var query = database.sql("""
                        INSERT INTO repu.detalles_orden
                            (id_orden, id_producto, nombre_producto_snapshot, sku_snapshot, cantidad,
                             precio_unitario_snapshot, total_linea, caracteristicas_snapshot,
                             opciones_seleccionadas_snapshot)
                        VALUES (:orderId, :productId, :name, :sku, :quantity, :price, :total, :characteristics, :options)
                        """)
                .bind("orderId", orderId)
                .bind("productId", product.productId())
                .bind("name", product.name())
                .bind("quantity", quantity)
                .bind("price", product.unitPrice())
                .bind("total", lineTotal)
                .bind("characteristics", mapper.json(product.characteristics()))
                .bind("options", mapper.json(selectedOptions));
        return bindNullable(query, "sku", product.sku(), String.class).fetch().rowsUpdated().then();
    }

    @Override
    public Mono<Void> createReservation(UUID orderId, UUID productId, int quantity, Instant expiresAt) {
        return database.sql("""
                        INSERT INTO repu.reservas_inventario
                            (id_orden, id_producto, cantidad_reservada, estado, expira_en)
                        VALUES (:orderId, :productId, :quantity, 'ACTIVA', :expiresAt)
                        """)
                .bind("orderId", orderId)
                .bind("productId", productId)
                .bind("quantity", quantity)
                .bind("expiresAt", OffsetDateTime.ofInstant(expiresAt, ZoneOffset.UTC))
                .fetch().rowsUpdated().then();
    }

    @Override
    public Mono<Void> recordHistory(UUID orderId, OrderStateDomain domain, String previous, String next,
                                   UUID actorId, OrderActorType actorType, String reason) {
        var query = database.sql("""
                INSERT INTO repu.historial_estados_orden
                    (id_orden, dominio_estado, estado_anterior, estado_nuevo, id_usuario_actor, tipo_actor, motivo)
                VALUES (:orderId, :domain, :previous, :next, :actorId, :actorType, :reason)
                """)
                .bind("orderId", orderId)
                .bind("domain", domain.name())
                .bind("next", next)
                .bind("actorType", actorType.name());
        query = bindNullable(query, "previous", previous, String.class);
        query = bindNullable(query, "actorId", actorId, UUID.class);
        query = bindNullable(query, "reason", reason, String.class);
        return query.fetch().rowsUpdated().then();
    }

    @Override
    public Mono<Order> findById(UUID orderId, UUID requesterId) {
        String sql = ORDER_SELECT + """
                WHERE o.id_orden = :orderId
                  AND (o.id_usuario_comprador = :requesterId OR EXISTS (
                      SELECT 1 FROM repu.empresas e
                      WHERE e.id_empresa = o.id_empresa AND e.id_usuario_propietario = :requesterId
                  ))
                GROUP BY o.id_orden
                """;
        return database.sql(sql)
                .bind("orderId", orderId)
                .bind("requesterId", requesterId)
                .fetch().one()
                .map(mapper::order)
                .switchIfEmpty(Mono.error(OrderException.notFound("ORDER_NOT_FOUND",
                        "La orden no existe o el usuario no tiene acceso.")));
    }

    @Override
    public Mono<Order> findCompanyOrder(UUID orderId, UUID companyId, UUID actorId) {
        String sql = ORDER_SELECT + """
                JOIN repu.empresas e ON e.id_empresa = o.id_empresa
                WHERE o.id_orden = :orderId AND o.id_empresa = :companyId
                GROUP BY o.id_orden
                """;
        return database.sql("""
                        SELECT 1 AS allowed FROM repu.empresas
                        WHERE id_empresa = :companyId AND id_usuario_propietario = :actorId AND activo = TRUE
                        """)
                .bind("companyId", companyId)
                .bind("actorId", actorId)
                .fetch().one()
                .switchIfEmpty(Mono.error(OrderException.forbidden("TENANT_ACCESS_DENIED",
                        "El usuario autenticado no administra esta empresa.")))
                .then(database.sql(sql).bind("orderId", orderId).bind("companyId", companyId)
                .fetch().one()
                .map(mapper::order)
                .switchIfEmpty(Mono.error(OrderException.notFound("ORDER_NOT_FOUND",
                        "La orden no existe para la empresa indicada."))));
    }

    @Override
    public Mono<OrderPage> list(UUID requesterId, OrderStatus status, int page, int size) {
        String scope = """
                (o.id_usuario_comprador = :requesterId OR EXISTS (
                    SELECT 1 FROM repu.empresas e
                    WHERE e.id_empresa = o.id_empresa AND e.id_usuario_propietario = :requesterId
                ))
                AND (:status IS NULL OR o.estado_orden = :status)
                """;
        var countQuery = database.sql("SELECT COUNT(*) AS total FROM repu.ordenes o WHERE " + scope)
                .bind("requesterId", requesterId);
        countQuery = bindNullable(countQuery, "status", status == null ? null : status.name(), String.class);
        return countQuery.fetch().one()
                .map(row -> longValue(row.get("total")))
                .flatMap(total -> {
                    String sql = ORDER_SELECT + " WHERE " + scope
                            + " GROUP BY o.id_orden ORDER BY o.fecha_creacion DESC LIMIT :limit OFFSET :offset";
                    var query = database.sql(sql).bind("requesterId", requesterId)
                            .bind("limit", size).bind("offset", (long) page * size);
                    query = bindNullable(query, "status", status == null ? null : status.name(), String.class);
                    return query.fetch().all().map(mapper::order).collectList()
                            .map(content -> new OrderPage(content, total, page, size));
                });
    }

    @Override
    public Flux<Order> listActive(UUID requesterId) {
        String sql = ORDER_SELECT + """
                WHERE (o.id_usuario_comprador = :requesterId OR EXISTS (
                    SELECT 1 FROM repu.empresas e
                    WHERE e.id_empresa = o.id_empresa AND e.id_usuario_propietario = :requesterId
                ))
                  AND o.estado_orden NOT IN ('COMPLETADA', 'CANCELADA')
                GROUP BY o.id_orden
                ORDER BY o.fecha_creacion DESC
                """;
        return database.sql(sql).bind("requesterId", requesterId).fetch().all().map(mapper::order);
    }

    @Override
    public Mono<Void> updateStatuses(Order order, OrderStatus orderStatus, MerchantStatus merchantStatus,
                                     DeliveryStatus deliveryStatus, String rejectionReason) {
        var query = database.sql("""
                UPDATE repu.ordenes
                SET estado_orden = :orderStatus, estado_comercio = :merchantStatus,
                    estado_envio = :deliveryStatus,
                    motivo_rechazo_comercio = COALESCE(:reason, motivo_rechazo_comercio),
                    version = version + 1
                WHERE id_orden = :orderId AND version = :version
                """)
                .bind("orderStatus", orderStatus.name())
                .bind("merchantStatus", merchantStatus.name())
                .bind("deliveryStatus", deliveryStatus.name())
                .bind("orderId", order.id())
                .bind("version", order.version());
        query = bindNullable(query, "reason", rejectionReason, String.class);
        return query.fetch().rowsUpdated()
                .flatMap(rows -> rows == 1 ? Mono.empty()
                        : Mono.error(OrderException.conflict("CONCURRENT_MODIFICATION",
                                "La orden fue modificada por otra operación.")))
                .then();
    }

    @Override
    public Mono<Void> releaseReservations(UUID orderId, Instant releasedAt) {
        return database.sql("""
                        WITH released AS (
                            UPDATE repu.reservas_inventario
                            SET estado = 'LIBERADA', fecha_liberacion = :releasedAt
                            WHERE id_orden = :orderId AND estado = 'ACTIVA'
                            RETURNING id_producto, cantidad_reservada
                        ),
                        quantities AS (
                            SELECT id_producto, SUM(cantidad_reservada)::INTEGER AS quantity
                            FROM released GROUP BY id_producto
                        )
                        UPDATE repu.productos p
                        SET inventario_reservado = p.inventario_reservado - q.quantity,
                            inventario_disponible = p.inventario_disponible + q.quantity
                        FROM quantities q
                        WHERE p.id_producto = q.id_producto
                        """)
                .bind("releasedAt", OffsetDateTime.ofInstant(releasedAt, ZoneOffset.UTC))
                .bind("orderId", orderId)
                .fetch().rowsUpdated().then();
    }

    @Override
    public Mono<Void> createShipment(UUID orderId, String pickupPin) {
        return database.sql("""
                        INSERT INTO repu.envios
                            (id_orden, estado_envio, pin_recogida, ubicacion_origen, ubicacion_destino)
                        SELECT o.id_orden, 'NO_ASIGNADO', :pin,
                               e.ubicacion,
                               ST_SetSRID(ST_MakePoint(
                                   (o.direccion_entrega_snapshot->>'lng')::DOUBLE PRECISION,
                                   (o.direccion_entrega_snapshot->>'lat')::DOUBLE PRECISION), 4326)::GEOGRAPHY
                        FROM repu.ordenes o
                        JOIN repu.empresas e ON e.id_empresa = o.id_empresa
                        WHERE o.id_orden = :orderId
                        ON CONFLICT (id_orden) DO NOTHING
                        """)
                .bind("pin", pickupPin)
                .bind("orderId", orderId)
                .fetch().rowsUpdated()
                .flatMap(rows -> rows == 1 ? Mono.empty()
                        : Mono.error(OrderException.conflict("SHIPMENT_ALREADY_EXISTS", "La orden ya tiene un envío.")))
                .then();
    }

    @Override
    public Mono<LocationSnapshot> currentLocation(UUID orderId, UUID requesterId) {
        return database.sql("""
                        SELECT e.id_usuario_domiciliario,
                               ST_Y(p.ubicacion_actual::geometry) AS latitude,
                               ST_X(p.ubicacion_actual::geometry) AS longitude,
                               p.velocidad_detectada, p.rumbo_grados, p.fecha_actualizacion
                        FROM repu.ordenes o
                        JOIN repu.envios e ON e.id_orden = o.id_orden
                        JOIN repu.posiciones_actuales_envio p ON p.id_envio = e.id_envio
                        WHERE o.id_orden = :orderId AND (
                            o.id_usuario_comprador = :requesterId OR EXISTS (
                                SELECT 1 FROM repu.empresas c
                                WHERE c.id_empresa = o.id_empresa AND c.id_usuario_propietario = :requesterId
                            )
                        )
                        """)
                .bind("orderId", orderId)
                .bind("requesterId", requesterId)
                .fetch().one()
                .map(mapper::location)
                .switchIfEmpty(Mono.error(OrderException.notFound("LOCATION_NOT_FOUND",
                        "No existe una posición actual para esta orden o el usuario no tiene acceso.")));
    }

    @Override
    public Mono<Integer> expireReservations(Instant now) {
        return database.sql("""
                        WITH expired AS (
                            UPDATE repu.reservas_inventario
                            SET estado = 'EXPIRADA', fecha_liberacion = :now
                            WHERE estado = 'ACTIVA' AND expira_en <= :now
                            RETURNING id_producto, cantidad_reservada
                        ),
                        quantities AS (
                            SELECT id_producto, SUM(cantidad_reservada)::INTEGER AS quantity
                            FROM expired GROUP BY id_producto
                        ),
                        restored AS (
                            UPDATE repu.productos p
                            SET inventario_reservado = p.inventario_reservado - q.quantity,
                                inventario_disponible = p.inventario_disponible + q.quantity
                            FROM quantities q
                            WHERE p.id_producto = q.id_producto
                            RETURNING p.id_producto
                        )
                        SELECT COUNT(*) AS expired_count FROM expired
                        """)
                .bind("now", OffsetDateTime.ofInstant(now, ZoneOffset.UTC))
                .fetch().one()
                .map(row -> integer(row.get("expired_count")))
                .defaultIfEmpty(0);
    }

    private void putIfPresent(Map<String, Object> map, String key, Object value) {
        if (value != null) {
            map.put(key, value);
        }
    }

    private DatabaseClient.GenericExecuteSpec bindNullable(DatabaseClient.GenericExecuteSpec query, String name,
                                                            Object value, Class<?> type) {
        return value == null ? query.bindNull(name, type) : query.bind(name, value);
    }

    private UUID uuid(Object value) {
        if (value instanceof UUID id) {
            return id;
        }
        return UUID.fromString(text(value));
    }

    private UUID nullableUuid(Object value) {
        return value == null ? null : uuid(value);
    }

    private String text(Object value) {
        return String.valueOf(value);
    }

    private String textOrNull(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private int integer(Object value) {
        return ((Number) value).intValue();
    }

    private long longValue(Object value) {
        return ((Number) value).longValue();
    }

    private BigDecimal decimal(Object value) {
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        return new BigDecimal(String.valueOf(value));
    }

    private Instant instant(Object value) {
        if (value instanceof Instant instant) {
            return instant;
        }
        if (value instanceof OffsetDateTime dateTime) {
            return dateTime.toInstant();
        }
        return ((java.time.ZonedDateTime) value).toInstant();
    }
}
