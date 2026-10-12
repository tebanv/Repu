# ==========================================
# ETAPA 1: Construcción (Build)
# ==========================================
FROM eclipse-temurin:23-jdk AS build

WORKDIR /home/gradle/project

# Instalar dependencias necesarias (wget y unzip para Gradle si no está incluido)
RUN apt-get update && apt-get install -y wget unzip && rm -rf /var/lib/apt/lists/*

# Descargar e instalar Gradle 8.14 manualmente
ARG GRADLE_VERSION=8.14.2
RUN wget -q https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip \
    && unzip -q gradle-${GRADLE_VERSION}-bin.zip \
    && mv gradle-${GRADLE_VERSION} /opt/gradle \
    && rm gradle-${GRADLE_VERSION}-bin.zip
ENV PATH="${PATH}:/opt/gradle/bin"

# Copiar archivos de configuración y código fuente
COPY build.gradle settings.gradle main.gradle gradle.properties lombok.config ./
COPY applications ./applications
COPY domain ./domain
COPY infrastructure ./infrastructure
COPY deployment ./deployment

# Compilar el proyecto
RUN gradle clean bootJar --no-daemon

# ==========================================
# ETAPA 2: Ejecución (Runtime)
# ==========================================
FROM eclipse-temurin:23-jre

WORKDIR /app

COPY --from=build /home/gradle/project/applications/app-service/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]