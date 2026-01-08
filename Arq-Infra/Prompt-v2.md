# ACTÚA COMO: SENIOR CLOUD DATA ARCHITECT & DBA EXPERT

**CONTEXTO DEL PROYECTO:**
Estamos construyendo una plataforma "Multi-Tenant" de E-commerce y Servicios bajo demanda (Web y Móvil).
El sistema conecta:
1. **Compradores** (B2C).
2. **Empresas/Tiendas** (Proveedores de stock/servicios).
3. **Domiciliarios** (Logística tipo Uber).
4. **Analistas** (Inteligencia de negocios).
5. **Administradores** (Dueños de la plataforma).

**TU OBJETIVO:**
Generar un script SQL DDL robusto y profesional para **PostgreSQL**.

**REQUISITOS FUNCIONALES Y DE NEGOCIO:**
1.  **Modelo de Usuarios y Roles:** Soporte para múltiples roles (Comprador, Distribuidor, Domiciliario, Analista). Un usuario debe poder elegir su rol al registrarse.
2.  **Gestión de Empresas:** Las empresas gestionan su propio perfil (Logo, horarios, ubicación, contacto).
3.  **Catálogo Flexible (CRÍTICO):** Los productos (baterías, llantas, repuestos) tienen atributos muy variados.
    * *Instrucción Técnica:* Usa tipos de datos `JSONB` para almacenar las características dinámicas de cada producto.
4.  **Carrito y Órdenes:** Flujo completo de compra, persistencia del carrito, y conversión a Orden de Compra.
5.  **Logística y Tracking:** Trazabilidad en tiempo real.
    * Necesitamos almacenar coordenadas (latitud/longitud) de origen (tienda), destino (cliente) y ubicación actual del domiciliario.
6.  **Integraciones y Pagos:** Tablas para registrar transacciones de pasarelas (Wompi, MercadoPago), almacenando estados, tokens de transacción y auditoría.
7.  **Auditoría (Logs):** Un log transaccional inmutable que registre QUÉ hizo QUIÉN y CUÁNDO (tabla de auditoría global).

**REQUISITOS TÉCNICOS ESPECÍFICOS:**
* **IDs:** must be globally unique and traceable.
* **Idioma:** Nombres de tablas y campos en **ESPAÑOL** (snake_case). Comentarios en el código en español.
* **Integridad:** Define las relaciones lógicas (campos `id_usuario`, `id_empresa`), pero **NO generes los `CONSTRAINTS` de Foreign Key** (físicos) para facilitar la carga inicial de datos y pruebas, tal como se solicitó. Sí genera Primary Keys e Índices necesarios.
* **Campos de Auditoría:** Todas las tablas deben tener `fecha_creacion` y `fecha_actualizacion`.
* **Parametrización:** Incluye una tabla de configuración global (moneda, país, reglas de negocio).
* Include soft-delete support
* Support high-volume transactional data
* Support reporting and analytics

**ENTREGABLE:**
Un único bloque de código con el script SQL completo (`CREATE TABLE`, `CREATE INDEX`, etc.). No expliques el código, solo entrega el script.



# ACTÚA COMO: LEAD BACKEND ENGINEER & API SECURITY SPECIALIST

**CONTEXTO:**
Basado en el esquema de base de datos que acabas de diseñar, ahora necesito el contrato de interfaz para el desarrollo del Backend (Spring Boot) y el consumo desde el Frontend (React/Mobile).

**TU OBJETIVO:**
Generar un archivo **OpenAPI 3.0 (Swagger) en formato YAML**. Este contrato debe ser la "Verdad Única" para el equipo de desarrollo.

**REQUISITOS DE ARQUITECTURA:**
1.  **Seguridad:** Implementación de `Security Schemes` usando **Bearer Auth (JWT)**.
2.  **Estándares:**
    * Todo el código técnico (paths, schemas, descriptions) en **INGLÉS**.
    * Fechas en formato **ISO 8601**.
    * Respuestas HTTP estandarizadas (200, 201, 400, 401, 403, 404, 500).
    * Uso de Header `X-Request-ID` obligatorio en todos los endpoints para trazabilidad (tracing).
3.  **Controllers / Tags necesarios:**
    * `Auth`: Login, Register, Refresh Token.
    * `Users`: Gestión de perfiles y roles.
    * `Companies`: CRUD de empresas, gestión de horarios.
    * `Catalog`: Productos, categorías, búsqueda avanzada (filtros por campos JSON).
    * `Cart`: Agregar/Quitar ítems, vaciar carrito.
    * `Orders`: Creación, actualización de estados (Pendiente -> Pagado -> En camino -> Entregado).
    * `Payments`: Webhooks para recibir confirmación de Wompi/MercadoPago.
    * `Tracking`: Endpoint para actualizar ubicación del domiciliario (driver) y endpoint para consultar ubicación (cliente).
    * `Dashboard`: Endpoints agregados para reportes (KPIs de ventas, tiempos de entrega).

**INSTRUCCIONES DE FORMATO:**
* Sé exhaustivo con los esquemas de Petición (Request Body) y Respuesta (Response).
* Incluye ejemplos (example values) en los campos más complejos.
* Asegúrate de separar las operaciones por Roles (indica en la descripción qué rol puede consumir qué endpoint).

**ENTREGABLE:**
Únicamente el archivo YAML válido. No resumas, necesito el contrato completo.