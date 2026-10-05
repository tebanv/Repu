package co.com.bancolombia.r2dbc;

import co.com.bancolombia.model.itemcart.ItemCart;
import co.com.bancolombia.model.itemorder.ItemOrder;
import co.com.bancolombia.model.order.DeliveryStatus;
import co.com.bancolombia.model.order.LocationSnapshot;
import co.com.bancolombia.model.order.MerchantStatus;
import co.com.bancolombia.model.order.Order;
import co.com.bancolombia.model.order.OrderStatus;
import co.com.bancolombia.model.order.PaymentStatus;
import io.r2dbc.postgresql.codec.Json;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class OrderPersistenceMapper {
    private final ObjectMapper jsonMapper;

    public OrderPersistenceMapper(ObjectMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    public ItemCart cartItem(Map<String, Object> row) {
        BigDecimal price = decimal(row.get("precio_actual"));
        int quantity = integer(row.get("cantidad"));
        return new ItemCart(uuid(row.get("id_item_carrito")), uuid(row.get("id_producto")),
                text(row.get("nombre")), textOrNull(row.get("sku_referencia")), price, quantity,
                price.multiply(BigDecimal.valueOf(quantity)), jsonObject(row.get("datos_seleccionados")));
    }

    public Order order(Map<String, Object> row) {
        return new Order(uuid(row.get("id_orden")), longValue(row.get("numero_orden_legible")),
                uuid(row.get("id_usuario_comprador")), uuid(row.get("id_empresa")), integer(row.get("version")),
                OrderStatus.valueOf(text(row.get("estado_orden"))), PaymentStatus.valueOf(text(row.get("estado_pago"))),
                MerchantStatus.valueOf(text(row.get("estado_comercio"))), DeliveryStatus.valueOf(text(row.get("estado_envio"))),
                decimal(row.get("subtotal")), decimal(row.get("costo_envio")), decimal(row.get("descuentos")),
                decimal(row.get("impuestos")), decimal(row.get("costo_servicio")), decimal(row.get("total_final")),
                jsonObject(row.get("direccion_entrega_snapshot")), textOrNull(row.get("notas_cliente")),
                instant(row.get("fecha_creacion")), orderItems(row.get("items_json")));
    }

    public LocationSnapshot location(Map<String, Object> row) {
        return new LocationSnapshot(nullableUuid(row.get("id_usuario_domiciliario")),
                doubleValue(row.get("latitude")), doubleValue(row.get("longitude")),
                nullableDouble(row.get("velocidad_detectada")), nullableDouble(row.get("rumbo_grados")),
                null, instant(row.get("fecha_actualizacion")));
    }

    public Json json(Object value) {
        try {
            return Json.of(jsonMapper.writeValueAsString(value));
        } catch (tools.jackson.core.JacksonException exception) {
            throw new IllegalArgumentException("Could not encode JSONB value.", exception);
        }
    }

    public Map<String, Object> jsonObject(Object value) {
        try {
            return jsonMapper.readValue(jsonString(value), new TypeReference<>() { });
        } catch (tools.jackson.core.JacksonException exception) {
            throw new IllegalStateException("Could not decode JSONB object.", exception);
        }
    }

    private List<ItemOrder> orderItems(Object value) {
        try {
            List<Map<String, Object>> rows = jsonMapper.readValue(jsonString(value), new TypeReference<>() { });
            return rows.stream().map(item -> new ItemOrder(uuid(item.get("id")), uuid(item.get("productId")),
                    text(item.get("name")), textOrNull(item.get("sku")), integer(item.get("quantity")),
                    decimal(item.get("unitPrice")), decimal(item.get("lineTotal")),
                    asMap(item.get("characteristics")), asMap(item.get("selectedOptions")))).toList();
        } catch (tools.jackson.core.JacksonException exception) {
            throw new IllegalStateException("Could not decode order item snapshots.", exception);
        }
    }

    private String jsonString(Object value) {
        if (value instanceof Json json) {
            return json.asString();
        }
        if (value instanceof String json) {
            return json;
        }
        return value == null ? "{}" : value.toString();
    }

    private Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> map) {
            var result = new LinkedHashMap<String, Object>();
            map.forEach((key, item) -> result.put(String.valueOf(key), item));
            return result;
        }
        return Map.of();
    }

    private UUID uuid(Object value) {
        return value instanceof UUID id ? id : UUID.fromString(text(value));
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
        return value instanceof BigDecimal amount ? amount : new BigDecimal(String.valueOf(value));
    }

    private double doubleValue(Object value) {
        return ((Number) value).doubleValue();
    }

    private Double nullableDouble(Object value) {
        return value == null ? null : doubleValue(value);
    }

    private Instant instant(Object value) {
        if (value instanceof Instant instant) {
            return instant;
        }
        if (value instanceof OffsetDateTime dateTime) {
            return dateTime.toInstant();
        }
        return ((ZonedDateTime) value).toInstant();
    }
}
