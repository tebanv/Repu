package co.repu.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.regex.Pattern;

@Component
public class SessionCookieSettings {

    private static final Pattern COOKIE_NAME = Pattern.compile("[!#$%&'*+.^_`|~0-9A-Za-z-]+");

    private final String name;
    private final boolean secure;

    public SessionCookieSettings(
            @Value("${security.session-cookie.name:__Host-repu_session}") String name,
            @Value("${security.session-cookie.secure:true}") boolean secure,
            @Value("${security.session-cookie.allow-insecure-http:false}") boolean allowInsecureHttp,
            @Value("${spring.profiles.active:}") String activeProfiles) {
        if (name == null || !COOKIE_NAME.matcher(name).matches()) {
            throw new IllegalArgumentException("Invalid session cookie name");
        }
        if (!secure && !allowInsecureHttp) {
            throw new IllegalStateException(
                    "Insecure session cookies require security.session-cookie.allow-insecure-http=true");
        }
        if (!secure && !isLocalProfile(activeProfiles)) {
            throw new IllegalStateException("Insecure session cookies are only allowed in local or dev profiles");
        }
        if (!secure && name.startsWith("__Host-")) {
            throw new IllegalStateException("__Host- cookies require Secure and HTTPS");
        }
        this.name = name;
        this.secure = secure;
    }

    private static boolean isLocalProfile(String activeProfiles) {
        return activeProfiles != null && !activeProfiles.isBlank()
                && Arrays.stream(activeProfiles.split(","))
                .map(String::trim)
                .allMatch(profile -> profile.equals("local") || profile.equals("dev"));
    }

    public String name() {
        return name;
    }

    public boolean secure() {
        return secure;
    }
}
