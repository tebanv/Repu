package co.com.bancolombia.model.cart;

import co.com.bancolombia.model.itemcart.ItemCart;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record Cart(UUID id, UUID companyId, List<ItemCart> items, BigDecimal total, Instant lastAccess) {
    public Cart {
        items = List.copyOf(items);
    }
}
