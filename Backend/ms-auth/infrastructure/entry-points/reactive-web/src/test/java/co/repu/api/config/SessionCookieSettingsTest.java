package co.repu.api.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SessionCookieSettingsTest {

    @Test
    void secureHostCookieIsTheDefault() {
        SessionCookieSettings settings =
                new SessionCookieSettings("__Host-repu_session", true, false, "prod");

        assertEquals("__Host-repu_session", settings.name());
        assertTrue(settings.secure());
    }

    @Test
    void insecureCookieRequiresExplicitLocalConfiguration() {
        SessionCookieSettings settings =
                new SessionCookieSettings("repu_session_dev", false, true, "local");

        assertEquals("repu_session_dev", settings.name());
        assertFalse(settings.secure());
    }

    @Test
    void rejectsInsecureCookieOutsideLocalProfiles() {
        assertThrows(IllegalStateException.class, () ->
                new SessionCookieSettings("repu_session_dev", false, true, "local,prod"));
    }

    @Test
    void rejectsHostPrefixWithoutSecure() {
        assertThrows(IllegalStateException.class, () ->
                new SessionCookieSettings("__Host-repu_session", false, true, "local"));
    }
}
