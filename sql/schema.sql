-- Enable pgcrypto for gen_random_uuid()
create extension if not exists pgcrypto;

create table if not exists users (
  tg_id bigint primary key,
  full_name text,
  role text not null default 'pilot',
  created_at timestamptz default now()
);

create type flight_status as enum ('planned','cancelled','in_progress','done');

create table if not exists flights (
  id uuid primary key default gen_random_uuid(),
  flight_date date not null,
  route text not null,
  costs numeric(12,2),
  revenue numeric(12,2),
  manager_comment text,
  pilot_comment text,
  status flight_status default 'planned',
  created_by bigint references users(tg_id),
  created_at timestamptz default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id bigint references users(tg_id),
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);