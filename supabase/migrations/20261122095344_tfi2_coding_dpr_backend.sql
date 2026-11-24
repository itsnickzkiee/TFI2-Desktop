create table if not exists public.tfi_coding_dpr_entries (
  id uuid primary key default gen_random_uuid(),
  coding_date date,
  line_number text,
  record_fingerprint text not null unique,
  source_import_row_id uuid unique references public.tfi_import_rows(id) on delete restrict,
  entry_source text not null default 'manual' check (entry_source in ('manual','import')),
  version integer not null default 1 check (version>0),
  record_status text not null default 'active' check (record_status in ('active','archived')),
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tfi_coding_dpr_line_number_length check (line_number is null or length(line_number)<=20),
  constraint tfi_coding_dpr_fingerprint_length check (length(record_fingerprint)=32)
);
create index if not exists tfi_coding_dpr_entries_date_created_idx
  on public.tfi_coding_dpr_entries(coding_date desc,created_at desc);
create index if not exists tfi_coding_dpr_entries_line_date_idx
  on public.tfi_coding_dpr_entries(line_number,coding_date desc);
create index if not exists tfi_coding_dpr_entries_created_by_idx
  on public.tfi_coding_dpr_entries(created_by);
create index if not exists tfi_coding_dpr_entries_updated_by_idx
  on public.tfi_coding_dpr_entries(updated_by);
create index if not exists tfi_coding_dpr_entries_source_import_idx
  on public.tfi_coding_dpr_entries(source_import_row_id) where source_import_row_id is not null;

create table if not exists public.tfi_coding_dpr_items (
  id uuid primary key default gen_random_uuid(),
  coding_dpr_entry_id uuid not null references public.tfi_coding_dpr_entries(id) on delete restrict,
  lot_number smallint not null check (lot_number between 1 and 7),
  production_date date,
  product_code text,
  quantity numeric(18,4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tfi_coding_dpr_item_lot_unique unique(coding_dpr_entry_id,lot_number),
  constraint tfi_coding_dpr_item_product_code_length check (product_code is null or length(product_code)<=100),
  constraint tfi_coding_dpr_item_quantity_check check (
    quantity is null or (quantity>=0 and quantity::text ~ '^[0-9]+([.][0-9]{1,4})?$')
  )
);
create index if not exists tfi_coding_dpr_items_entry_lot_idx
  on public.tfi_coding_dpr_items(coding_dpr_entry_id,lot_number);
create index if not exists tfi_coding_dpr_items_product_code_idx
  on public.tfi_coding_dpr_items(product_code);

create table if not exists public.tfi_coding_dpr_revisions (
  id uuid primary key default gen_random_uuid(),
  coding_dpr_entry_id uuid not null references public.tfi_coding_dpr_entries(id) on delete restrict,
  version integer not null check (version>1),
  before_data jsonb not null check (jsonb_typeof(before_data)='object'),
  after_data jsonb not null check (jsonb_typeof(after_data)='object'),
  changed_fields text[] not null check (cardinality(changed_fields)>0),
  change_reason text check (change_reason is null or length(change_reason)<=500),
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  unique(coding_dpr_entry_id,version)
);
create index if not exists tfi_coding_dpr_revisions_entry_order_idx
  on public.tfi_coding_dpr_revisions(coding_dpr_entry_id,version desc);
create index if not exists tfi_coding_dpr_revisions_changed_by_idx
  on public.tfi_coding_dpr_revisions(changed_by);

alter table public.tfi_coding_dpr_entries enable row level security;
alter table public.tfi_coding_dpr_items enable row level security;
alter table public.tfi_coding_dpr_revisions enable row level security;
revoke all on public.tfi_coding_dpr_entries from public,anon,authenticated;
revoke all on public.tfi_coding_dpr_items from public,anon,authenticated;
revoke all on public.tfi_coding_dpr_revisions from public,anon,authenticated;
grant select on public.tfi_coding_dpr_entries to authenticated;
grant select on public.tfi_coding_dpr_items to authenticated;
grant select on public.tfi_coding_dpr_revisions to authenticated;
create policy tfi_coding_dpr_entries_authorized_read on public.tfi_coding_dpr_entries
  for select to authenticated using ((select private.tfi_has_permission('coding_dpr','view')));
create policy tfi_coding_dpr_items_authorized_read on public.tfi_coding_dpr_items
  for select to authenticated using (
    (select private.tfi_has_permission('coding_dpr','view'))
    and exists(select 1 from public.tfi_coding_dpr_entries e where e.id=coding_dpr_entry_id)
  );
create policy tfi_coding_dpr_revisions_authorized_read on public.tfi_coding_dpr_revisions
  for select to authenticated using (
    (select private.tfi_has_permission('coding_dpr','view'))
    and exists(select 1 from public.tfi_coding_dpr_entries e where e.id=coding_dpr_entry_id)
  );

create or replace function private.tfi_coding_dpr_review_reasons(p_entry_id uuid)
returns text[] language sql stable security definer set search_path=''
as $function$
  select coalesce(array_agg(q.reason order by q.sort_key),'{}'::text[])
  from (
    select 1 as sort_key,'missing_line_number'::text as reason
    from public.tfi_coding_dpr_entries e where e.id=p_entry_id and e.line_number is null
    union all
    select 10+i.lot_number,'incomplete_lot_'||i.lot_number::text
    from public.tfi_coding_dpr_items i
    where i.coding_dpr_entry_id=p_entry_id
      and ((i.production_date is null)::integer+(i.product_code is null)::integer+(i.quantity is null)::integer) between 1 and 2
    union all
    select 30+i.lot_number,'unmatched_product_code_lot_'||i.lot_number::text
    from public.tfi_coding_dpr_items i
    where i.coding_dpr_entry_id=p_entry_id and i.product_code is not null
      and not exists(
        select 1 from public.tfi_master_data_rows m
        where m.category_key='dpr_legend' and m.row_kind='data' and m.record_status='active'
          and (lower(btrim(coalesce(m.current_values->>7,'')))=lower(btrim(i.product_code))
            or lower(btrim(coalesce(m.current_values->>11,'')))=lower(btrim(i.product_code)))
      )
  ) q;
$function$;
revoke all on function private.tfi_coding_dpr_review_reasons(uuid) from public,anon,authenticated;

create or replace function private.tfi_coding_dpr_record_payload(p_entry_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $function$
  select jsonb_build_object(
    'id',e.id,
    'coding_date',e.coding_date,
    'line_number',e.line_number,
    'lots',coalesce((
      select jsonb_agg(jsonb_build_object(
        'lot_number',i.lot_number,
        'production_date',i.production_date,
        'product_code',i.product_code,
        'quantity',i.quantity,
        'product_code_reference_status',case
          when i.product_code is null then 'not_entered'
          when exists(
            select 1 from public.tfi_master_data_rows m
            where m.category_key='dpr_legend' and m.row_kind='data' and m.record_status='active'
              and (lower(btrim(coalesce(m.current_values->>7,'')))=lower(btrim(i.product_code))
                or lower(btrim(coalesce(m.current_values->>11,'')))=lower(btrim(i.product_code)))
          ) then 'matched' else 'unmatched' end
      ) order by i.lot_number)
      from public.tfi_coding_dpr_items i where i.coding_dpr_entry_id=e.id
    ),'[]'::jsonb),
    'total_quantity',coalesce((
      select sum(i.quantity) from public.tfi_coding_dpr_items i
      where i.coding_dpr_entry_id=e.id and i.lot_number between 1 and 6
    ),0),
    'batch7_quantity',coalesce((
      select sum(i.quantity) from public.tfi_coding_dpr_items i
      where i.coding_dpr_entry_id=e.id and i.lot_number=7
    ),0),
    'lot_count',(
      select count(*) from public.tfi_coding_dpr_items i where i.coding_dpr_entry_id=e.id
    ),
    'review_reasons',to_jsonb(private.tfi_coding_dpr_review_reasons(e.id)),
    'review_status',case when cardinality(private.tfi_coding_dpr_review_reasons(e.id))>0
      then 'needs_review' else 'unassessed' end,
    'source_import_row_id',e.source_import_row_id,
    'entry_source',e.entry_source,
    'version',e.version,
    'record_status',e.record_status,
    'created_at',e.created_at,
    'updated_at',e.updated_at,
    'created_by',e.created_by,
    'updated_by',e.updated_by
  )
  from public.tfi_coding_dpr_entries e where e.id=p_entry_id;
$function$;
revoke all on function private.tfi_coding_dpr_record_payload(uuid) from public,anon,authenticated;

create or replace function private.tfi_get_coding_dpr_catalog()
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_product_codes jsonb; v_line_numbers jsonb;
begin
  if auth.uid() is null or not private.tfi_has_permission('coding_dpr','view') then
    raise exception using errcode='42501',message='coding_dpr_view_permission_required';
  end if;
  select coalesce(jsonb_agg(code order by first_row),'[]'::jsonb) into v_product_codes
  from (
    select min(source_row_number) first_row,btrim(code_value) code
    from (
      select source_row_number,current_values->>7 code_value
      from public.tfi_master_data_rows
      where category_key='dpr_legend' and row_kind='data' and record_status='active'
      union all
      select source_row_number,current_values->>11 code_value
      from public.tfi_master_data_rows
      where category_key='dpr_legend' and row_kind='data' and record_status='active'
    ) c where nullif(btrim(code_value),'') is not null group by btrim(code_value)
  ) codes;
  select coalesce(jsonb_agg(line_number order by first_row),'[]'::jsonb) into v_line_numbers
  from (
    select min(source_row_number) first_row,btrim(current_values->>3) line_number
    from public.tfi_master_data_rows
    where category_key='dmp_legend' and row_kind='data' and record_status='active'
      and nullif(btrim(current_values->>3),'') is not null
    group by btrim(current_values->>3)
  ) lines;
  return jsonb_build_object(
    'product_codes',v_product_codes,
    'line_numbers',v_line_numbers,
    'source',jsonb_build_object(
      'spreadsheet_id','1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k',
      'worksheet','Coding DPR','sheet_id',1266086431,'range','Coding DPR!A1:X1000',
      'coding_date_column','A','line_number_column','B','batch_slots',7,
      'input_columns','A:W','derived_column','X',
      'source_total_batch_slots',jsonb_build_array(1,2,3,4,5,6),
      'batch_7_included_in_source_total',false
    )
  );
end;
$function$;
revoke all on function private.tfi_get_coding_dpr_catalog() from public,anon;
grant execute on function private.tfi_get_coding_dpr_catalog() to authenticated;
create or replace function public.tfi_get_coding_dpr_catalog()
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_get_coding_dpr_catalog(); $function$;
revoke all on function public.tfi_get_coding_dpr_catalog() from public,anon;
grant execute on function public.tfi_get_coding_dpr_catalog() to authenticated;

create or replace function private.tfi_get_coding_dpr_records(
  p_limit integer,p_offset integer,p_date_from date,p_date_to date,
  p_line_number text,p_product_code text,p_review_status text
)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_total integer; v_records jsonb;
begin
  if auth.uid() is null or not private.tfi_has_permission('coding_dpr','view') then
    raise exception using errcode='42501',message='coding_dpr_view_permission_required';
  end if;
  if p_limit is null or p_limit<1 or p_limit>100 or p_offset is null or p_offset<0 then
    raise exception using errcode='22023',message='coding_dpr_pagination_invalid';
  end if;
  if p_date_from is not null and p_date_to is not null and p_date_from>p_date_to then
    raise exception using errcode='22023',message='coding_dpr_date_filter_invalid';
  end if;
  if p_review_status is not null and p_review_status not in ('needs_review','unassessed') then
    raise exception using errcode='22023',message='coding_dpr_review_filter_invalid';
  end if;
  select count(*)::integer into v_total
  from public.tfi_coding_dpr_entries e
  where e.record_status='active'
    and (p_date_from is null or e.coding_date>=p_date_from)
    and (p_date_to is null or e.coding_date<=p_date_to)
    and (p_line_number is null or e.line_number=p_line_number)
    and (p_product_code is null or exists(
      select 1 from public.tfi_coding_dpr_items i
      where i.coding_dpr_entry_id=e.id and lower(i.product_code) like '%'||lower(p_product_code)||'%'
    ))
    and (p_review_status is null or
      case when cardinality(private.tfi_coding_dpr_review_reasons(e.id))>0 then 'needs_review' else 'unassessed' end=p_review_status);
  select coalesce(jsonb_agg(private.tfi_coding_dpr_record_payload(q.id) order by q.coding_date desc nulls last,q.created_at desc,q.id desc),'[]'::jsonb)
  into v_records
  from (
    select e.id,e.coding_date,e.created_at
    from public.tfi_coding_dpr_entries e
    where e.record_status='active'
      and (p_date_from is null or e.coding_date>=p_date_from)
      and (p_date_to is null or e.coding_date<=p_date_to)
      and (p_line_number is null or e.line_number=p_line_number)
      and (p_product_code is null or exists(
        select 1 from public.tfi_coding_dpr_items i
        where i.coding_dpr_entry_id=e.id and lower(i.product_code) like '%'||lower(p_product_code)||'%'
      ))
      and (p_review_status is null or
        case when cardinality(private.tfi_coding_dpr_review_reasons(e.id))>0 then 'needs_review' else 'unassessed' end=p_review_status)
    order by e.coding_date desc nulls last,e.created_at desc,e.id desc
    limit p_limit offset p_offset
  ) q;
  return jsonb_build_object('records',v_records,'total_count',v_total);
end;
$function$;
revoke all on function private.tfi_get_coding_dpr_records(integer,integer,date,date,text,text,text) from public,anon;
grant execute on function private.tfi_get_coding_dpr_records(integer,integer,date,date,text,text,text) to authenticated;
create or replace function public.tfi_get_coding_dpr_records(
  p_limit integer,p_offset integer,p_date_from date,p_date_to date,
  p_line_number text,p_product_code text,p_review_status text
)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_get_coding_dpr_records($1,$2,$3,$4,$5,$6,$7); $function$;
revoke all on function public.tfi_get_coding_dpr_records(integer,integer,date,date,text,text,text) from public,anon;
grant execute on function public.tfi_get_coding_dpr_records(integer,integer,date,date,text,text,text) to authenticated;

create or replace function private.tfi_get_coding_dpr_record(p_record_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_record jsonb;
begin
  if auth.uid() is null or not private.tfi_has_permission('coding_dpr','view') then
    raise exception using errcode='42501',message='coding_dpr_view_permission_required';
  end if;
  select private.tfi_coding_dpr_record_payload(p_record_id) into v_record
  from public.tfi_coding_dpr_entries e where e.id=p_record_id and e.record_status='active';
  return v_record;
end;
$function$;
revoke all on function private.tfi_get_coding_dpr_record(uuid) from public,anon;
grant execute on function private.tfi_get_coding_dpr_record(uuid) to authenticated;
create or replace function public.tfi_get_coding_dpr_record(p_record_id uuid)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_get_coding_dpr_record($1); $function$;
revoke all on function public.tfi_get_coding_dpr_record(uuid) from public,anon;
grant execute on function public.tfi_get_coding_dpr_record(uuid) to authenticated;

create or replace function private.tfi_create_coding_dpr_records(p_records jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_item jsonb;v_data jsonb;v_lot jsonb;v_lots jsonb;v_index integer;v_lot_index integer;v_row_index integer;
  v_date date;v_line text;v_lot_date date;v_code text;v_quantity numeric;v_fingerprint text;v_id uuid;
  v_context jsonb;v_after jsonb;v_inserted integer:=0;v_duplicates integer:=0;v_empty integer:=0;v_results jsonb:='[]'::jsonb;
begin
  if auth.uid() is null or not private.tfi_has_permission('coding_dpr','view')
    or not private.tfi_has_permission('coding_dpr','create') then
    raise exception using errcode='42501',message='coding_dpr_create_permission_required';
  end if;
  if p_records is null or jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)<1 or jsonb_array_length(p_records)>50 then
    raise exception using errcode='22023',message='coding_dpr_rows_required';
  end if;
  v_context:=private.tfi_get_my_access_context();
  for v_item,v_index in select value,ordinality::integer from jsonb_array_elements(p_records) with ordinality loop
    if jsonb_typeof(v_item)<>'object' or exists(select 1 from jsonb_object_keys(v_item) k where k not in ('row_index','record_data'))
      or jsonb_typeof(v_item->'record_data')<>'object' then
      raise exception using errcode='22023',message='coding_dpr_row_shape_invalid';
    end if;
    v_data:=v_item->'record_data';
    v_row_index:=coalesce(nullif(v_item->>'row_index','')::integer,v_index);
    if v_row_index<1 or v_row_index>1000 then raise exception using errcode='22023',message='coding_dpr_row_index_invalid'; end if;
    if exists(select 1 from jsonb_object_keys(v_data) k where k not in ('coding_date','line_number','lots')) then
      raise exception using errcode='22023',message='coding_dpr_unknown_or_derived_field';
    end if;
    begin
      v_date:=nullif(btrim(v_data->>'coding_date'),'')::date;
      v_line:=nullif(btrim(v_data->>'line_number'),'');
    exception when others then raise exception using errcode='22023',message='coding_dpr_invalid_field_value'; end;
    if v_line is not null and (length(v_line)>20 or not exists(
      select 1 from public.tfi_master_data_rows m where m.category_key='dmp_legend' and m.row_kind='data'
        and m.record_status='active' and btrim(coalesce(m.current_values->>3,''))=v_line
    )) then raise exception using errcode='22023',message='coding_dpr_invalid_line_number'; end if;
    if jsonb_typeof(v_data->'lots')<>'array' or jsonb_array_length(v_data->'lots')<>7 then
      raise exception using errcode='22023',message='coding_dpr_requires_seven_lot_slots';
    end if;
    v_lots:='[]'::jsonb;
    for v_lot,v_lot_index in select value,ordinality::integer from jsonb_array_elements(v_data->'lots') with ordinality loop
      if jsonb_typeof(v_lot)<>'object' or exists(select 1 from jsonb_object_keys(v_lot) k where k not in ('lot_number','production_date','product_code','quantity')) then
        raise exception using errcode='22023',message='coding_dpr_lot_shape_invalid';
      end if;
      begin
        if (v_lot->>'lot_number')::integer<>v_lot_index then raise exception using errcode='22023',message='coding_dpr_lot_order_invalid'; end if;
        v_lot_date:=nullif(btrim(v_lot->>'production_date'),'')::date;
        v_code:=nullif(btrim(v_lot->>'product_code'),'');
        v_quantity:=nullif(v_lot->>'quantity','')::numeric;
      exception when others then raise exception using errcode='22023',message='coding_dpr_invalid_lot_value'; end;
      if (v_code is not null and length(v_code)>100)
        or (v_quantity is not null and (v_quantity<0 or v_quantity::text !~ '^[0-9]+([.][0-9]{1,4})?$')) then
        raise exception using errcode='22023',message='coding_dpr_invalid_lot_value';
      end if;
      v_lots:=v_lots||jsonb_build_array(jsonb_build_object(
        'lot_number',v_lot_index,'production_date',v_lot_date,'product_code',v_code,'quantity',v_quantity
      ));
    end loop;
    if v_date is null and v_line is null and not exists(
      select 1 from jsonb_array_elements(v_lots) x
      where nullif(x->>'production_date','') is not null or nullif(x->>'product_code','') is not null or nullif(x->>'quantity','') is not null
    ) then
      v_empty:=v_empty+1;
      v_results:=v_results||jsonb_build_array(jsonb_build_object('row_index',v_row_index,'status','empty'));
      continue;
    end if;
    v_fingerprint:=md5(jsonb_build_object(
      'coding_date',v_date,'line_number',lower(coalesce(v_line,'')),'lots',v_lots
    )::text);
    v_id:=null;
    insert into public.tfi_coding_dpr_entries(
      coding_date,line_number,record_fingerprint,entry_source,created_by,updated_by
    ) values(v_date,v_line,v_fingerprint,'manual',auth.uid(),auth.uid())
    on conflict(record_fingerprint) do nothing returning id into v_id;
    if v_id is null then
      v_duplicates:=v_duplicates+1;
      v_results:=v_results||jsonb_build_array(jsonb_build_object('row_index',v_row_index,'status','duplicate'));
      continue;
    end if;
    insert into public.tfi_coding_dpr_items(coding_dpr_entry_id,lot_number,production_date,product_code,quantity)
    select v_id,x.lot_number,x.production_date,x.product_code,x.quantity
    from jsonb_to_recordset(v_lots) as x(lot_number smallint,production_date date,product_code text,quantity numeric)
    where x.production_date is not null or x.product_code is not null or x.quantity is not null;
    v_after:=private.tfi_coding_dpr_record_payload(v_id);
    insert into public.tfi_audit_events(
      actor_user_id,actor_email_snapshot,actor_roles_snapshot,action_key,module_key,entity_type,entity_id,
      before_data,after_data,metadata,occurred_at
    ) values(
      auth.uid(),v_context #>> '{profile,email}',coalesce(v_context->'roles','[]'::jsonb),
      'coding_dpr.create','coding_dpr','coding_dpr_entry',v_id::text,null,v_after,
      jsonb_build_object('row_index',v_row_index,'entry_source','manual'),now()
    );
    v_inserted:=v_inserted+1;
    v_results:=v_results||jsonb_build_array(jsonb_build_object(
      'row_index',v_row_index,'status','inserted','id',v_id,'review_status',v_after->>'review_status'
    ));
  end loop;
  return jsonb_build_object('inserted',v_inserted,'duplicates',v_duplicates,'empty',v_empty,'results',v_results);
end;
$function$;
revoke all on function private.tfi_create_coding_dpr_records(jsonb) from public,anon;
grant execute on function private.tfi_create_coding_dpr_records(jsonb) to authenticated;
create or replace function public.tfi_create_coding_dpr_records(p_records jsonb)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_create_coding_dpr_records($1); $function$;
revoke all on function public.tfi_create_coding_dpr_records(jsonb) from public,anon;
grant execute on function public.tfi_create_coding_dpr_records(jsonb) to authenticated;

create or replace function private.tfi_update_coding_dpr_record(
  p_record_id uuid,p_expected_version integer,p_changes jsonb,p_change_reason text default null
)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_row public.tfi_coding_dpr_entries%rowtype;v_user_id uuid:=auth.uid();v_context jsonb;
  v_date date;v_line text;v_lot jsonb;v_lots jsonb;v_lot_index integer;v_lot_date date;v_code text;v_quantity numeric;
  v_fingerprint text;v_before jsonb;v_after jsonb;v_changed text[]:=array[]::text[];v_version integer;
begin
  if v_user_id is null or not private.tfi_has_permission('coding_dpr','view')
    or not private.tfi_has_permission('coding_dpr','edit') then
    raise exception using errcode='42501',message='coding_dpr_edit_permission_required';
  end if;
  if p_expected_version is null or p_expected_version<1 or p_changes is null or jsonb_typeof(p_changes)<>'object'
    or exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('coding_date','line_number','lots')) then
    raise exception using errcode='22023',message='coding_dpr_update_request_invalid';
  end if;
  select * into v_row from public.tfi_coding_dpr_entries where id=p_record_id and record_status='active' for update;
  if not found then raise exception using errcode='P0002',message='coding_dpr_record_not_found'; end if;
  if v_row.version<>p_expected_version then raise exception using errcode='40001',message='coding_dpr_version_conflict'; end if;
  begin
    v_date:=nullif(btrim(p_changes->>'coding_date'),'')::date;
    v_line:=nullif(btrim(p_changes->>'line_number'),'');
  exception when others then raise exception using errcode='22023',message='coding_dpr_invalid_field_value'; end;
  if v_line is not null and (length(v_line)>20 or not exists(
    select 1 from public.tfi_master_data_rows m where m.category_key='dmp_legend' and m.row_kind='data'
      and m.record_status='active' and btrim(coalesce(m.current_values->>3,''))=v_line
  )) then raise exception using errcode='22023',message='coding_dpr_invalid_line_number'; end if;
  if jsonb_typeof(p_changes->'lots')<>'array' or jsonb_array_length(p_changes->'lots')<>7 then
    raise exception using errcode='22023',message='coding_dpr_requires_seven_lot_slots';
  end if;
  v_lots:='[]'::jsonb;
  for v_lot,v_lot_index in select value,ordinality::integer from jsonb_array_elements(p_changes->'lots') with ordinality loop
    if jsonb_typeof(v_lot)<>'object' or exists(select 1 from jsonb_object_keys(v_lot) k where k not in ('lot_number','production_date','product_code','quantity')) then
      raise exception using errcode='22023',message='coding_dpr_lot_shape_invalid';
    end if;
    begin
      if (v_lot->>'lot_number')::integer<>v_lot_index then raise exception using errcode='22023',message='coding_dpr_lot_order_invalid'; end if;
      v_lot_date:=nullif(btrim(v_lot->>'production_date'),'')::date;
      v_code:=nullif(btrim(v_lot->>'product_code'),'');
      v_quantity:=nullif(v_lot->>'quantity','')::numeric;
    exception when others then raise exception using errcode='22023',message='coding_dpr_invalid_lot_value'; end;
    if (v_code is not null and length(v_code)>100)
      or (v_quantity is not null and (v_quantity<0 or v_quantity::text !~ '^[0-9]+([.][0-9]{1,4})?$')) then
      raise exception using errcode='22023',message='coding_dpr_invalid_lot_value';
    end if;
    v_lots:=v_lots||jsonb_build_array(jsonb_build_object(
      'lot_number',v_lot_index,'production_date',v_lot_date,'product_code',v_code,'quantity',v_quantity
    ));
  end loop;
  v_fingerprint:=md5(jsonb_build_object(
    'coding_date',v_date,'line_number',lower(coalesce(v_line,'')),'lots',v_lots
  )::text);
  if v_fingerprint=v_row.record_fingerprint then
    return jsonb_build_object('changed',false,'id',v_row.id,'version',v_row.version);
  end if;
  v_before:=private.tfi_coding_dpr_record_payload(v_row.id);
  if v_date is distinct from v_row.coding_date then v_changed:=array_append(v_changed,'coding_date'); end if;
  if v_line is distinct from v_row.line_number then v_changed:=array_append(v_changed,'line_number'); end if;
  v_changed:=array_append(v_changed,'lots');
  v_version:=v_row.version+1;
  update public.tfi_coding_dpr_entries set coding_date=v_date,line_number=v_line,
    record_fingerprint=v_fingerprint,version=v_version,updated_at=now(),updated_by=v_user_id
  where id=v_row.id;
  delete from public.tfi_coding_dpr_items where coding_dpr_entry_id=v_row.id;
  insert into public.tfi_coding_dpr_items(coding_dpr_entry_id,lot_number,production_date,product_code,quantity)
  select v_row.id,x.lot_number,x.production_date,x.product_code,x.quantity
  from jsonb_to_recordset(v_lots) as x(lot_number smallint,production_date date,product_code text,quantity numeric)
  where x.production_date is not null or x.product_code is not null or x.quantity is not null;
  v_after:=private.tfi_coding_dpr_record_payload(v_row.id);
  insert into public.tfi_coding_dpr_revisions(
    coding_dpr_entry_id,version,before_data,after_data,changed_fields,change_reason,changed_by
  ) values(
    v_row.id,v_version,v_before,v_after,v_changed,
    nullif(left(btrim(coalesce(p_change_reason,'')),500),''),v_user_id
  );
  v_context:=private.tfi_get_my_access_context();
  insert into public.tfi_audit_events(
    actor_user_id,actor_email_snapshot,actor_roles_snapshot,action_key,module_key,entity_type,entity_id,
    before_data,after_data,metadata,occurred_at
  ) values(
    v_user_id,v_context #>> '{profile,email}',coalesce(v_context->'roles','[]'::jsonb),
    'coding_dpr.update','coding_dpr','coding_dpr_entry',v_row.id::text,
    v_before,v_after,jsonb_build_object('changed_fields',to_jsonb(v_changed),
      'change_reason',nullif(left(btrim(coalesce(p_change_reason,'')),500),'')),now()
  );
  return jsonb_build_object('changed',true,'id',v_row.id,'version',v_version,'review_status',v_after->>'review_status');
exception when unique_violation then
  raise exception using errcode='23505',message='coding_dpr_duplicate_record';
end;
$function$;
revoke all on function private.tfi_update_coding_dpr_record(uuid,integer,jsonb,text) from public,anon;
grant execute on function private.tfi_update_coding_dpr_record(uuid,integer,jsonb,text) to authenticated;
create or replace function public.tfi_update_coding_dpr_record(
  p_record_id uuid,p_expected_version integer,p_changes jsonb,p_change_reason text default null
)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_update_coding_dpr_record($1,$2,$3,$4); $function$;
revoke all on function public.tfi_update_coding_dpr_record(uuid,integer,jsonb,text) from public,anon;
grant execute on function public.tfi_update_coding_dpr_record(uuid,integer,jsonb,text) to authenticated;