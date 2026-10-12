# ETAPA 1: Construcción (Build)
FROM gradle:8.5-jdk17-alpine AS build

WORKDIR /home/gradle/project

# 1. Copiamos los archivos de configuración de Gradle de la raíz
COPY build.gradle settings.gradle main.gradle gradle.properties lombok.config ./

# 2. Copiamos los MÓDULOS de la Clean Architecture
COPY applications ./applications
COPY domain ./domain
COPY infrastructure ./infrastructure
COPY deployment ./deployment

# Ajuste de permisos
USER root
RUN chown -R gradle:gradle /home/gradle/project
USER gradle

# 3. Construimos el proyecto
RUN gradle clean bootJar --no-daemon

# ETAPA 2: Ejecución (Runtime)
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# 4. Ubicación del JAR
COPY --from=build /home/gradle/project/applications/app-service/build/libs/*.jar app.jar

# Puerto
EXPOSE 8084

# Entrypoint
ENTRYPOINT ["java", "-jar", "app.jar"]