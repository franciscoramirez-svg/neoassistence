create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat double precision not null,
  lon double precision not null,
  radius_meters integer not null default 150,
  timezone text default 'America/Mexico_City'
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  role text not null default 'employee',
  active boolean not null default true,
  branch_id uuid references public.branches(id),
  pin text,
  pin_hash text,
  shift_start text not null default '07:00:00',
  shift_end text not null default '17:00:00'
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id),
  employee_name text not null,
  branch_id uuid references public.branches(id),
  movement_type text not null,
  recorded_at timestamptz not null,
  lat double precision,
  lon double precision,
  status text,
  delay_minutes integer default 0,
  justification text default '',
  distance_meters double precision default 0,
  source text default 'web'
);
