package co.repu.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
public class SystemParamResponse {
    private UUID id;
    private String key;
    private Object configValue;
    private String description;
    private Boolean active;
    private LocalDateTime updatedAt;
}