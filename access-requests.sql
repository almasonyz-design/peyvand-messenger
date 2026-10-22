-- Peyvand access-request approval workflow
-- Run this script in Supabase SQL Editor before using the new request/approval UI.

create table if not exists public.peyvand_access_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  employee_number text not null check (char_length(btrim(employee_number)) between 1 and 40),
  phone text not null check (char_length(btrim(phone)) between 8 and 20),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

create unique index if not exists peyvand_access_requests_one_pending_employee
on public.peyvand_access_requests (employee_number)
where status = 'pending';

alter table public.peyvand_access_requests enable row level security;

drop policy if exists "peyvand_access_requests_public_submit" on public.peyvand_access_requests;
create policy "peyvand_access_requests_public_submit"
on public.peyvand_access_requests for insert to anon, authenticated
with check (
  status = 'pending'
  and reviewed_at is null
  and reviewed_by is null
  and char_length(btrim(full_name)) between 2 and 120
  and char_length(btrim(employee_number)) between 1 and 40
  and char_length(btrim(phone)) between 8 and 20
);

drop policy if exists "peyvand_access_requests_owner_read" on public.peyvand_access_requests;
create policy "peyvand_access_requests_owner_read"
on public.peyvand_access_requests for select to authenticated
using (
  exists (
    select 1 from public.peyvand_user_roles r
    where r.user_id = auth.uid() and r.role = 'owner'
  )
);

drop policy if exists "peyvand_access_requests_owner_update" on public.peyvand_access_requests;
create policy "peyvand_access_requests_owner_update"
on public.peyvand_access_requests for update to authenticated
using (
  exists (
    select 1 from public.peyvand_user_roles r
    where r.user_id = auth.uid() and r.role = 'owner'
  )
)
with check (
  exists (
    select 1 from public.peyvand_user_roles r
    where r.user_id = auth.uid() and r.role = 'owner'
  )
);

grant insert on public.peyvand_access_requests to anon, authenticated;
grant select, update on public.peyvand_access_requests to authenticated;
