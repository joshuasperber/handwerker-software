-- Defense in depth for tables added after the original RLS rollout.
-- The application currently uses its server-side Prisma connection and does not
-- grant Data API access to anon/authenticated. These policies are deliberately
-- paired with explicit revokes so a future grant cannot expose all tenants.

create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

create or replace function app_private.current_app_user_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from public."User" as u
  where (select auth.uid()) is not null
    and u."supabaseUserId" = (select auth.uid())::text
    and u."isActive" = true
  limit 1
$$;

create or replace function app_private.current_tenant_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u."tenantId"
  from public."User" as u
  where (select auth.uid()) is not null
    and u."supabaseUserId" = (select auth.uid())::text
    and u."isActive" = true
  limit 1
$$;

revoke execute on function app_private.current_app_user_id() from public, anon, service_role;
revoke execute on function app_private.current_tenant_id() from public, anon, service_role;
grant execute on function app_private.current_app_user_id() to authenticated;
grant execute on function app_private.current_tenant_id() to authenticated;

alter table public."AiChatMessage" enable row level security;
alter table public."AiChatSession" enable row level security;
alter table public."OrderAssignee" enable row level security;
alter table public."OrderTypeDefinition" enable row level security;
alter table public."Project" enable row level security;
alter table public."ProjectCost" enable row level security;
alter table public."ProjectFile" enable row level security;
alter table public."ProjectMember" enable row level security;
alter table public."ProjectNote" enable row level security;
alter table public."WorkRequest" enable row level security;

revoke all on table
  public."AiChatMessage",
  public."AiChatSession",
  public."OrderAssignee",
  public."OrderTypeDefinition",
  public."Project",
  public."ProjectCost",
  public."ProjectFile",
  public."ProjectMember",
  public."ProjectNote",
  public."WorkRequest"
from anon, authenticated;

-- Direct tenant-owned records.
create policy "ai_chat_sessions_select_tenant_user" on public."AiChatSession"
  for select to authenticated
  using (
    "tenantId" = (select app_private.current_tenant_id())
    and "userId" = (select app_private.current_app_user_id())
  );
create policy "ai_chat_sessions_insert_tenant_user" on public."AiChatSession"
  for insert to authenticated
  with check (
    "tenantId" = (select app_private.current_tenant_id())
    and "userId" = (select app_private.current_app_user_id())
  );
create policy "ai_chat_sessions_update_tenant_user" on public."AiChatSession"
  for update to authenticated
  using (
    "tenantId" = (select app_private.current_tenant_id())
    and "userId" = (select app_private.current_app_user_id())
  )
  with check (
    "tenantId" = (select app_private.current_tenant_id())
    and "userId" = (select app_private.current_app_user_id())
  );
create policy "ai_chat_sessions_delete_tenant_user" on public."AiChatSession"
  for delete to authenticated
  using (
    "tenantId" = (select app_private.current_tenant_id())
    and "userId" = (select app_private.current_app_user_id())
  );

create policy "order_type_definitions_select_tenant" on public."OrderTypeDefinition"
  for select to authenticated
  using ("tenantId" = (select app_private.current_tenant_id()));
create policy "order_type_definitions_insert_tenant" on public."OrderTypeDefinition"
  for insert to authenticated
  with check ("tenantId" = (select app_private.current_tenant_id()));
create policy "order_type_definitions_update_tenant" on public."OrderTypeDefinition"
  for update to authenticated
  using ("tenantId" = (select app_private.current_tenant_id()))
  with check ("tenantId" = (select app_private.current_tenant_id()));
create policy "order_type_definitions_delete_tenant" on public."OrderTypeDefinition"
  for delete to authenticated
  using ("tenantId" = (select app_private.current_tenant_id()));

create policy "projects_select_tenant" on public."Project"
  for select to authenticated
  using ("tenantId" = (select app_private.current_tenant_id()));
create policy "projects_insert_tenant" on public."Project"
  for insert to authenticated
  with check ("tenantId" = (select app_private.current_tenant_id()));
create policy "projects_update_tenant" on public."Project"
  for update to authenticated
  using ("tenantId" = (select app_private.current_tenant_id()))
  with check ("tenantId" = (select app_private.current_tenant_id()));
create policy "projects_delete_tenant" on public."Project"
  for delete to authenticated
  using ("tenantId" = (select app_private.current_tenant_id()));

create policy "work_requests_select_tenant" on public."WorkRequest"
  for select to authenticated
  using ("tenantId" = (select app_private.current_tenant_id()));
create policy "work_requests_insert_tenant" on public."WorkRequest"
  for insert to authenticated
  with check ("tenantId" = (select app_private.current_tenant_id()));
create policy "work_requests_update_tenant" on public."WorkRequest"
  for update to authenticated
  using ("tenantId" = (select app_private.current_tenant_id()))
  with check ("tenantId" = (select app_private.current_tenant_id()));
create policy "work_requests_delete_tenant" on public."WorkRequest"
  for delete to authenticated
  using ("tenantId" = (select app_private.current_tenant_id()));

-- Child records inherit tenant ownership through their parent record.
create policy "ai_chat_messages_select_owner" on public."AiChatMessage"
  for select to authenticated
  using (exists (
    select 1 from public."AiChatSession" as s
    where s.id = "AiChatMessage"."sessionId"
      and s."tenantId" = (select app_private.current_tenant_id())
      and s."userId" = (select app_private.current_app_user_id())
  ));
create policy "ai_chat_messages_insert_owner" on public."AiChatMessage"
  for insert to authenticated
  with check (exists (
    select 1 from public."AiChatSession" as s
    where s.id = "AiChatMessage"."sessionId"
      and s."tenantId" = (select app_private.current_tenant_id())
      and s."userId" = (select app_private.current_app_user_id())
  ));
create policy "ai_chat_messages_update_owner" on public."AiChatMessage"
  for update to authenticated
  using (exists (
    select 1 from public."AiChatSession" as s
    where s.id = "AiChatMessage"."sessionId"
      and s."tenantId" = (select app_private.current_tenant_id())
      and s."userId" = (select app_private.current_app_user_id())
  ))
  with check (exists (
    select 1 from public."AiChatSession" as s
    where s.id = "AiChatMessage"."sessionId"
      and s."tenantId" = (select app_private.current_tenant_id())
      and s."userId" = (select app_private.current_app_user_id())
  ));
create policy "ai_chat_messages_delete_owner" on public."AiChatMessage"
  for delete to authenticated
  using (exists (
    select 1 from public."AiChatSession" as s
    where s.id = "AiChatMessage"."sessionId"
      and s."tenantId" = (select app_private.current_tenant_id())
      and s."userId" = (select app_private.current_app_user_id())
  ));

create policy "order_assignees_select_tenant" on public."OrderAssignee"
  for select to authenticated
  using (exists (
    select 1 from public."Order" as o
    where o.id = "OrderAssignee"."orderId"
      and o."tenantId" = (select app_private.current_tenant_id())
  ));
create policy "order_assignees_insert_tenant" on public."OrderAssignee"
  for insert to authenticated
  with check (
    exists (
      select 1 from public."Order" as o
      where o.id = "OrderAssignee"."orderId"
        and o."tenantId" = (select app_private.current_tenant_id())
    )
    and exists (
      select 1 from public."Employee" as e
      where e.id = "OrderAssignee"."employeeId"
        and e."tenantId" = (select app_private.current_tenant_id())
    )
  );
create policy "order_assignees_update_tenant" on public."OrderAssignee"
  for update to authenticated
  using (exists (
    select 1 from public."Order" as o
    where o.id = "OrderAssignee"."orderId"
      and o."tenantId" = (select app_private.current_tenant_id())
  ))
  with check (
    exists (
      select 1 from public."Order" as o
      where o.id = "OrderAssignee"."orderId"
        and o."tenantId" = (select app_private.current_tenant_id())
    )
    and exists (
      select 1 from public."Employee" as e
      where e.id = "OrderAssignee"."employeeId"
        and e."tenantId" = (select app_private.current_tenant_id())
    )
  );
create policy "order_assignees_delete_tenant" on public."OrderAssignee"
  for delete to authenticated
  using (exists (
    select 1 from public."Order" as o
    where o.id = "OrderAssignee"."orderId"
      and o."tenantId" = (select app_private.current_tenant_id())
  ));

create policy "project_members_select_tenant" on public."ProjectMember"
  for select to authenticated
  using (exists (
    select 1 from public."Project" as p
    where p.id = "ProjectMember"."projectId"
      and p."tenantId" = (select app_private.current_tenant_id())
  ));
create policy "project_members_insert_tenant" on public."ProjectMember"
  for insert to authenticated
  with check (
    exists (
      select 1 from public."Project" as p
      where p.id = "ProjectMember"."projectId"
        and p."tenantId" = (select app_private.current_tenant_id())
    )
    and exists (
      select 1 from public."Employee" as e
      where e.id = "ProjectMember"."employeeId"
        and e."tenantId" = (select app_private.current_tenant_id())
    )
  );
create policy "project_members_update_tenant" on public."ProjectMember"
  for update to authenticated
  using (exists (
    select 1 from public."Project" as p
    where p.id = "ProjectMember"."projectId"
      and p."tenantId" = (select app_private.current_tenant_id())
  ))
  with check (
    exists (
      select 1 from public."Project" as p
      where p.id = "ProjectMember"."projectId"
        and p."tenantId" = (select app_private.current_tenant_id())
    )
    and exists (
      select 1 from public."Employee" as e
      where e.id = "ProjectMember"."employeeId"
        and e."tenantId" = (select app_private.current_tenant_id())
    )
  );
create policy "project_members_delete_tenant" on public."ProjectMember"
  for delete to authenticated
  using (exists (
    select 1 from public."Project" as p
    where p.id = "ProjectMember"."projectId"
      and p."tenantId" = (select app_private.current_tenant_id())
  ));

-- These project child tables all use the same parent-tenant rule.
create policy "project_notes_select_tenant" on public."ProjectNote"
  for select to authenticated using (exists (
    select 1 from public."Project" as p where p.id = "ProjectNote"."projectId"
      and p."tenantId" = (select app_private.current_tenant_id())
  ));
create policy "project_notes_insert_tenant" on public."ProjectNote"
  for insert to authenticated with check (exists (
    select 1 from public."Project" as p where p.id = "ProjectNote"."projectId"
      and p."tenantId" = (select app_private.current_tenant_id())
  ));
create policy "project_notes_update_tenant" on public."ProjectNote"
  for update to authenticated using (exists (
    select 1 from public."Project" as p where p.id = "ProjectNote"."projectId"
      and p."tenantId" = (select app_private.current_tenant_id())
  )) with check (exists (
    select 1 from public."Project" as p where p.id = "ProjectNote"."projectId"
      and p."tenantId" = (select app_private.current_tenant_id())
  ));
create policy "project_notes_delete_tenant" on public."ProjectNote"
  for delete to authenticated using (exists (
    select 1 from public."Project" as p where p.id = "ProjectNote"."projectId"
      and p."tenantId" = (select app_private.current_tenant_id())
  ));

create policy "project_files_select_tenant" on public."ProjectFile"
  for select to authenticated using (exists (
    select 1 from public."Project" as p where p.id = "ProjectFile"."projectId"
      and p."tenantId" = (select app_private.current_tenant_id())
  ));
create policy "project_files_insert_tenant" on public."ProjectFile"
  for insert to authenticated with check (exists (
    select 1 from public."Project" as p where p.id = "ProjectFile"."projectId"
      and p."tenantId" = (select app_private.current_tenant_id())
  ));
create policy "project_files_update_tenant" on public."ProjectFile"
  for update to authenticated using (exists (
    select 1 from public."Project" as p where p.id = "ProjectFile"."projectId"
      and p."tenantId" = (select app_private.current_tenant_id())
  )) with check (exists (
    select 1 from public."Project" as p where p.id = "ProjectFile"."projectId"
      and p."tenantId" = (select app_private.current_tenant_id())
  ));
create policy "project_files_delete_tenant" on public."ProjectFile"
  for delete to authenticated using (exists (
    select 1 from public."Project" as p where p.id = "ProjectFile"."projectId"
      and p."tenantId" = (select app_private.current_tenant_id())
  ));

create policy "project_costs_select_tenant" on public."ProjectCost"
  for select to authenticated using (exists (
    select 1 from public."Project" as p where p.id = "ProjectCost"."projectId"
      and p."tenantId" = (select app_private.current_tenant_id())
  ));
create policy "project_costs_insert_tenant" on public."ProjectCost"
  for insert to authenticated with check (exists (
    select 1 from public."Project" as p where p.id = "ProjectCost"."projectId"
      and p."tenantId" = (select app_private.current_tenant_id())
  ));
create policy "project_costs_update_tenant" on public."ProjectCost"
  for update to authenticated using (exists (
    select 1 from public."Project" as p where p.id = "ProjectCost"."projectId"
      and p."tenantId" = (select app_private.current_tenant_id())
  )) with check (exists (
    select 1 from public."Project" as p where p.id = "ProjectCost"."projectId"
      and p."tenantId" = (select app_private.current_tenant_id())
  ));
create policy "project_costs_delete_tenant" on public."ProjectCost"
  for delete to authenticated using (exists (
    select 1 from public."Project" as p where p.id = "ProjectCost"."projectId"
      and p."tenantId" = (select app_private.current_tenant_id())
  ));

-- Historical consistency repair. No records are deleted.
update public."Appointment" as a
set status = case
  when o.status = 'STORNIERT'::public."OrderStatus"
    then 'STORNIERT'::public."AppointmentStatus"
  else 'ABGESCHLOSSEN'::public."AppointmentStatus"
end,
"updatedAt" = now()
from public."Order" as o
where a."orderId" = o.id
  and o.status in (
    'ABRECHNUNGSBEREIT'::public."OrderStatus",
    'ABGERECHNET'::public."OrderStatus",
    'STORNIERT'::public."OrderStatus"
  )
  and a.status in (
    'GEPLANT'::public."AppointmentStatus",
    'UNTERWEGS'::public."AppointmentStatus",
    'ANGEKOMMEN'::public."AppointmentStatus",
    'IN_ARBEIT'::public."AppointmentStatus"
  );

update public."StockBalance"
set "orderedQuantity" = 0,
    "updatedAt" = now()
where "orderedQuantity" < 0;

alter table public."StockBalance"
  add constraint "StockBalance_orderedQuantity_nonnegative"
  check ("orderedQuantity" >= 0) not valid;

alter table public."StockBalance"
  validate constraint "StockBalance_orderedQuantity_nonnegative";
