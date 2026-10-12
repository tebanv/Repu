# ==========================================
# ETAPA 1: Construcción (Build)
# ==========================================
FROM gradle:8.14-jdk23 AS build

WORKDIR /home/gradle/project

COPY build.gradle settings.gradle main.gradle gradle.properties lombok.config ./
COPY applications ./applications
COPY domain ./domain
COPY infrastructure ./infrastructure
COPY deployment ./deployment

USER root
RUN chown -R gradle:gradle /home/gradle/project
USER gradle

RUN gradle clean bootJar --no-daemon

# ==========================================
# ETAPA 2: Ejecución (Runtime)
# ==========================================
FROM eclipse-temurin:23-jre

WORKDIR /app

COPY --from=build /home/gradle/project/applications/app-service/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]