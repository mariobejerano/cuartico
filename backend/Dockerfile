# syntax=docker/dockerfile:1

# ---- Etapa 1: compilar con el Maven Wrapper ----
FROM eclipse-temurin:17-jdk AS build
WORKDIR /workspace

# Primero solo lo necesario para descargar dependencias: esta capa se cachea
# mientras el pom.xml no cambie.
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline

COPY src/ src/
# Los tests ya corren en el CI; aquí solo empaquetamos.
RUN ./mvnw -B -q package -DskipTests \
    && java -Djarmode=tools -jar target/backend-*.jar extract --layers --launcher --destination target/extracted

# ---- Etapa 2: imagen final, solo JRE ----
FROM eclipse-temurin:17-jre
WORKDIR /app

# No ejecutar como root
RUN groupadd --system app && useradd --system --gid app --no-create-home app

# Capas de Spring Boot de la menos a la más cambiante (mejor caché entre despliegues)
COPY --from=build /workspace/target/extracted/dependencies/ ./
COPY --from=build /workspace/target/extracted/spring-boot-loader/ ./
COPY --from=build /workspace/target/extracted/snapshot-dependencies/ ./
COPY --from=build /workspace/target/extracted/application/ ./

USER app

# Render inyecta PORT; en local se usa 8080 (ver server.port en application.yml)
EXPOSE 8080

# Plan gratuito de Render: 512 MB. La JVM usa como máximo el 75% de la memoria del contenedor.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+UseSerialGC -XX:TieredStopAtLevel=1" \
    SPRING_PROFILES_ACTIVE=prod

ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
