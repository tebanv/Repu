package co.com.repu.r2dbc.mapper;

import co.com.repu.model.product.Product;
import co.com.repu.r2dbc.entity.ProductEntity;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class ProductMapperTest {

    private final ProductMapper mapper = new ProductMapper(new ObjectMapper());
    private final UUID companyId = UUID.randomUUID();
    private final UUID categoryId = UUID.randomUUID();

    @Test
    void shouldPreserveAlphanumericSkuFromEntity() {
        ProductEntity entity = ProductEntity.builder()
                .companyId(companyId)
                .categoryId(categoryId)
                .brand("Bosch")
                .sku("BAT-MAC-42IST")
                .build();

        Product product = mapper.toDomain(entity);
        assertEquals("Bosch", product.getBrand());
        assertEquals("BAT-MAC-42IST", product.getSku());
    }

    @Test
    void shouldPreserveLeadingZeroesWhenMappingSkuToEntity() {
        Product product = Product.builder()
                .companyId(companyId.toString())
                .categoryId(categoryId.toString())
                .brand("Bosch")
                .sku("001234")
                .build();

        ProductEntity entity = mapper.toEntity(product);

        assertEquals("Bosch", entity.getBrand());
        assertEquals("001234", entity.getSku());
        Product mappedProduct = mapper.toDomain(entity);
        assertEquals("Bosch", mappedProduct.getBrand());
        assertEquals("001234", mappedProduct.getSku());
    }

    @Test
    void shouldPreserveNullSku() {
        ProductEntity entity = ProductEntity.builder()
                .companyId(companyId)
                .categoryId(categoryId)
                .build();

        assertNull(mapper.toDomain(entity).getSku());

        Product product = Product.builder()
                .companyId(companyId.toString())
                .categoryId(categoryId.toString())
                .build();

        assertNull(mapper.toEntity(product).getSku());
    }
}
