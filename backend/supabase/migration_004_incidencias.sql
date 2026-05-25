CREATE TABLE IF NOT EXISTS public.incidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid REFERENCES public.empleados(id),
  empleado_nombre text NOT NULL,
  registro_id uuid,
  tipo text NOT NULL DEFAULT 'retardo',
  fecha date NOT NULL,
  hora text,
  motivo text NOT NULL DEFAULT '',
  evidencia_url text,
  estatus text NOT NULL DEFAULT 'pendiente',
  admin_comentario text DEFAULT '',
  creada_por text NOT NULL DEFAULT 'empleado',
  created_at timestamptz DEFAULT now(),
  resuelta_at timestamptz
);
