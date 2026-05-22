-- Migration 002: Agregar columnas para credencial digital, YTS y firmas diarias
-- Ejecutar en SQL Editor de Supabase Dashboard

ALTER TABLE empleados ADD COLUMN IF NOT EXISTS numero_empleado TEXT;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS foto_url TEXT;

CREATE TABLE IF NOT EXISTS yts_mensual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes TEXT NOT NULL UNIQUE,
  archivo_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE yts_mensual ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on yts_mensual" ON yts_mensual
FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS yts_firmas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  employee_name TEXT NOT NULL,
  fecha DATE NOT NULL,
  firmado BOOLEAN DEFAULT TRUE,
  condiciones TEXT DEFAULT 'OK',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, fecha)
);

ALTER TABLE yts_firmas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on yts_firmas" ON yts_firmas
FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL UNIQUE,
  keys JSONB NOT NULL,
  employee_id UUID,
  employee_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on push_subscriptions" ON push_subscriptions
FOR ALL USING (true) WITH CHECK (true);
