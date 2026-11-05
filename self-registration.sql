-- Peyvand self-registration + owner approval migration
alter table public.peyvand_employees add column if not exists branch_code text;
alter table public.peyvand_employees add column if not exists marketing_account_number text;

alter table public.peyvand_access_requests
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists branch_code text,
  add column if not exists marketing_account_number text;

create unique index if not exists peyvand_access_requests_auth_user_uidx
  on public.peyvand_access_requests(auth_user_id) where auth_user_id is not null;

-- Passwords are never stored in this table. They remain in Supabase Auth only.
drop policy if exists "peyvand_access_requests_public_submit" on public.peyvand_access_requests;
create policy "peyvand_access_requests_public_submit"
on public.peyvand_access_requests for insert to anon, authenticated
with check (false);
revoke insert, update, delete on public.peyvand_access_requests from anon, authenticated;
grant select on public.peyvand_access_requests to authenticated;

-- Ensure a signed-in but unapproved account cannot read/write chat messages.
drop policy if exists peyvand_messages_active_member_only on public.peyvand_messages;
create policy peyvand_messages_active_member_only
on public.peyvand_messages as restrictive
for all to authenticated
using (
  exists (select 1 from public.peyvand_employees e
          where e.user_id = auth.uid() and e.is_active = true)
  or public.peyvand_has_role(array['owner','admin'])
)
with check (
  exists (select 1 from public.peyvand_employees e
          where e.user_id = auth.uid() and e.is_active = true)
  or public.peyvand_has_role(array['owner','admin'])
);
