-- Agrega columna sueldo_diario a la tabla empleados
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS sueldo_diario NUMERIC(10,2) DEFAULT 0.00;
