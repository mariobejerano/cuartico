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
# Los tests ya corren en el CI; aquí solo empaquetamos (sin compilar siquiera los tests).
RUN ./mvnw -B -q package -Dmaven.test.skip=true \
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

# Plan gratuito de Render: 512 MB en total. Topes (no consumo real; con C1 el code cache y el metaspace
# usan bastante menos). Medir en staging antes de producción. Reparto:
#   heap ≤ 60% (~300 MB) + metaspace ≤ 128 MB + code cache ≤ 64 MB + pilas de hilos (512 KB c/u, ≤ 50 hilos Tomcat en prod).
# - SerialGC: el más ligero; la JVM ya lo elige con menos de 2 CPU.
# - TieredStopAtLevel=1: arranca más rápido (importa porque el plan gratuito "duerme" el servicio),
#   a cambio de menos rendimiento sostenido. Decisión consciente; revisar si se pasa a un plan de pago.
# - ExitOnOutOfMemoryError: ante un OOM el proceso termina y Render lo reinicia, en vez de quedar vivo pero roto.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60 -XX:MaxMetaspaceSize=128m -XX:ReservedCodeCacheSize=64m -Xss512k -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:+ExitOnOutOfMemoryError" \
    SPRING_PROFILES_ACTIVE=prod

ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
