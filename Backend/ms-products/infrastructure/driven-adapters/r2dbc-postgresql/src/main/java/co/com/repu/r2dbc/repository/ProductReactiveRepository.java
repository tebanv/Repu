package co.com.repu.r2dbc.repository;

import co.com.repu.r2dbc.entity.ProductEntity;
import org.springframework.data.repository.query.ReactiveQueryByExampleExecutor;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;

import java.util.UUID;

// TODO: This file is just an example, you should delete or modify it
public interface ProductReactiveRepository extends ReactiveCrudRepository<ProductEntity, UUID>, ReactiveQueryByExampleExecutor<Object> {

}
