-- Run during a controlled deployment. This migration intentionally does not
-- choose or discard any active cart when legacy data contains multiple stores.
-- Drain/stop ms-orders writers before applying this migration.
--
-- Review legacy conflicts first:
-- SELECT id_usuario,
--        jsonb_agg(jsonb_build_object(
--            'cartId', id_carrito, 'companyId', id_empresa, 'createdAt', fecha_creacion
--        ) ORDER BY fecha_creacion DESC) AS active_carts
-- FROM repu.carritos_compras
-- WHERE estado = 'ACTIVO'
-- GROUP BY id_usuario
-- HAVING COUNT(*) > 1;
--
-- For each conflicted buyer, explicitly choose the cart to keep active and
-- set the others to ABANDONADO. Their item rows remain preserved.
BEGIN;

DO $$
DECLARE
    conflicting_users TEXT;
BEGIN
    SELECT string_agg(format('%s (%s carritos)', id_usuario, active_count), ', ')
    INTO conflicting_users
    FROM (
        SELECT id_usuario, COUNT(*) AS active_count
        FROM repu.carritos_compras
        WHERE estado = 'ACTIVO'
        GROUP BY id_usuario
        HAVING COUNT(*) > 1
    ) AS conflicts;

    IF conflicting_users IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot enforce one active cart per user while duplicate active carts exist.'
            USING DETAIL = conflicting_users,
                  HINT = 'Choose the active store for each listed buyer and set other carts to ABANDONADO; their items remain preserved.';
    END IF;
END
$$;

DROP INDEX IF EXISTS repu.idx_carritos_usuario_empresa_activo;
CREATE UNIQUE INDEX IF NOT EXISTS idx_carritos_usuario_activo
    ON repu.carritos_compras(id_usuario)
    WHERE estado = 'ACTIVO';

COMMIT;
