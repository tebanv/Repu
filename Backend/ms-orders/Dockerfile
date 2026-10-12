# ==========================================
# ETAPA 1: Construcción (Build)
# ==========================================
FROM gradle:8.14-jdk23-alpine AS build

WORKDIR /home/gradle/project

# Copiar archivos raíz de configuración de Gradle
COPY build.gradle settings.gradle main.gradle gradle.properties lombok.config ./

# Copiar los módulos de Clean Architecture
COPY applications ./applications
COPY domain ./domain
COPY infrastructure ./infrastructure
COPY deployment ./deployment

# Configurar permisos de usuario para Gradle
USER root
RUN chown -R gradle:gradle /home/gradle/project
USER gradle

# Construir el ejecutable bootJar sin daemon
RUN gradle clean bootJar --no-daemon

# ==========================================
# ETAPA 2: Ejecución (Runtime)
# ==========================================
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Copiar el JAR generado desde la etapa de compilación
COPY --from=build /home/gradle/project/applications/app-service/build/libs/*.jar app.jar

# El puerto interno será mapeado según corresponda en el docker-compose-apps.yaml
EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]