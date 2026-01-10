package co.com.repu.r2dbc.mapper;

import co.com.repu.model.category.Category;
import co.com.repu.r2dbc.entity.CategoryEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class CategoryMapper {
    public Category toDomain(CategoryEntity entity) {
        if (entity == null) return null;

        return Category.builder()
                .id(entity.getId() != null ? entity.getId().toString() : null)
                .parentId(String.valueOf(entity.getParentId()))
                .name(entity.getName())
                .description(entity.getDescription())
                .iconUrl(entity.getIconUrl())
                .active(entity.getActive())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    public CategoryEntity toEntity(Category domain) {
        if (domain == null) return null;

        return CategoryEntity.builder()
                .id(domain.getId() != null ? UUID.fromString(domain.getId()) : null)
                .parentId(UUID.fromString(domain.getParentId()))
                .name(domain.getName())
                .description(domain.getDescription())
                .iconUrl(domain.getIconUrl())
                .active(domain.getActive())
                .createdAt(domain.getCreatedAt())
                .updatedAt(domain.getUpdatedAt())
                .build();
    }
}
