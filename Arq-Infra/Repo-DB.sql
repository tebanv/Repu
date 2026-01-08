/*
 * ======================================================================================
 * PLATAFORMA MULTI-TENANT E-COMMERCE & SERVICIOS ON-DEMAND
 * SCRIPT DDL POSTGRESQL - NIVEL: SENIOR ARCHITECT
 * * NOTAS DE ARQUITECTURA:
 * 1. Identificadores: UUID v4 para colisiones nulas y seguridad en APIs.
 * 2. Flexibilidad: Uso extensivo de JSONB para atributos dinámicos (NoSQL sobre SQL).
 * 3. Integridad: Relaciones lógicas definidas sin CONSTRAINTS físicos (Foreign Keys)
 * para optimizar carga masiva y flexibilidad en pruebas.
 * 4. Auditoría: Columnas de timestamp automático y Soft Delete (activo).
 * ======================================================================================
 */

-- 1. CREACIÓN Y SELECCIÓN DEL ESQUEMA
CREATE SCHEMA IF NOT EXISTS repu;
-- Función genérica para actualizar automáticamente la fecha de modificación
-- ESTA ES LA LÍNEA MÁGICA:
-- Todo lo que se ejecute de aquí en adelante se creará automáticamente dentro de 'repu'
SET search_path TO repu, public;
-- 2. EXTENSIONES (Las extensiones suelen instalarse en public, pero nos aseguramos que estén)
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA public;

-- Función genérica para actualizar automáticamente la fecha de modificación
CREATE OR REPLACE FUNCTION actualizar_timestamp_modificacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ======================================================================================
-- 1. MÓDULO DE CONFIGURACIÓN Y PARAMETRIZACIÓN
-- ======================================================================================

CREATE TABLE parametros_sistema (
    id_parametro UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_clave VARCHAR(50) NOT NULL UNIQUE, -- Ej: 'MONEDA_DEFECTO', 'PAIS_OPERACION'
    valor_configuracion JSONB NOT NULL, -- Permite guardar strings, objetos o arrays de config
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ======================================================================================
-- 2. MÓDULO DE USUARIOS Y SEGURIDAD (IAM)
-- ======================================================================================

CREATE TABLE usuarios (
    id_usuario UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correo_electronico VARCHAR(150) NOT NULL,
    hash_contrasena VARCHAR(255) NOT NULL,
    -- Roles permitidos: 'COMPRADOR', 'DISTRIBUIDOR', 'DOMICILIARIO', 'ANALISTA', 'ADMIN'
    rol_sistema VARCHAR(50) NOT NULL, 
    nombres VARCHAR(100),
    apellidos VARCHAR(100),
    telefono_movil VARCHAR(20),
    -- Datos específicos del rol (Licencia de conducción, foto perfil, preferencias)
    atributos_perfil JSONB DEFAULT '{}', 
    ultimo_login TIMESTAMPTZ,
    activo BOOLEAN DEFAULT TRUE, -- Soft Delete
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_usuarios_correo ON usuarios(correo_electronico) WHERE activo = TRUE;
CREATE INDEX idx_usuarios_rol ON usuarios(rol_sistema);

-- ======================================================================================
-- 3. MÓDULO DE EMPRESAS Y TENANTS
-- ======================================================================================

CREATE TABLE empresas (
    id_empresa UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario_propietario UUID NOT NULL, -- Relación lógica con usuarios
    razon_social VARCHAR(200) NOT NULL,
    nit_identificacion VARCHAR(50),
    logo_url TEXT,
    descripcion_tienda TEXT,
    -- Configuración específica: Horarios de atención, políticas de envío, colores de marca
    configuracion_operativa JSONB DEFAULT '{}',
    -- Geolocalización de la bodega/tienda física
    direccion_fisica TEXT,
    latitud NUMERIC(10, 8),
    longitud NUMERIC(11, 8),
    calificacion_promedio NUMERIC(3, 2) DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_empresas_propietario ON empresas(id_usuario_propietario);

-- ======================================================================================
-- 4. MÓDULO DE CATÁLOGO (PRODUCTOS FLEXIBLES)
-- ======================================================================================

CREATE TABLE categorias (
    id_categoria UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_categoria_padre UUID, -- Para jerarquías (Árbol de categorías)
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    icono_url TEXT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE productos (
    id_producto UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empresa UUID NOT NULL, -- Multi-tenant: El producto pertenece a una empresa
    id_categoria UUID,
    nombre VARCHAR(200) NOT NULL,
    sku_referencia VARCHAR(100),
    descripcion_corta TEXT,
    precio_base NUMERIC(15, 2) NOT NULL,
    precio_oferta NUMERIC(15, 2),
    inventario_disponible INTEGER DEFAULT 0,
    -- CRÍTICO: Aquí se guardan atributos variados (Baterías: Voltaje, Llantas: Rin, etc.)
    -- Ej: {"voltaje": "12V", "amperaje": 600, "rin": 16, "marca_vehiculo": ["Mazda", "Toyota"]}
    caracteristicas_tecnicas JSONB DEFAULT '{}', 
    imagenes_urls JSONB, -- Array de URLs
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Índices GIN para búsquedas rápidas dentro del JSON de características
CREATE INDEX idx_productos_caracteristicas ON productos USING GIN (caracteristicas_tecnicas);
CREATE INDEX idx_productos_empresa ON productos(id_empresa);
CREATE INDEX idx_productos_categoria ON productos(id_categoria);

-- ======================================================================================
-- 5. MÓDULO DE CARRITO Y COMPRAS
-- ======================================================================================

CREATE TABLE carritos_compras (
    id_carrito UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID NOT NULL, -- Relación lógica con usuario comprador
    estado VARCHAR(20) DEFAULT 'ACTIVO', -- ACTIVO, ABANDONADO, CONVERTIDO
    fecha_ultimo_acceso TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE items_carrito (
    id_item_carrito UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_carrito UUID NOT NULL,
    id_producto UUID NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    datos_seleccionados JSONB, -- Por si el usuario seleccionó una variante específica
    fecha_agregado TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_items_carrito_carrito ON items_carrito(id_carrito);

-- ======================================================================================
-- 6. MÓDULO DE ÓRDENES Y PEDIDOS
-- ======================================================================================

CREATE TABLE ordenes (
    id_orden UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_orden_legible SERIAL, -- Para visualización humana (Ej: Orden #1054)
    id_usuario_comprador UUID NOT NULL,
    id_empresa UUID NOT NULL, -- Orden se separa por empresa para facilitar despacho
    
    -- Estados: 'PENDIENTE_PAGO', 'PAGADA', 'CONFIRMADA_TIENDA', 'PREPARACION', 'EN_CAMINO', 'ENTREGADA', 'CANCELADA'
    estado_orden VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_PAGO',
    
    subtotal NUMERIC(15, 2) NOT NULL,
    costo_envio NUMERIC(15, 2) DEFAULT 0,
    total_final NUMERIC(15, 2) NOT NULL,
    
    -- Datos Snapshot: Dirección en el momento de la compra
    direccion_entrega_snapshot JSONB NOT NULL, 
    notas_cliente TEXT,
    
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE detalles_orden (
    id_detalle UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_orden UUID NOT NULL,
    id_producto UUID NOT NULL,
    nombre_producto_snapshot VARCHAR(200), -- Persistencia histórica por si cambia el nombre
    cantidad INTEGER NOT NULL,
    precio_unitario_snapshot NUMERIC(15, 2) NOT NULL,
    total_linea NUMERIC(15, 2) NOT NULL,
    caracteristicas_snapshot JSONB -- Copia de las características al momento de comprar
);

CREATE INDEX idx_ordenes_usuario ON ordenes(id_usuario_comprador);
CREATE INDEX idx_ordenes_empresa ON ordenes(id_empresa);
CREATE INDEX idx_ordenes_estado ON ordenes(estado_orden);

-- ======================================================================================
-- 7. MÓDULO DE PAGOS E INTEGRACIONES
-- ======================================================================================

CREATE TABLE transacciones_pagos (
    id_transaccion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_orden UUID NOT NULL,
    pasarela_pago VARCHAR(50) NOT NULL, -- 'WOMPI', 'MERCADOPAGO', 'BANCOLOMBIA'
    referencia_externa VARCHAR(100), -- ID de transacción en la pasarela
    token_pago VARCHAR(255),
    monto NUMERIC(15, 2) NOT NULL,
    moneda VARCHAR(3) DEFAULT 'COP',
    estado_pago VARCHAR(30), -- 'APROBADO', 'RECHAZADO', 'PENDIENTE'
    -- Guardar toda la respuesta JSON de la pasarela para auditoría
    respuesta_json_pasarela JSONB, 
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pagos_orden ON transacciones_pagos(id_orden);
CREATE INDEX idx_pagos_referencia ON transacciones_pagos(referencia_externa);

-- ======================================================================================
-- 8. MÓDULO DE LOGÍSTICA Y RASTREO (UBER-STYLE)
-- ======================================================================================

CREATE TABLE envios (
    id_envio UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_orden UUID NOT NULL,
    id_usuario_domiciliario UUID, -- Puede ser NULL inicialmente hasta asignación
    
    -- Coordenadas Origen (Tienda)
    latitud_origen NUMERIC(10, 8),
    longitud_origen NUMERIC(11, 8),
    
    -- Coordenadas Destino (Cliente)
    latitud_destino NUMERIC(10, 8),
    longitud_destino NUMERIC(11, 8),
    
    estado_envio VARCHAR(30), -- 'BUSCANDO_DOMICILIARIO', 'ASIGNADO', 'RECOGIDO', 'EN_RUTA', 'ENTREGADO'
    codigo_verificacion_entrega VARCHAR(10), -- OTP para seguridad
    fecha_inicio_ruta TIMESTAMPTZ,
    fecha_entrega TIMESTAMPTZ,
    
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de alto volumen para rastreo en tiempo real
CREATE TABLE historial_ubicacion_envio (
    id_rastreo BIGSERIAL PRIMARY KEY, -- BigSerial para millones de registros
    id_envio UUID NOT NULL,
    latitud_actual NUMERIC(10, 8) NOT NULL,
    longitud_actual NUMERIC(11, 8) NOT NULL,
    velocidad_detectada NUMERIC(5, 2), -- Km/h opcional
    bateria_dispositivo INTEGER, -- Nivel batería celular domiciliario
    fecha_registro TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rastreo_envio_fecha ON historial_ubicacion_envio(id_envio, fecha_registro DESC);

-- ======================================================================================
-- 9. MÓDULO DE AUDITORÍA Y LOGS TRANSACCIONALES
-- ======================================================================================

CREATE TABLE auditoria_global (
    id_auditoria BIGSERIAL PRIMARY KEY,
    nombre_tabla_afectada VARCHAR(100) NOT NULL,
    id_registro_afectado UUID, -- ID de la entidad (Usuario, Producto, Orden)
    accion_realizada VARCHAR(20) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'VIEW'
    id_usuario_actor UUID, -- Quién hizo la acción
    direccion_ip VARCHAR(45),
    user_agent TEXT,
    
    -- Snapshot de datos (Opcional, pero recomendado para sistemas robustos)
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    
    fecha_evento TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_auditoria_entidad ON auditoria_global(nombre_tabla_afectada, id_registro_afectado);
CREATE INDEX idx_auditoria_fecha ON auditoria_global(fecha_evento);

-- ======================================================================================
-- 10. MÓDULOS DE SOPORTE Y DIRECCIONES
-- ======================================================================================

CREATE TABLE direcciones_usuario (
    direccion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL,
    nombre_direccion VARCHAR(100), -- Casa, Trabajo, etc.
    direccion_completa TEXT NOT NULL,
    ciudad VARCHAR(100),
    codigo_postal VARCHAR(20),
    es_principal BOOLEAN DEFAULT FALSE,
    latitud NUMERIC(10, 8),
    longitud NUMERIC(11, 8)
);

CREATE TABLE quejas_solicitudes (
    solicitud_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID , -- Puede ser NULL si es público
    distribuidor_id UUID , -- Si la queja es sobre una tienda específica
    tipo_solicitud VARCHAR(50) NOT NULL, -- QUEJA, COMENTARIO, SUGERENCIA, SOPORTE
    asunto VARCHAR(255) NOT NULL,
    detalle_solicitud TEXT NOT NULL,
    estado_solicitud VARCHAR(50) DEFAULT 'NUEVA', -- NUEVA, EN_PROCESO, RESUELTA, CERRADA
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre TIMESTAMP WITH TIME ZONE,
    respuesta_admin TEXT -- Respuesta o acción tomada por el distribuidor/administrador
);

-- ======================================================================================
-- APLICACIÓN DE TRIGGERS PARA ACTUALIZACIÓN DE FECHAS
-- ======================================================================================

CREATE TRIGGER update_usuarios_modtime BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();
CREATE TRIGGER update_empresas_modtime BEFORE UPDATE ON empresas FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();
CREATE TRIGGER update_categorias_modtime BEFORE UPDATE ON categorias FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();
CREATE TRIGGER update_productos_modtime BEFORE UPDATE ON productos FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();
CREATE TRIGGER update_ordenes_modtime BEFORE UPDATE ON ordenes FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();
CREATE TRIGGER update_pagos_modtime BEFORE UPDATE ON transacciones_pagos FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();
CREATE TRIGGER update_envios_modtime BEFORE UPDATE ON envios FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();
CREATE TRIGGER update_direcciones_modtime BEFORE UPDATE ON direcciones_usuario FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();
CREATE TRIGGER update_quejas_modtime BEFORE UPDATE ON quejas_solicitudes FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();