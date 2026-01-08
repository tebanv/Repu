package co.com.repu.companies.r2dbc.repository;

import org.springframework.data.repository.query.ReactiveQueryByExampleExecutor;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import co.com.repu.companies.r2dbc.entity.CompanyEntity;

// TODO: This file is just an example, you should delete or modify it
public interface CompanyReactiveRepository extends ReactiveCrudRepository<CompanyEntity, String>, ReactiveQueryByExampleExecutor<Object> {

}
