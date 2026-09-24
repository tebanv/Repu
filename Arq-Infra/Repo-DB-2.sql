-- ======================================================================================
-- PLATAFORMA MULTI-TENANT E-COMMERCE & LOGÍSTICA ON-DEMAND (REPU)
-- SCRIPT DDL DEFINITIVO POSTGRESQL 15+
-- ======================================================================================

-- 1. EXTENSIONES Y ESQUEMA
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "postgis" SCHEMA public;

SELECT PostGIS_Full_Version();

CREATE SCHEMA IF NOT EXISTS repu;
ALTER ROLE repu SET search_path TO repu, public;

-- Función de actualización automática de timestamp la fecha de modificación
CREATE OR REPLACE FUNCTION actualizar_timestamp_modificacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ======================================================================================
-- 2. TABLAS BASE Y MAESTRAS
-- ======================================================================================

CREATE TABLE parametros_sistema (
    id_parametro UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_clave VARCHAR(50) NOT NULL UNIQUE, -- Ej: 'MONEDA_DEFECTO', 'PAIS_OPERACION'
    valor_configuracion JSONB NOT NULL, -- Permite guardar strings, objetos o arrays de configuraciones
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE usuarios (
    id_usuario UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correo_electronico VARCHAR(150) NOT NULL,
    hash_contrasena VARCHAR(255) NOT NULL,
    rol_sistema VARCHAR(50) NOT NULL, -- Roles permitidos: 'COMPRADOR', 'DISTRIBUIDOR', 'DOMICILIARIO', 'ANALISTA', 'ADMIN'
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    telefono_movil VARCHAR(20),
    atributos_perfil JSONB DEFAULT '{}' NOT NULL, -- Datos específicos del rol (Licencia de conducción, foto perfil, preferencias)
    ultimo_login TIMESTAMPTZ,
    activo BOOLEAN DEFAULT TRUE NOT NULL, -- Soft Delete
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_usuarios_rol CHECK (rol_sistema IN ('COMPRADOR', 'DISTRIBUIDOR', 'DOMICILIARIO', 'ANALISTA', 'ADMIN'))
);

CREATE TABLE sesiones_usuario (
    id_sesion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID NOT NULL,
    token_sesion_hash VARCHAR(64) NOT NULL UNIQUE,
    id_empresa_activa UUID,
    direccion_ip VARCHAR(45),
    agente_usuario TEXT,
    dispositivo_info VARCHAR(100),
    esta_activa BOOLEAN DEFAULT TRUE NOT NULL,
    expira_en TIMESTAMPTZ NOT NULL,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ultimo_acceso TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ======================================================================================
-- RECUPERACIÓN Y CAMBIO SEGURO DE CONTRASEÑA
-- ======================================================================================

CREATE TABLE IF NOT EXISTS repu.tokens_recuperacion_contrasena (
    id_token UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    id_usuario UUID NOT NULL,

    -- Nunca almacenar el código enviado por correo en texto plano.
    codigo_hash VARCHAR(64) NOT NULL,

    -- Tiempo máximo de validez del código.
    expira_en TIMESTAMPTZ NOT NULL,

    -- Control de intentos para evitar ataques de fuerza bruta.
    intentos_fallidos INTEGER DEFAULT 0 NOT NULL,
    max_intentos INTEGER DEFAULT 5 NOT NULL,

    -- El código solamente puede utilizarse una vez.
    usado BOOLEAN DEFAULT FALSE NOT NULL,
    usado_en TIMESTAMPTZ,

    -- Datos útiles para auditoría y control antifraude.
    direccion_ip VARCHAR(45),
    agente_usuario TEXT,

    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_tokens_recuperacion_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES repu.usuarios(id_usuario)
        ON DELETE CASCADE,

    CONSTRAINT chk_tokens_intentos_fallidos
        CHECK (intentos_fallidos >= 0),

    CONSTRAINT chk_tokens_max_intentos
        CHECK (max_intentos > 0),

    CONSTRAINT chk_tokens_usado_fecha
        CHECK (
            (usado = FALSE AND usado_en IS NULL)
            OR
            (usado = TRUE AND usado_en IS NOT NULL)
        )
);

CREATE TABLE direcciones_usuario (
    id_direccion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID NOT NULL,
    nombre_direccion VARCHAR(100) NOT NULL,
    direccion_completa TEXT NOT NULL,
    ciudad VARCHAR(100) NOT NULL,
    codigo_postal VARCHAR(20),
    es_principal BOOLEAN DEFAULT FALSE NOT NULL,
    ubicacion GEOGRAPHY(Point, 4326) NOT NULL,
    notas_entrega TEXT,
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE empresas (
    id_empresa UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario_propietario UUID NOT NULL, -- Relación lógica con usuarios
    razon_social VARCHAR(200) NOT NULL,
    nit_identificacion VARCHAR(50) NOT NULL UNIQUE,
    logo_url TEXT,
    descripcion_tienda TEXT,
    configuracion_operativa JSONB DEFAULT '{}' NOT NULL, -- Configuración específica: Horarios de atención, políticas de envío, colores de marca
    direccion_fisica TEXT NOT NULL,
    ubicacion GEOGRAPHY(Point, 4326) NOT NULL, -- Geolocalización de la bodega/tienda física
    calificacion_promedio NUMERIC(3, 2) DEFAULT 0.00 NOT NULL,
    total_resenas INTEGER DEFAULT 0 NOT NULL,
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_empresas_calificacion CHECK (calificacion_promedio BETWEEN 0 AND 5)
);

CREATE TABLE categorias (
    id_categoria UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_categoria_padre UUID, -- Para jerarquías (Árbol de categorías)
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    icono_url TEXT,
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE productos (
    id_producto UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empresa UUID NOT NULL, -- Multi-tenant: El producto pertenece a una empresa
    id_categoria UUID NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    sku_referencia VARCHAR(100),
    descripcion_corta TEXT,
    precio_base NUMERIC(15, 2) NOT NULL,
    precio_oferta NUMERIC(15, 2),
    inventario_disponible INTEGER DEFAULT 0 NOT NULL,
    inventario_reservado INTEGER DEFAULT 0 NOT NULL,
    -- CRÍTICO: Aquí se guardan atributos variados (Baterías: Voltaje, Llantas: Rin, etc.)
    -- Ej: {"voltaje": "12V", "amperaje": 600, "rin": 16, "marca_vehiculo": ["Mazda", "Toyota"]}
    caracteristicas_tecnicas JSONB DEFAULT '{}' NOT NULL,
    imagenes_urls JSONB DEFAULT '[]' NOT NULL, -- Array de URLs
    calificacion_promedio NUMERIC(3, 2) DEFAULT 0.00 NOT NULL,
    total_resenas INTEGER DEFAULT 0 NOT NULL,
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_productos_precio CHECK (precio_base >= 0),
    CONSTRAINT chk_productos_inventario CHECK (inventario_disponible >= 0 AND inventario_reservado >= 0)
);

-- ======================================================================================
-- 3. MÓDULO DE CARRITO Y TRANSACCIONES DE COMPRA
-- ======================================================================================

CREATE TABLE carritos_compras (
    id_carrito UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID NOT NULL, -- Relación lógica con usuario comprador
    id_empresa UUID NOT NULL, -- Relación lógica con empresa vendedora
    estado VARCHAR(20) DEFAULT 'ACTIVO' NOT NULL,  -- ACTIVO, ABANDONADO, CONVERTIDO
    fecha_ultimo_acceso TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_carrito_estado CHECK (estado IN ('ACTIVO', 'ABANDONADO', 'CONVERTIDO'))
);

CREATE TABLE items_carrito (
    id_item_carrito UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_carrito UUID NOT NULL,
    id_producto UUID NOT NULL,
    cantidad INTEGER DEFAULT 1 NOT NULL,
    datos_seleccionados JSONB DEFAULT '{}' NOT NULL,  -- Por si el usuario seleccionó una variante específica
    fecha_agregado TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_item_cantidad CHECK (cantidad > 0)
);

CREATE TABLE ordenes (
    id_orden UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_orden_legible BIGSERIAL NOT NULL, -- Para visualización humana (Ej: Orden #1054)
    id_usuario_comprador UUID NOT NULL,
    id_empresa UUID NOT NULL, -- Orden se separa por empresa para facilitar despacho
    version INTEGER DEFAULT 0 NOT NULL,
    estado_orden VARCHAR(30) DEFAULT 'CREADA' NOT NULL, -- Estados: 'PENDIENTE_PAGO', 'PAGADA', 'CONFIRMADA_TIENDA', 'PREPARACION', 'EN_CAMINO', 'ENTREGADA', 'CANCELADA'
    estado_pago VARCHAR(30) DEFAULT 'PENDIENTE' NOT NULL,
    estado_comercio VARCHAR(30) DEFAULT 'PENDIENTE_CONFIRMACION' NOT NULL,
    estado_envio VARCHAR(30) DEFAULT 'NO_ASIGNADO' NOT NULL,
    subtotal N  UMERIC(15, 2) NOT NULL,
    costo_envio NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    descuentos NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    impuestos NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    total_final NUMERIC(15, 2) NOT NULL,
    direccion_entrega_snapshot JSONB NOT NULL,  -- Datos Snapshot: Dirección en el momento de la compra
    notas_cliente TEXT,
    fecha_limite_confirmacion TIMESTAMPTZ,
    motivo_rechazo_comercio TEXT,
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_orden_macro_estado CHECK (estado_orden IN ('CREADA', 'CONFIRMADA', 'EN_PROCESO', 'EN_CAMINO', 'COMPLETADA', 'CANCELADA')),
    CONSTRAINT chk_orden_pago_estado CHECK (estado_pago IN ('PENDIENTE', 'AUTORIZADO', 'PAGADO', 'RECHAZADO', 'REEMBOLSADO')),
    CONSTRAINT chk_orden_comercio_estado CHECK (estado_comercio IN ('PENDIENTE_CONFIRMACION', 'ACEPTADO', 'EN_PREPARACION', 'LISTO_PARA_RECOGIDA', 'RECHAZADO')),
    CONSTRAINT chk_orden_envio_estado CHECK (estado_envio IN ('NO_ASIGNADO', 'ASIGNANDO', 'ASIGNADO', 'EN_TIENDA', 'RECOGIDO', 'EN_RUTA', 'ENTREGADO', 'FALLIDO'))
);

CREATE TABLE detalles_orden (
    id_detalle UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_orden UUID NOT NULL,
    id_producto UUID NOT NULL,
    nombre_producto_snapshot VARCHAR(200) NOT NULL,
    sku_snapshot VARCHAR(100),
    cantidad INTEGER NOT NULL,
    precio_unitario_snapshot NUMERIC(15, 2) NOT NULL,
    total_linea NUMERIC(15, 2) NOT NULL,
    caracteristicas_snapshot JSONB DEFAULT '{}' NOT NULL,
    CONSTRAINT chk_detalle_cantidad CHECK (cantidad > 0)
);

CREATE TABLE historial_estados_orden (
    id_historial BIGSERIAL PRIMARY KEY,
    id_orden UUID NOT NULL,
    dominio_estado VARCHAR(20) NOT NULL,
    estado_anterior VARCHAR(30),
    estado_nuevo VARCHAR(30) NOT NULL,
    id_usuario_actor UUID,
    tipo_actor VARCHAR(20) NOT NULL,
    motivo TEXT,
    fecha_cambio TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_historial_dominio CHECK (dominio_estado IN ('ORDEN', 'PAGO', 'COMERCIO', 'ENVIO')),
    CONSTRAINT chk_historial_actor CHECK (tipo_actor IN ('SISTEMA', 'COMERCIO', 'DOMICILIARIO', 'CLIENTE', 'ADMIN'))
);

-- ======================================================================================
-- 4. MÓDULO DE PAGOS Y REEMBOLSOS
-- ======================================================================================

CREATE TABLE intentos_pago (
    id_intento_pago UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_orden UUID NOT NULL,
    clave_idempotencia VARCHAR(100) NOT NULL UNIQUE,
    pasarela VARCHAR(50) NOT NULL,
    referencia_transaccion_pasarela VARCHAR(100) UNIQUE,
    monto NUMERIC(15, 2) NOT NULL,
    moneda VARCHAR(3) DEFAULT 'COP' NOT NULL,
    estado VARCHAR(30) DEFAULT 'INICIADO' NOT NULL,
    metodo_pago_utilizado VARCHAR(50),
    firma_integridad VARCHAR(255),
    payload_webhook_recibido JSONB,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_finalizacion TIMESTAMPTZ,
    CONSTRAINT chk_intento_estado CHECK (estado IN ('INICIADO', 'EN_PROCESO', 'APROBADO', 'RECHAZADO', 'REVERSADO'))
);

CREATE TABLE reembolsos (
    id_reembolso UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_intento_pago UUID NOT NULL,
    id_orden UUID NOT NULL,
    monto_reembolsado NUMERIC(15, 2) NOT NULL,
    motivo VARCHAR(200) NOT NULL,
    referencia_externa_reembolso VARCHAR(100),
    estado VARCHAR(30) DEFAULT 'PENDIENTE' NOT NULL,
    respuesta_pasarela JSONB,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_reembolso_monto CHECK (monto_reembolsado > 0),
    CONSTRAINT chk_reembolso_estado CHECK (estado IN ('PENDIENTE', 'COMPLETADO', 'FALLIDO'))
);

-- ======================================================================================
-- 5. MÓDULO LOGÍSTICO Y TELEMETRÍA (CON PARTICIONAMIENTO)
-- ======================================================================================

CREATE TABLE envios (
    id_envio UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_orden UUID NOT NULL UNIQUE,
    id_usuario_domiciliario UUID,
    estado_envio VARCHAR(30) DEFAULT 'NO_ASIGNADO' NOT NULL,
    pin_recogida VARCHAR(6),
    codigo_verificacion_entrega VARCHAR(10),
    ubicacion_origen GEOGRAPHY(Point, 4326) NOT NULL,
    ubicacion_destino GEOGRAPHY(Point, 4326) NOT NULL,
    ubicacion_recogida_real GEOGRAPHY(Point, 4326),
    ubicacion_entrega_real GEOGRAPHY(Point, 4326),
    fecha_asignacion TIMESTAMPTZ,
    fecha_llegada_comercio TIMESTAMPTZ,
    fecha_recogida TIMESTAMPTZ,
    fecha_inicio_ruta TIMESTAMPTZ,
    fecha_entrega TIMESTAMPTZ,
    foto_evidencia_url TEXT,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_envios_estado CHECK (estado_envio IN ('NO_ASIGNADO', 'ASIGNANDO', 'ASIGNADO', 'EN_TIENDA', 'RECOGIDO', 'EN_RUTA', 'ENTREGADO', 'FALLIDO'))
);

CREATE TABLE historial_ubicacion_envio (
    id_rastreo BIGINT GENERATED ALWAYS AS IDENTITY,
    id_envio UUID NOT NULL,
    ubicacion_actual GEOGRAPHY(Point, 4326) NOT NULL,
    velocidad_detectada NUMERIC(5, 2),
    rumbo_grados NUMERIC(5, 2),
    bateria_dispositivo INTEGER,
    fecha_registro TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (id_rastreo, fecha_registro)
) PARTITION BY RANGE (fecha_registro);

-- Particiones iniciales mensuales de telemetría
CREATE TABLE historial_ubicacion_envio_2026_09 PARTITION OF historial_ubicacion_envio
    FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');

CREATE TABLE historial_ubicacion_envio_2026_10 PARTITION OF historial_ubicacion_envio
    FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');

CREATE TABLE historial_ubicacion_envio_default PARTITION OF historial_ubicacion_envio DEFAULT;

-- ======================================================================================
-- 6. MÓDULO DE FEEDBACK, PQRS Y DISPUTAS
-- ======================================================================================

CREATE TABLE resenas (
    id_resena UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_orden UUID NOT NULL,
    id_usuario_autor UUID NOT NULL,
    tipo_objetivo VARCHAR(20) NOT NULL,
    id_objetivo UUID NOT NULL,
    calificacion SMALLINT NOT NULL,
    comentario TEXT,
    imagenes_urls JSONB DEFAULT '[]' NOT NULL,
    respuesta_comercio TEXT,
    fecha_respuesta TIMESTAMPTZ,
    estado_moderacion VARCHAR(20) DEFAULT 'APROBADA' NOT NULL,
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_resena_objetivo CHECK (tipo_objetivo IN ('PRODUCTO', 'EMPRESA', 'DOMICILIARIO')),
    CONSTRAINT chk_resena_calificacion CHECK (calificacion BETWEEN 1 AND 5),
    CONSTRAINT chk_resena_moderacion CHECK (estado_moderacion IN ('APROBADA', 'EN_REVISION', 'OCULTA'))
);

CREATE TABLE tickets_disputas (
    id_ticket UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_ticket BIGSERIAL NOT NULL UNIQUE,
    id_usuario_reclamante UUID NOT NULL,
    id_empresa UUID,
    id_orden UUID,
    id_detalle_orden UUID,
    tipo_tramite VARCHAR(30) NOT NULL,
    estado_ticket VARCHAR(30) DEFAULT 'ABIERTO' NOT NULL,
    prioridad VARCHAR(20) DEFAULT 'MEDIA' NOT NULL,
    asunto VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    monto_reclamado NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    resolucion_final TEXT,
    fecha_limite_sla TIMESTAMPTZ,
    fecha_cierre TIMESTAMPTZ,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_ticket_tramite CHECK (tipo_tramite IN ('CONSULTA', 'PQR', 'GARANTIA', 'DEVOLUCION')),
    CONSTRAINT chk_ticket_estado CHECK (estado_ticket IN ('ABIERTO', 'EN_INVESTIGACION', 'ESPERANDO_EVIDENCIA', 'APROBADO', 'RECHAZADO', 'CERRADO')),
    CONSTRAINT chk_ticket_prioridad CHECK (prioridad IN ('BAJA', 'MEDIA', 'ALTA', 'CRITICA'))
);

CREATE TABLE mensajes_ticket (
    id_mensaje UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_ticket UUID NOT NULL,
    id_usuario_emisor UUID NOT NULL,
    mensaje TEXT NOT NULL,
    archivos_adjuntos JSONB DEFAULT '[]' NOT NULL,
    es_nota_interna BOOLEAN DEFAULT FALSE NOT NULL,
    fecha_envio TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ======================================================================================
-- 7. AUDITORÍA DEL SISTEMA
-- ======================================================================================

CREATE TABLE auditoria_global (
    id_auditoria BIGSERIAL PRIMARY KEY,
    nombre_tabla_afectada VARCHAR(100) NOT NULL,
    id_registro_afectado UUID,
    accion_realizada VARCHAR(20) NOT NULL,
    id_usuario_actor UUID,
    direccion_ip VARCHAR(45),
    user_agent TEXT,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    fecha_evento TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ======================================================================================
-- 8. TRIGGERS DE MODIFICACIÓN DE TIEMPO
-- ======================================================================================

CREATE TRIGGER trg_parametros_modtime BEFORE UPDATE ON parametros_sistema FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();
CREATE TRIGGER trg_usuarios_modtime BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();
CREATE TRIGGER trg_empresas_modtime BEFORE UPDATE ON empresas FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();
CREATE TRIGGER trg_direcciones_modtime BEFORE UPDATE ON direcciones_usuario FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();
CREATE TRIGGER trg_categorias_modtime BEFORE UPDATE ON categorias FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();
CREATE TRIGGER trg_productos_modtime BEFORE UPDATE ON productos FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();
CREATE TRIGGER trg_ordenes_modtime BEFORE UPDATE ON ordenes FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();
CREATE TRIGGER trg_intentos_pago_modtime BEFORE UPDATE ON intentos_pago FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();
CREATE TRIGGER trg_reembolsos_modtime BEFORE UPDATE ON reembolsos FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();
CREATE TRIGGER trg_envios_modtime BEFORE UPDATE ON envios FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();
CREATE TRIGGER trg_resenas_modtime BEFORE UPDATE ON resenas FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();
CREATE TRIGGER trg_tickets_modtime BEFORE UPDATE ON tickets_disputas FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();

-- Actualización automática de fecha_actualizacion.
DROP TRIGGER IF EXISTS trg_tokens_recuperacion_modtime
ON repu.tokens_recuperacion_contrasena;

CREATE TRIGGER trg_tokens_recuperacion_modtime
BEFORE UPDATE ON repu.tokens_recuperacion_contrasena
FOR EACH ROW
EXECUTE FUNCTION repu.actualizar_timestamp_modificacion();


-- ======================================================================================
-- 9. CLAVES FORÁNEAS (INTEGRIDAD REFERENCIAL FÍSICA)
-- ======================================================================================

ALTER TABLE sesiones_usuario
    ADD CONSTRAINT fk_sesiones_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    ADD CONSTRAINT fk_sesiones_empresa FOREIGN KEY (id_empresa_activa) REFERENCES empresas(id_empresa) ON DELETE SET NULL;

ALTER TABLE empresas
    ADD CONSTRAINT fk_empresas_propietario FOREIGN KEY (id_usuario_propietario) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT;

ALTER TABLE direcciones_usuario
    ADD CONSTRAINT fk_direcciones_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE;

ALTER TABLE categorias
    ADD CONSTRAINT fk_categorias_padre FOREIGN KEY (id_categoria_padre) REFERENCES categorias(id_categoria) ON DELETE SET NULL;

ALTER TABLE productos
    ADD CONSTRAINT fk_productos_empresa FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_productos_categoria FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria) ON DELETE RESTRICT;

ALTER TABLE carritos_compras
    ADD CONSTRAINT fk_carritos_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    ADD CONSTRAINT fk_carritos_empresa FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa) ON DELETE RESTRICT;

ALTER TABLE items_carrito
    ADD CONSTRAINT fk_items_carrito_carrito FOREIGN KEY (id_carrito) REFERENCES carritos_compras(id_carrito) ON DELETE CASCADE,
    ADD CONSTRAINT fk_items_carrito_producto FOREIGN KEY (id_producto) REFERENCES productos(id_producto) ON DELETE RESTRICT;

ALTER TABLE ordenes
    ADD CONSTRAINT fk_ordenes_comprador FOREIGN KEY (id_usuario_comprador) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_ordenes_empresa FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa) ON DELETE RESTRICT;

ALTER TABLE detalles_orden
    ADD CONSTRAINT fk_detalles_orden_orden FOREIGN KEY (id_orden) REFERENCES ordenes(id_orden) ON DELETE CASCADE,
    ADD CONSTRAINT fk_detalles_orden_producto FOREIGN KEY (id_producto) REFERENCES productos(id_producto) ON DELETE RESTRICT;

ALTER TABLE historial_estados_orden
    ADD CONSTRAINT fk_historial_estados_orden FOREIGN KEY (id_orden) REFERENCES ordenes(id_orden) ON DELETE CASCADE,
    ADD CONSTRAINT fk_historial_estados_usuario FOREIGN KEY (id_usuario_actor) REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

ALTER TABLE intentos_pago
    ADD CONSTRAINT fk_intentos_pago_orden FOREIGN KEY (id_orden) REFERENCES ordenes(id_orden) ON DELETE RESTRICT;

ALTER TABLE reembolsos
    ADD CONSTRAINT fk_reembolsos_intento FOREIGN KEY (id_intento_pago) REFERENCES intentos_pago(id_intento_pago) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_reembolsos_orden FOREIGN KEY (id_orden) REFERENCES ordenes(id_orden) ON DELETE RESTRICT;

ALTER TABLE envios
    ADD CONSTRAINT fk_envios_orden FOREIGN KEY (id_orden) REFERENCES ordenes(id_orden) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_envios_domiciliario FOREIGN KEY (id_usuario_domiciliario) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT;

ALTER TABLE resenas
    ADD CONSTRAINT fk_resenas_orden FOREIGN KEY (id_orden) REFERENCES ordenes(id_orden) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_resenas_usuario FOREIGN KEY (id_usuario_autor) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT;

ALTER TABLE tickets_disputas
    ADD CONSTRAINT fk_tickets_usuario FOREIGN KEY (id_usuario_reclamante) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_tickets_empresa FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa) ON DELETE SET NULL,
    ADD CONSTRAINT fk_tickets_orden FOREIGN KEY (id_orden) REFERENCES ordenes(id_orden) ON DELETE SET NULL,
    ADD CONSTRAINT fk_tickets_detalle FOREIGN KEY (id_detalle_orden) REFERENCES detalles_orden(id_detalle) ON DELETE SET NULL;

ALTER TABLE mensajes_ticket
    ADD CONSTRAINT fk_mensajes_ticket_ticket FOREIGN KEY (id_ticket) REFERENCES tickets_disputas(id_ticket) ON DELETE CASCADE,
    ADD CONSTRAINT fk_mensajes_ticket_emisor FOREIGN KEY (id_usuario_emisor) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT;

ALTER TABLE auditoria_global
    ADD CONSTRAINT fk_auditoria_usuario FOREIGN KEY (id_usuario_actor) REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

-- ======================================================================================
-- 10. ÍNDICES DE RENDIMIENTO, BÚSQUEDA Y ESPACIALES
-- ======================================================================================

-- IAM y Sesiones
CREATE UNIQUE INDEX idx_usuarios_correo ON usuarios(correo_electronico) WHERE activo = TRUE;
CREATE INDEX idx_usuarios_rol ON usuarios(rol_sistema);
CREATE INDEX idx_sesiones_hash ON sesiones_usuario(token_sesion_hash) WHERE esta_activa = TRUE;
CREATE INDEX idx_sesiones_usuario ON sesiones_usuario(id_usuario) WHERE esta_activa = TRUE;

-- Permite buscar rápidamente por usuario y código.
CREATE INDEX IF NOT EXISTS idx_tokens_recuperacion_usuario ON repu.tokens_recuperacion_contrasena(id_usuario);
CREATE INDEX IF NOT EXISTS idx_tokens_recuperacion_codigo ON repu.tokens_recuperacion_contrasena(codigo_hash);
CREATE INDEX IF NOT EXISTS idx_tokens_recuperacion_expiracion ON repu.tokens_recuperacion_contrasena(expira_en) WHERE usado = FALSE;

-- Garantiza un único token activo por usuario.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unico_token_recuperacion_activo ON repu.tokens_recuperacion_contrasena(id_usuario) WHERE usado = FALSE;


-- Empresas y Direcciones (Espaciales PostGIS)
CREATE INDEX idx_empresas_propietario ON empresas(id_usuario_propietario);
CREATE INDEX idx_empresas_ubicacion ON empresas USING GIST (ubicacion);
CREATE INDEX idx_direcciones_usuario ON direcciones_usuario(id_usuario);
CREATE INDEX idx_direcciones_ubicacion ON direcciones_usuario USING GIST (ubicacion);

-- Catálogo
CREATE INDEX idx_categorias_padre ON categorias(id_categoria_padre);
CREATE INDEX idx_productos_empresa ON productos(id_empresa);
CREATE INDEX idx_productos_categoria ON productos(id_categoria);
CREATE INDEX idx_productos_caracteristicas ON productos USING GIN (caracteristicas_tecnicas);
CREATE INDEX idx_productos_sku ON productos(id_empresa, sku_referencia);

-- Carrito
CREATE UNIQUE INDEX idx_carritos_usuario_empresa_activo ON carritos_compras(id_usuario, id_empresa) WHERE estado = 'ACTIVO';
CREATE INDEX idx_items_carrito_carrito ON items_carrito(id_carrito);
CREATE UNIQUE INDEX idx_items_carrito_unicidad ON items_carrito(id_carrito, id_producto);

-- Órdenes
CREATE UNIQUE INDEX idx_ordenes_numero_legible ON ordenes(numero_orden_legible);
CREATE INDEX idx_ordenes_usuario ON ordenes(id_usuario_comprador);
CREATE INDEX idx_ordenes_empresa ON ordenes(id_empresa);
CREATE INDEX idx_ordenes_estado_macro ON ordenes(estado_orden);
CREATE INDEX idx_ordenes_activas_usuario ON ordenes(id_usuario_comprador, estado_orden) WHERE estado_orden NOT IN ('COMPLETADA', 'CANCELADA');
CREATE INDEX idx_detalles_orden_orden ON detalles_orden(id_orden);
CREATE INDEX idx_historial_estados_orden ON historial_estados_orden(id_orden, fecha_cambio ASC);

-- Pagos
CREATE INDEX idx_intentos_pago_orden ON intentos_pago(id_orden);
CREATE INDEX idx_intentos_pago_referencia ON intentos_pago(referencia_transaccion_pasarela);
CREATE INDEX idx_reembolsos_orden ON reembolsos(id_orden);

-- Logística y Envíos
CREATE INDEX idx_envios_orden ON envios(id_orden);
CREATE INDEX idx_envios_domiciliario ON envios(id_usuario_domiciliario);
CREATE INDEX idx_envios_estado ON envios(estado_envio);
CREATE INDEX idx_envios_ubicacion_destino ON envios USING GIST (ubicacion_destino);
CREATE INDEX idx_rastreo_envio_particionado ON historial_ubicacion_envio(id_envio, fecha_registro DESC);

-- Reseñas y Soporte
CREATE UNIQUE INDEX idx_resena_unica_por_objetivo ON resenas(id_orden, tipo_objetivo, id_objetivo) WHERE activo = TRUE;
CREATE INDEX idx_resenas_objetivo ON resenas(tipo_objetivo, id_objetivo) WHERE estado_moderacion = 'APROBADA';
CREATE INDEX idx_tickets_usuario ON tickets_disputas(id_usuario_reclamante);
CREATE INDEX idx_tickets_orden ON tickets_disputas(id_orden);
CREATE INDEX idx_tickets_estado ON tickets_disputas(estado_ticket);
CREATE INDEX idx_mensajes_ticket_ticket ON mensajes_ticket(id_ticket, fecha_envio ASC);

-- Auditoría
CREATE INDEX idx_auditoria_entidad ON auditoria_global(nombre_tabla_afectada, id_registro_afectado);
CREATE INDEX idx_auditoria_fecha ON auditoria_global(fecha_evento);
