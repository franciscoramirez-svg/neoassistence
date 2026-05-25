CREATE TABLE IF NOT EXISTS public.permisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid REFERENCES public.empleados(id),
  empleado_nombre text NOT NULL,
  tipo text NOT NULL DEFAULT 'permiso',
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  motivo text NOT NULL DEFAULT '',
  estatus text NOT NULL DEFAULT 'pendiente',
  admin_comentario text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  resuelta_at timestamptz
);
