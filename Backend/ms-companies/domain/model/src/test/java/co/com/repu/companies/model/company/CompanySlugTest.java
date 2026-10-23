package co.com.repu.companies.model.company;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class CompanySlugTest {

    @Test
    void normalizesAccentsAndSeparators() {
        assertEquals("baterias-del-valle", CompanySlug.normalize("  Baterías / del Valle  "));
    }

    @Test
    void rejectsValuesThatCannotProduceASlug() {
        assertThrows(IllegalArgumentException.class, () -> CompanySlug.normalize("!!!"));
    }

    @Test
    void generatedSlugIsBoundedAndIncludesCompanyIdSuffix() {
        UUID id = UUID.fromString("01a166a0-f741-7722-91fa-adc6e3b8ca08");

        String slug = CompanySlug.generate("A".repeat(200), id);

        assertEquals(CompanySlug.MAX_LENGTH, slug.length());
        assertEquals("01a166a0", slug.substring(slug.length() - 8));
    }
}
