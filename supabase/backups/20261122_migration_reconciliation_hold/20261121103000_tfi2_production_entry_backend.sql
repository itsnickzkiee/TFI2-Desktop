-- TFI2 Phase 5 — Production Entry + Production Summary.
-- Additive only. Uses the verified 12-row Production Entry form and 24-column summary.
-- No historical workbook rows are imported or changed.

begin;

create table public.tfi_production_entry_catalog (
  catalog_key text primary key check (catalog_key = 'source'),
  catalog_data jsonb not null check (jsonb_typeof(catalog_data) = 'object'),
  updated_at timestamptz not null default now()
);

insert into public.tfi_production_entry_catalog (catalog_key,catalog_data)
values (
  'source',
  $tfi_production_entry_catalog${
  "manifest_version": "2026-11-21-v1",
  "source": {
    "workbook": "Copy of TFI - Production Monitoring Sheet 1",
    "spreadsheet_id": "1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k",
    "production_entry": {
      "sheet_title": "Production Entry",
      "sheet_id": 1923467491,
      "source_range": "Production Entry!A1:W19",
      "source_data_rows": [
        8,
        19
      ],
      "source_column_count": 23
    },
    "production_summary": {
      "sheet_title": "Production Summary",
      "sheet_id": 1846667474,
      "header_row": 6,
      "first_data_row": 7,
      "last_known_grid_row": 13188,
      "source_column_count": 24,
      "source_range": "Production Summary!A1:X13188"
    },
    "legend": {
      "sheet_title": "DPR LEGEND",
      "sheet_id": 508797580,
      "product_name_range": "DPR LEGEND!I2:AN2",
      "product_code_range": "DPR LEGEND!I3:AN100"
    }
  },
  "form": {
    "title": "OPENING & CLOSING REPORT",
    "date_input": "A",
    "lines": [
      {
        "line": "Agri",
        "count": 4,
        "source_rows": [
          8,
          9,
          10,
          11
        ]
      },
      {
        "line": "Meat",
        "count": 4,
        "source_rows": [
          12,
          13,
          14,
          15
        ]
      },
      {
        "line": "Finishing",
        "count": 4,
        "source_rows": [
          16,
          17,
          18,
          19
        ]
      }
    ],
    "slots": [
      {
        "source_row_number": 8,
        "line": "Agri",
        "line_slot": 1
      },
      {
        "source_row_number": 9,
        "line": "Agri",
        "line_slot": 2
      },
      {
        "source_row_number": 10,
        "line": "Agri",
        "line_slot": 3
      },
      {
        "source_row_number": 11,
        "line": "Agri",
        "line_slot": 4
      },
      {
        "source_row_number": 12,
        "line": "Meat",
        "line_slot": 1
      },
      {
        "source_row_number": 13,
        "line": "Meat",
        "line_slot": 2
      },
      {
        "source_row_number": 14,
        "line": "Meat",
        "line_slot": 3
      },
      {
        "source_row_number": 15,
        "line": "Meat",
        "line_slot": 4
      },
      {
        "source_row_number": 16,
        "line": "Finishing",
        "line_slot": 1
      },
      {
        "source_row_number": 17,
        "line": "Finishing",
        "line_slot": 2
      },
      {
        "source_row_number": 18,
        "line": "Finishing",
        "line_slot": 3
      },
      {
        "source_row_number": 19,
        "line": "Finishing",
        "line_slot": 4
      }
    ],
    "source_headers": [
      "Date",
      "Line",
      "Product Name",
      "Product Code",
      "No. of Batches",
      "Target",
      "Produced",
      "UOM",
      "% Attainment",
      "Plan Start",
      "Actual Start",
      "Plan End",
      "Actual End (Prod)",
      "Actual End (Cleaning)",
      "Man Reqmt",
      "Present",
      "Absent",
      "% Attendance",
      "OT Hrs",
      "Remarks / Reasons (Delay, <95%, Co-run, PD)",
      "Source Tab",
      "Check",
      "Has data"
    ],
    "source_groups": [
      {
        "title": "PRODUCT",
        "start": 1,
        "end": 4,
        "tone": "dark"
      },
      {
        "title": "PRODUCTION (PLAN vs ACTUAL)",
        "start": 5,
        "end": 9,
        "tone": "teal"
      },
      {
        "title": "TIME",
        "start": 10,
        "end": 14,
        "tone": "dark"
      },
      {
        "title": "MANPOWER & OT (1st row of line per day)",
        "start": 15,
        "end": 19,
        "tone": "teal"
      },
      {
        "title": "REMARKS",
        "start": 20,
        "end": 20,
        "tone": "dark"
      },
      {
        "title": "TRACE",
        "start": 21,
        "end": 23,
        "tone": "teal"
      }
    ]
  },
  "summary": {
    "headers": [
      "Date",
      "Line",
      "Product Name",
      "Product Code",
      "No. of Batches",
      "Target",
      "Produced",
      "UOM",
      "% Attainment",
      "Plan Start",
      "Actual Start",
      "Plan End",
      "Actual End (Prod)",
      "Actual End (Cleaning)",
      "Man Reqmt",
      "Present",
      "Absent",
      "% Attendance",
      "OT Hrs",
      "Remarks / Reasons (Delay, <95%, Co-run, PD)",
      "Saved on",
      "Check",
      "Has data",
      "Day has data"
    ],
    "groups": [
      {
        "title": "PRODUCT",
        "start": 1,
        "end": 4
      },
      {
        "title": "PRODUCTION (PLAN VS ACTUAL)",
        "start": 5,
        "end": 9
      },
      {
        "title": "TIME",
        "start": 10,
        "end": 14
      },
      {
        "title": "MANPOWER & OT (1ST ROW OF LINE PER DAY)",
        "start": 15,
        "end": 19
      },
      {
        "title": "REMARKS",
        "start": 20,
        "end": 20
      },
      {
        "title": "TRACE",
        "start": 21,
        "end": 24
      }
    ]
  },
  "product_names": [
    "Green Peas & Dry Peas",
    "Garbanzos",
    "Mayon Sweet Beans",
    "Mayon Red Monggo Beans",
    "Black Beans",
    "Pork/Beef and Beans",
    "Baked Beans",
    "Tomato Paste",
    "Cream Style Corn",
    "Whole Kernel Corn",
    "Philips Meat Loaf",
    "Seniorita Beef/Meat Loaf Low Cost Generic",
    "Seniorita Liver Spread",
    "Philips Gold Liver Spread",
    "Mang Rene Liver Spread",
    "Seniorita Beef/Meat Loaf Regular",
    "Maharlika Luncheon Meat",
    "Seniorita Corned Beef Low Cost",
    "Seniorita Carne Norte",
    "Seniorita Corned Beef Premium",
    "Seniorita Corned Beef Reg",
    "Landers Premium Corned Beef",
    "American Corned Beef ",
    "Seniorita Luncheon Meat",
    "Philips Gold Premium Luncheon Meat",
    "Philips Frankfurter/HMPS",
    "Seniorita Vienna Sausage",
    "Laing",
    "Nata de Coco",
    "Maharlika Roast Beef",
    "Whole Peeled Tomato",
    "Aguila Corned Beef"
  ],
  "product_codes": {
    "Green Peas & Dry Peas": [
      "MDP-100-155",
      "MDP-48-225",
      "MDP-24-425",
      "SDP-100-155",
      "SDP-48-225",
      "SDP-24-425",
      "PGP-100-155",
      "MGP-48-225",
      "MGP-24-425",
      "CDP-100-155",
      "MGPE-48-225",
      "SDPE-24-425",
      "SDPE-48-225",
      "MGPE-24-425",
      "SDPE-100-155",
      "MDPE-100-155"
    ],
    "Garbanzos": [
      "MGB-48-225",
      "MGB-24-425",
      "MGBE-48-225",
      "MGBE-24-425",
      "MGBE-48-425",
      "MGB-6-2800",
      "MSGB-24-380"
    ],
    "Mayon Sweet Beans": [
      "MSB-24-380"
    ],
    "Mayon Red Monggo Beans": [
      "TMRMB-24-380"
    ],
    "Black Beans": [
      "SBB-48-180",
      "SBB-100-110",
      "PGBB-50-110",
      "CBB-100-180"
    ],
    "Pork/Beef and Beans": [
      "SPB-50-165",
      "SPB-48-225",
      "SPB-24-425",
      "SPB-12-900",
      "PGPB-50-165",
      "PGPB-50-225",
      "SBNB-50-165",
      "UBBSTS-48-225",
      "PPBT-50-165"
    ],
    "Baked Beans": [
      "Baked Beans-225",
      "ABB-50-175",
      "ABB-48-230",
      "UBBSTS-48-225",
      "ABB-6-2600",
      "MSB-24-380"
    ],
    "Tomato Paste": [
      "STP-48-155",
      "TMTPDC-24-400"
    ],
    "Cream Style Corn": [
      "MCS-24-425",
      "ISCS-24-425",
      "TMCCS-24-425"
    ],
    "Whole Kernel Corn": [
      "MWKC-24-425",
      "ISWK-24-425",
      "MWKC-6-2800",
      "MWKC-6-2950"
    ],
    "Philips Meat Loaf": [
      "PML-50-150",
      "PML-48-200"
    ],
    "Seniorita Beef/Meat Loaf Low Cost Generic": [
      "SMLD-100-150",
      "SMLD-48-150",
      "SBLD-48-150",
      "ISBL-48-150",
      "SML-48-210",
      "TSLG-48-150",
      "TSLG-100-150"
    ],
    "Seniorita Liver Spread": [
      "SLS-100-85",
      "SLS-12-900",
      "SLS-24-350",
      "SCLS-100-85"
    ],
    "Philips Gold Liver Spread": [
      "PGLS-50-85",
      "PLST-50-85"
    ],
    "Mang Rene Liver Spread": [
      "MRLS-48-85"
    ],
    "Seniorita Beef/Meat Loaf Regular": [
      "SML-48-150",
      "SBL-48-150",
      "SML-48-210"
    ],
    "Maharlika Luncheon Meat": [
      "MLM-24-350"
    ],
    "Seniorita Corned Beef Low Cost": [
      "SCB-100-150",
      "SCBD-48-150"
    ],
    "Seniorita Carne Norte": [
      "SCN-48-150",
      "SCN-100-100"
    ],
    "Seniorita Corned Beef Premium": [
      "SPCB-48-150"
    ],
    "Seniorita Corned Beef Reg": [
      "SCBR-48-150",
      "TSCBG-100-150",
      "TSCB-48-260",
      "TSCB-48-150"
    ],
    "Landers Premium Corned Beef": [
      "BCBCE-24-380",
      "BCBCGE-24-380",
      "LPCBR-24-380",
      "LPCBS-24-380"
    ],
    "American Corned Beef ": [
      "ACBR-48-150",
      "ACBR-48-210",
      "TACB-30-380",
      "TACB-48-210",
      "TACB-48-150",
      "TACB-12-1800",
      "TACBS-48-150",
      "TACBC-48-150"
    ],
    "Seniorita Luncheon Meat": [
      "SLM-24-350"
    ],
    "Philips Gold Premium Luncheon Meat": [
      "PGPLM-24-350"
    ],
    "Philips Frankfurter/HMPS": [
      "PF-24-225",
      "HMPS"
    ],
    "Seniorita Vienna Sausage": [
      "SVS-48-70",
      "SVS-48-114",
      "SVST-48-70",
      "SCVT-48-70"
    ],
    "Laing": [
      "MLCM-48-155"
    ],
    "Nata de Coco": [
      "TMNDCR-24-380",
      "TMNDCW-24-380",
      "TMNDCG-24-380",
      "TMNDCP-24-380",
      "TMNDCR-24-425",
      "TMNDCW-24-425",
      "TMNDCG-24-425",
      "TMNDCP-24-425",
      "TMKG-24-380",
      "TMKR-24-380"
    ],
    "Maharlika Roast Beef": [
      "MRB-24-380"
    ],
    "Whole Peeled Tomato": [
      "TMWPT-6-2800"
    ],
    "Aguila Corned Beef": [
      "AGCBE-24-350",
      "AGCGCBE-24-350",
      "PLACBT-24-350",
      "PLACBS-24-350"
    ]
  },
  "uom": [
    "can",
    "case",
    "batch",
    "ton",
    "kg"
  ],
  "input_columns": [
    "A",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "S",
    "T"
  ],
  "computed_columns": [
    "I",
    "Q",
    "R",
    "W"
  ],
  "source_formula_columns": [
    "A",
    "I",
    "Q",
    "R",
    "W"
  ],
  "formulas": {
    "attainment": "IF(AND(ISNUMBER(F),ISNUMBER(G),F>0),G/F,'')",
    "absent": "IF(AND(ISNUMBER(O),ISNUMBER(P)),O-P,'')",
    "attendance": "IF(AND(ISNUMBER(O),ISNUMBER(P),O>0),P/O,'')",
    "has_data": "OR(C,D,F,G,O,P,S,T are nonblank)"
  },
  "has_data_columns": [
    "C",
    "D",
    "F",
    "G",
    "O",
    "P",
    "S",
    "T"
  ],
  "trace_columns": {
    "production_entry": {
      "U": "Source Tab",
      "V": "Check",
      "W": "Has data"
    },
    "production_summary": {
      "U": "Saved on",
      "V": "Check",
      "W": "Has data",
      "X": "Day has data"
    }
  },
  "notes": [
    "One form contains 12 fixed source slots: four each for Agri, Meat, and Finishing.",
    "The date is entered once at form level and is copied into column A for each saved run.",
    "Column B is derived from the fixed source row slot and is not user-editable.",
    "Product Code choices depend on Product Name and use the exact product-specific DPR LEGEND lists.",
    "Only rows where at least one of C, D, F, G, O, P, S, or T is nonblank satisfy the source Has data formula and are saved.",
    "I, Q, R, and W are computed by TFI2 from the source formulas. A is a form-level date input, not a per-row field.",
    "Production Summary columns V (Check) and X (Day has data) are preserved as null until their exact source formulas or business rules are verified. No formula is invented for them.",
    "The old preview snapshot values are not live data and are intentionally excluded from the TFI2 catalog and KPI calculations."
  ]
}$tfi_production_entry_catalog$::jsonb
)
on conflict (catalog_key) do update
set catalog_data = excluded.catalog_data, updated_at = now();

create table public.tfi_production_entry_records (
  id uuid primary key default gen_random_uuid(),
  entry_batch_id uuid not null,
  source_row_number smallint not null check (source_row_number between 8 and 19),
  production_date date,
  line text not null check (line in ('Agri','Meat','Finishing')),
  product_name text check (product_name is null or length(product_name) <= 200),
  product_code text check (product_code is null or length(product_code) <= 100),
  batches numeric,
  target numeric,
  produced numeric,
  uom text check (uom is null or uom in ('can','case','batch','ton','kg')),
  attainment numeric,
  plan_start time without time zone,
  actual_start time without time zone,
  plan_end time without time zone,
  actual_end_prod time without time zone,
  actual_end_cleaning time without time zone,
  manpower_required numeric,
  present numeric,
  absent numeric,
  attendance numeric,
  ot_hours numeric,
  remarks text check (remarks is null or length(remarks) <= 1000),
  saved_on timestamptz not null default now(),
  check_value text,
  has_data boolean not null default true check (has_data),
  day_has_data boolean,
  record_data jsonb not null check (jsonb_typeof(record_data) = 'object'),
  record_fingerprint text not null check (record_fingerprint ~ '^[0-9a-f]{64}$'),
  completeness_status text not null default 'unassessed'
    check (completeness_status in ('complete','incomplete','unassessed')),
  blank_fields text[] not null default '{}',
  record_status text not null default 'active'
    check (record_status in ('active','archived')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint tfi_production_entry_record_fingerprint_key unique (record_fingerprint),
  constraint tfi_production_entry_archive_state check (
    (record_status = 'archived' and archived_at is not null)
    or (record_status <> 'archived' and archived_at is null)
  ),
  constraint tfi_production_entry_nonnegative_inputs check (
    (batches is null or batches >= 0)
    and (target is null or target >= 0)
    and (produced is null or produced >= 0)
    and (manpower_required is null or manpower_required >= 0)
    and (present is null or present >= 0)
    and (ot_hours is null or ot_hours >= 0)
  )
);

create index tfi_production_entry_date_idx
  on public.tfi_production_entry_records (production_date desc nulls last, saved_on desc);
create index tfi_production_entry_line_idx
  on public.tfi_production_entry_records (line, production_date desc nulls last);
create index tfi_production_entry_product_name_idx
  on public.tfi_production_entry_records (product_name);
create index tfi_production_entry_product_code_idx
  on public.tfi_production_entry_records (product_code);
create index tfi_production_entry_created_by_idx
  on public.tfi_production_entry_records (created_by);
create index tfi_production_entry_batch_idx
  on public.tfi_production_entry_records (entry_batch_id);
create index tfi_production_entry_active_date_idx
  on public.tfi_production_entry_records (production_date desc nulls last, source_row_number, saved_on desc)
  where record_status = 'active';

create table public.tfi_production_entry_revisions (
  id uuid primary key default gen_random_uuid(),
  production_entry_record_id uuid not null
    references public.tfi_production_entry_records(id) on delete restrict,
  version integer not null check (version > 1),
  before_data jsonb not null check (jsonb_typeof(before_data) = 'object'),
  after_data jsonb not null check (jsonb_typeof(after_data) = 'object'),
  changed_columns text[] not null check (cardinality(changed_columns) > 0),
  change_reason text check (change_reason is null or length(change_reason) <= 500),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  unique (production_entry_record_id,version)
);
create index tfi_production_entry_revisions_row_order_idx
  on public.tfi_production_entry_revisions (production_entry_record_id,version desc);
create index tfi_production_entry_revisions_changed_by_idx
  on public.tfi_production_entry_revisions (changed_by);

comment on table public.tfi_production_entry_catalog is
  'Verified Production Entry and Production Summary source contract, including product-specific DPR LEGEND code options.';
comment on table public.tfi_production_entry_records is
  'New Production Entry runs saved to the 24-column Production Summary register. Only source Has data rows are persisted. No hard-delete path.';
comment on table public.tfi_production_entry_revisions is
  'Append-only before/after history for Production Entry edits.';

alter table public.tfi_production_entry_catalog enable row level security;
alter table public.tfi_production_entry_records enable row level security;
alter table public.tfi_production_entry_revisions enable row level security;

create policy tfi_production_entry_catalog_authorized_read
on public.tfi_production_entry_catalog for select to authenticated
using (private.tfi_has_permission('production_entry','view'));

create policy tfi_production_entry_records_authorized_read
on public.tfi_production_entry_records for select to authenticated
using (private.tfi_has_permission('production_entry','view'));

create policy tfi_production_entry_revisions_authorized_read
on public.tfi_production_entry_revisions for select to authenticated
using (private.tfi_has_permission('production_entry','view'));

revoke all on public.tfi_production_entry_catalog,
  public.tfi_production_entry_records,
  public.tfi_production_entry_revisions
from public, anon, authenticated;

grant select on public.tfi_production_entry_catalog,
  public.tfi_production_entry_records,
  public.tfi_production_entry_revisions
to authenticated;

create or replace function private.tfi_production_entry_fingerprint(
  p_source_row_number smallint,
  p_input_data jsonb
) returns text
language sql immutable security invoker set search_path to ''
as $function$
  select encode(
    extensions.digest(
      convert_to(jsonb_build_array(p_source_row_number,p_input_data)::text,'UTF8'),
      'sha256'
    ),
    'hex'
  );
$function$;
revoke all on function private.tfi_production_entry_fingerprint(smallint,jsonb)
from public, anon, authenticated;

create or replace function private.tfi_create_production_entry_records(p_records jsonb)
returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_context jsonb;
  v_catalog jsonb;
  v_item jsonb;
  v_index integer;
  v_source_row_number smallint;
  v_line text;
  v_data jsonb;
  v_input_data jsonb;
  v_record_data jsonb;
  v_date date;
  v_product_name text;
  v_product_code text;
  v_batches numeric;
  v_target numeric;
  v_produced numeric;
  v_uom text;
  v_plan_start time;
  v_actual_start time;
  v_plan_end time;
  v_actual_end_prod time;
  v_actual_end_cleaning time;
  v_manpower_required numeric;
  v_present numeric;
  v_ot_hours numeric;
  v_remarks text;
  v_attainment numeric;
  v_absent numeric;
  v_attendance numeric;
  v_has_data boolean;
  v_saved_on timestamptz;
  v_fingerprint text;
  v_id uuid;
  v_batch_id uuid := gen_random_uuid();
  v_seen_rows smallint[] := '{}';
  v_blank_fields text[];
  v_after jsonb;
  v_results jsonb := '[]'::jsonb;
  v_inserted integer := 0;
  v_duplicates integer := 0;
  v_empty integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if not private.tfi_has_permission('production_entry','view')
     or not private.tfi_has_permission('production_entry','create') then
    raise exception using errcode = '42501', message = 'production_entry_create_permission_required';
  end if;
  if p_records is null or jsonb_typeof(p_records) <> 'array'
     or jsonb_array_length(p_records) < 1 or jsonb_array_length(p_records) > 12 then
    raise exception using errcode = '22023', message = 'production_entry_rows_required';
  end if;

  select catalog_data into v_catalog
  from public.tfi_production_entry_catalog where catalog_key='source';
  if v_catalog is null then
    raise exception using errcode = 'P0001', message = 'production_entry_catalog_missing';
  end if;
  v_context := private.tfi_get_my_access_context();

  for v_item, v_index in
    select value, ordinality::integer
    from jsonb_array_elements(p_records) with ordinality
  loop
    if jsonb_typeof(v_item) <> 'object'
       or not (v_item ? 'source_row_number')
       or not (v_item ? 'record_data') then
      raise exception using errcode = '22023', message = 'production_entry_invalid_row_shape';
    end if;
    if exists (
      select 1 from jsonb_object_keys(v_item) as keys(key)
      where key not in ('source_row_number','record_data')
    ) then
      raise exception using errcode = '22023', message = 'production_entry_unknown_row_field';
    end if;

    begin
      v_source_row_number := (v_item->>'source_row_number')::smallint;
    exception when others then
      raise exception using errcode = '22023', message = 'production_entry_invalid_source_row';
    end;
    if v_source_row_number < 8 or v_source_row_number > 19
       or v_source_row_number = any(v_seen_rows) then
      raise exception using errcode = '22023', message = 'production_entry_invalid_or_repeated_source_row';
    end if;
    v_seen_rows := array_append(v_seen_rows,v_source_row_number);

    v_line := case
      when v_source_row_number between 8 and 11 then 'Agri'
      when v_source_row_number between 12 and 15 then 'Meat'
      when v_source_row_number between 16 and 19 then 'Finishing'
      else null end;
    v_data := v_item->'record_data';
    if jsonb_typeof(v_data) <> 'object' then
      raise exception using errcode = '22023', message = 'production_entry_record_data_must_be_object';
    end if;
    if exists (
      select 1 from jsonb_object_keys(v_data) as keys(key)
      where key not in ('A','C','D','E','F','G','H','J','K','L','M','N','O','P','S','T')
    ) then
      raise exception using errcode = '22023', message = 'production_entry_unknown_or_derived_field';
    end if;

    begin
      v_date := nullif(btrim(v_data->>'A'),'')::date;
      v_product_name := nullif(btrim(v_data->>'C'),'');
      v_product_code := nullif(btrim(v_data->>'D'),'');
      v_batches := nullif(btrim(v_data->>'E'),'')::numeric;
      v_target := nullif(btrim(v_data->>'F'),'')::numeric;
      v_produced := nullif(btrim(v_data->>'G'),'')::numeric;
      v_uom := nullif(btrim(v_data->>'H'),'');
      v_plan_start := nullif(btrim(v_data->>'J'),'')::time;
      v_actual_start := nullif(btrim(v_data->>'K'),'')::time;
      v_plan_end := nullif(btrim(v_data->>'L'),'')::time;
      v_actual_end_prod := nullif(btrim(v_data->>'M'),'')::time;
      v_actual_end_cleaning := nullif(btrim(v_data->>'N'),'')::time;
      v_manpower_required := nullif(btrim(v_data->>'O'),'')::numeric;
      v_present := nullif(btrim(v_data->>'P'),'')::numeric;
      v_ot_hours := nullif(btrim(v_data->>'S'),'')::numeric;
      v_remarks := nullif(btrim(v_data->>'T'),'');
    exception when others then
      raise exception using errcode = '22023', message = 'production_entry_invalid_field_value';
    end;

    if v_product_name is not null and not exists (
      select 1 from jsonb_array_elements_text(v_catalog->'product_names') as p(value)
      where p.value=v_product_name
    ) then
      raise exception using errcode = '22023', message = 'production_entry_invalid_product_name';
    end if;
    if v_product_code is not null and (
      v_product_name is null
      or not exists (
        select 1
        from jsonb_array_elements_text(v_catalog->'product_codes'->v_product_name) as c(value)
        where c.value=v_product_code
      )
    ) then
      raise exception using errcode = '22023', message = 'production_entry_product_code_mismatch';
    end if;
    if v_uom is not null and not exists (
      select 1 from jsonb_array_elements_text(v_catalog->'uom') as u(value)
      where u.value=v_uom
    ) then
      raise exception using errcode = '22023', message = 'production_entry_invalid_uom';
    end if;
    if length(coalesce(v_remarks,'')) > 1000
       or length(coalesce(v_product_name,'')) > 200
       or length(coalesce(v_product_code,'')) > 100 then
      raise exception using errcode = '22023', message = 'production_entry_text_value_too_long';
    end if;
    if coalesce(v_batches < 0,false) or coalesce(v_target < 0,false)
       or coalesce(v_produced < 0,false) or coalesce(v_manpower_required < 0,false)
       or coalesce(v_present < 0,false) or coalesce(v_ot_hours < 0,false) then
      raise exception using errcode = '22023', message = 'production_entry_negative_number';
    end if;

    v_has_data := v_product_name is not null or v_product_code is not null
      or v_target is not null or v_produced is not null
      or v_manpower_required is not null or v_present is not null
      or v_ot_hours is not null or v_remarks is not null;

    if not v_has_data then
      v_empty := v_empty + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'row_index',v_index,'source_row_number',v_source_row_number,'status','empty'
      ));
      continue;
    end if;

    v_attainment := case when v_target is not null and v_produced is not null and v_target > 0
      then v_produced / v_target else null end;
    v_absent := case when v_manpower_required is not null and v_present is not null
      then v_manpower_required - v_present else null end;
    v_attendance := case when v_manpower_required is not null and v_present is not null and v_manpower_required > 0
      then v_present / v_manpower_required else null end;
    v_saved_on := now();

    v_input_data := jsonb_strip_nulls(jsonb_build_object(
      'A',v_date,'C',v_product_name,'D',v_product_code,'E',v_batches,
      'F',v_target,'G',v_produced,'H',v_uom,'J',v_plan_start,'K',v_actual_start,
      'L',v_plan_end,'M',v_actual_end_prod,'N',v_actual_end_cleaning,
      'O',v_manpower_required,'P',v_present,'S',v_ot_hours,'T',v_remarks
    ));
    v_record_data := jsonb_build_object(
      'A',v_date,'B',v_line,'C',v_product_name,'D',v_product_code,'E',v_batches,
      'F',v_target,'G',v_produced,'H',v_uom,'I',v_attainment,
      'J',v_plan_start,'K',v_actual_start,'L',v_plan_end,'M',v_actual_end_prod,
      'N',v_actual_end_cleaning,'O',v_manpower_required,'P',v_present,
      'Q',v_absent,'R',v_attendance,'S',v_ot_hours,'T',v_remarks,
      'U',v_saved_on,'V',null,'W',true,'X',null
    );
    v_blank_fields := array_remove(array[
      case when v_date is null then 'A' end,
      case when v_product_name is null then 'C' end,
      case when v_product_code is null then 'D' end,
      case when v_batches is null then 'E' end,
      case when v_target is null then 'F' end,
      case when v_produced is null then 'G' end,
      case when v_uom is null then 'H' end,
      case when v_plan_start is null then 'J' end,
      case when v_actual_start is null then 'K' end,
      case when v_plan_end is null then 'L' end,
      case when v_actual_end_prod is null then 'M' end,
      case when v_actual_end_cleaning is null then 'N' end,
      case when v_manpower_required is null then 'O' end,
      case when v_present is null then 'P' end,
      case when v_ot_hours is null then 'S' end,
      case when v_remarks is null then 'T' end
    ],null);
    v_fingerprint := private.tfi_production_entry_fingerprint(v_source_row_number,v_input_data);
    v_id := null;

    insert into public.tfi_production_entry_records (
      entry_batch_id,source_row_number,production_date,line,product_name,product_code,
      batches,target,produced,uom,attainment,plan_start,actual_start,plan_end,
      actual_end_prod,actual_end_cleaning,manpower_required,present,absent,
      attendance,ot_hours,remarks,saved_on,check_value,has_data,day_has_data,
      record_data,record_fingerprint,blank_fields,created_by,updated_by
    ) values (
      v_batch_id,v_source_row_number,v_date,v_line,v_product_name,v_product_code,
      v_batches,v_target,v_produced,v_uom,v_attainment,v_plan_start,v_actual_start,v_plan_end,
      v_actual_end_prod,v_actual_end_cleaning,v_manpower_required,v_present,v_absent,
      v_attendance,v_ot_hours,v_remarks,v_saved_on,null,true,null,
      v_record_data,v_fingerprint,v_blank_fields,v_user_id,v_user_id
    ) on conflict (record_fingerprint) do nothing returning id into v_id;

    if v_id is null then
      v_duplicates := v_duplicates + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'row_index',v_index,'source_row_number',v_source_row_number,'status','duplicate'
      ));
      continue;
    end if;

    v_after := jsonb_build_object(
      'source_row_number',v_source_row_number,'record_data',v_record_data,
      'completeness_status','unassessed','blank_fields',to_jsonb(v_blank_fields)
    );
    insert into public.tfi_audit_events (
      actor_user_id,actor_email_snapshot,actor_roles_snapshot,action_key,module_key,
      entity_type,entity_id,before_data,after_data,metadata,occurred_at
    ) values (
      v_user_id,v_context #>> '{profile,email}',coalesce(v_context->'roles','[]'::jsonb),
      'production_entry.create','production_entry','production_entry_record',v_id::text,
      null,v_after,jsonb_build_object(
        'entry_source','manual','entry_batch_id',v_batch_id,
        'source_row_number',v_source_row_number,'line',v_line
      ),now()
    );

    v_inserted := v_inserted + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'row_index',v_index,'source_row_number',v_source_row_number,
      'status','inserted','id',v_id,'line',v_line,
      'record_data',v_record_data,'blank_fields',to_jsonb(v_blank_fields),
      'completeness_status','unassessed'
    ));
  end loop;

  return jsonb_build_object(
    'entry_batch_id',v_batch_id,'inserted',v_inserted,
    'duplicates',v_duplicates,'empty',v_empty,'results',v_results
  );
end;
$function$;

create or replace function private.tfi_update_production_entry_record(
  p_record_id uuid,
  p_expected_version integer,
  p_changes jsonb,
  p_change_reason text default null
) returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_context jsonb;
  v_catalog jsonb;
  v_record public.tfi_production_entry_records%rowtype;
  v_input_data jsonb;
  v_record_data jsonb;
  v_before jsonb;
  v_after jsonb;
  v_date date;
  v_product_name text;
  v_product_code text;
  v_batches numeric;
  v_target numeric;
  v_produced numeric;
  v_uom text;
  v_plan_start time;
  v_actual_start time;
  v_plan_end time;
  v_actual_end_prod time;
  v_actual_end_cleaning time;
  v_manpower_required numeric;
  v_present numeric;
  v_ot_hours numeric;
  v_remarks text;
  v_attainment numeric;
  v_absent numeric;
  v_attendance numeric;
  v_fingerprint text;
  v_blank_fields text[];
  v_changed_columns text[];
  v_line text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if not private.tfi_has_permission('production_entry','view')
     or not private.tfi_has_permission('production_entry','edit') then
    raise exception using errcode = '42501', message = 'production_entry_edit_permission_required';
  end if;
  if p_expected_version is null or p_expected_version < 1
     or p_changes is null or jsonb_typeof(p_changes) <> 'object'
     or p_changes = '{}'::jsonb then
    raise exception using errcode = '22023', message = 'production_entry_invalid_update';
  end if;
  if length(coalesce(p_change_reason,'')) > 500 then
    raise exception using errcode = '22023', message = 'production_entry_invalid_change_reason';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_changes) as keys(key)
    where key not in ('A','C','D','E','F','G','H','J','K','L','M','N','O','P','S','T')
  ) then
    raise exception using errcode = '22023', message = 'production_entry_unknown_or_derived_field';
  end if;

  select * into v_record
  from public.tfi_production_entry_records
  where id=p_record_id and record_status='active'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'production_entry_record_not_found';
  end if;
  if v_record.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'production_entry_version_conflict';
  end if;

  select catalog_data into v_catalog
  from public.tfi_production_entry_catalog where catalog_key='source';
  v_line := case
    when v_record.source_row_number between 8 and 11 then 'Agri'
    when v_record.source_row_number between 12 and 15 then 'Meat'
    when v_record.source_row_number between 16 and 19 then 'Finishing'
    else null end;

  v_input_data := (v_record.record_data - array['B','I','Q','R','U','V','W','X']::text[]) || p_changes;
  begin
    v_date := nullif(btrim(v_input_data->>'A'),'')::date;
    v_product_name := nullif(btrim(v_input_data->>'C'),'');
    v_product_code := nullif(btrim(v_input_data->>'D'),'');
    v_batches := nullif(btrim(v_input_data->>'E'),'')::numeric;
    v_target := nullif(btrim(v_input_data->>'F'),'')::numeric;
    v_produced := nullif(btrim(v_input_data->>'G'),'')::numeric;
    v_uom := nullif(btrim(v_input_data->>'H'),'');
    v_plan_start := nullif(btrim(v_input_data->>'J'),'')::time;
    v_actual_start := nullif(btrim(v_input_data->>'K'),'')::time;
    v_plan_end := nullif(btrim(v_input_data->>'L'),'')::time;
    v_actual_end_prod := nullif(btrim(v_input_data->>'M'),'')::time;
    v_actual_end_cleaning := nullif(btrim(v_input_data->>'N'),'')::time;
    v_manpower_required := nullif(btrim(v_input_data->>'O'),'')::numeric;
    v_present := nullif(btrim(v_input_data->>'P'),'')::numeric;
    v_ot_hours := nullif(btrim(v_input_data->>'S'),'')::numeric;
    v_remarks := nullif(btrim(v_input_data->>'T'),'');
  exception when others then
    raise exception using errcode = '22023', message = 'production_entry_invalid_field_value';
  end;

  if v_product_name is not null and not exists (
    select 1 from jsonb_array_elements_text(v_catalog->'product_names') as p(value)
    where p.value=v_product_name
  ) then
    raise exception using errcode = '22023', message = 'production_entry_invalid_product_name';
  end if;
  if v_product_code is not null and (
    v_product_name is null
    or not exists (
      select 1 from jsonb_array_elements_text(v_catalog->'product_codes'->v_product_name) as c(value)
      where c.value=v_product_code
    )
  ) then
    raise exception using errcode = '22023', message = 'production_entry_product_code_mismatch';
  end if;
  if v_uom is not null and not exists (
    select 1 from jsonb_array_elements_text(v_catalog->'uom') as u(value)
    where u.value=v_uom
  ) then
    raise exception using errcode = '22023', message = 'production_entry_invalid_uom';
  end if;
  if length(coalesce(v_remarks,'')) > 1000
     or length(coalesce(v_product_name,'')) > 200
     or length(coalesce(v_product_code,'')) > 100 then
    raise exception using errcode = '22023', message = 'production_entry_text_value_too_long';
  end if;
  if coalesce(v_batches < 0,false) or coalesce(v_target < 0,false)
     or coalesce(v_produced < 0,false) or coalesce(v_manpower_required < 0,false)
     or coalesce(v_present < 0,false) or coalesce(v_ot_hours < 0,false) then
    raise exception using errcode = '22023', message = 'production_entry_negative_number';
  end if;

  if v_product_name is null and v_product_code is null and v_target is null
     and v_produced is null and v_manpower_required is null and v_present is null
     and v_ot_hours is null and v_remarks is null then
    raise exception using errcode = '22023', message = 'production_entry_saved_run_must_retain_data';
  end if;

  v_attainment := case when v_target is not null and v_produced is not null and v_target > 0
    then v_produced / v_target else null end;
  v_absent := case when v_manpower_required is not null and v_present is not null
    then v_manpower_required - v_present else null end;
  v_attendance := case when v_manpower_required is not null and v_present is not null and v_manpower_required > 0
    then v_present / v_manpower_required else null end;

  v_input_data := jsonb_strip_nulls(jsonb_build_object(
    'A',v_date,'C',v_product_name,'D',v_product_code,'E',v_batches,
    'F',v_target,'G',v_produced,'H',v_uom,'J',v_plan_start,'K',v_actual_start,
    'L',v_plan_end,'M',v_actual_end_prod,'N',v_actual_end_cleaning,
    'O',v_manpower_required,'P',v_present,'S',v_ot_hours,'T',v_remarks
  ));
  v_record_data := jsonb_build_object(
    'A',v_date,'B',v_line,'C',v_product_name,'D',v_product_code,'E',v_batches,
    'F',v_target,'G',v_produced,'H',v_uom,'I',v_attainment,
    'J',v_plan_start,'K',v_actual_start,'L',v_plan_end,'M',v_actual_end_prod,
    'N',v_actual_end_cleaning,'O',v_manpower_required,'P',v_present,
    'Q',v_absent,'R',v_attendance,'S',v_ot_hours,'T',v_remarks,
    'U',v_record.saved_on,'V',v_record.check_value,'W',true,'X',v_record.day_has_data
  );
  v_blank_fields := array_remove(array[
    case when v_date is null then 'A' end,
    case when v_product_name is null then 'C' end,
    case when v_product_code is null then 'D' end,
    case when v_batches is null then 'E' end,
    case when v_target is null then 'F' end,
    case when v_produced is null then 'G' end,
    case when v_uom is null then 'H' end,
    case when v_plan_start is null then 'J' end,
    case when v_actual_start is null then 'K' end,
    case when v_plan_end is null then 'L' end,
    case when v_actual_end_prod is null then 'M' end,
    case when v_actual_end_cleaning is null then 'N' end,
    case when v_manpower_required is null then 'O' end,
    case when v_present is null then 'P' end,
    case when v_ot_hours is null then 'S' end,
    case when v_remarks is null then 'T' end
  ],null);
  select coalesce(array_agg(k order by k),'{}'::text[]) into v_changed_columns
  from jsonb_object_keys(p_changes) as keys(k)
  where v_record.record_data->k is distinct from v_record_data->k;

  if cardinality(v_changed_columns)=0 then
    return jsonb_build_object('id',p_record_id,'changed',false,'version',v_record.version);
  end if;

  v_fingerprint := private.tfi_production_entry_fingerprint(v_record.source_row_number,v_input_data);
  v_before := v_record.record_data;
  v_after := jsonb_build_object(
    'source_row_number',v_record.source_row_number,'record_data',v_record_data,
    'completeness_status',v_record.completeness_status,'blank_fields',to_jsonb(v_blank_fields)
  );

  update public.tfi_production_entry_records set
    production_date=v_date,product_name=v_product_name,product_code=v_product_code,
    batches=v_batches,target=v_target,produced=v_produced,uom=v_uom,attainment=v_attainment,
    plan_start=v_plan_start,actual_start=v_actual_start,plan_end=v_plan_end,
    actual_end_prod=v_actual_end_prod,actual_end_cleaning=v_actual_end_cleaning,
    manpower_required=v_manpower_required,present=v_present,absent=v_absent,
    attendance=v_attendance,ot_hours=v_ot_hours,remarks=v_remarks,
    record_data=v_record_data,record_fingerprint=v_fingerprint,blank_fields=v_blank_fields,
    version=version+1,updated_at=now(),updated_by=v_user_id
  where id=p_record_id;

  insert into public.tfi_production_entry_revisions (
    production_entry_record_id,version,before_data,after_data,changed_columns,change_reason,changed_by
  ) values (
    p_record_id,v_record.version+1,v_before,v_record_data,v_changed_columns,
    nullif(btrim(p_change_reason),''),v_user_id
  );

  v_context := private.tfi_get_my_access_context();
  insert into public.tfi_audit_events (
    actor_user_id,actor_email_snapshot,actor_roles_snapshot,action_key,module_key,
    entity_type,entity_id,before_data,after_data,metadata,occurred_at
  ) values (
    v_user_id,v_context #>> '{profile,email}',coalesce(v_context->'roles','[]'::jsonb),
    'production_entry.update','production_entry','production_entry_record',p_record_id::text,
    jsonb_build_object('record_data',v_before),v_after,
    jsonb_build_object('changed_columns',to_jsonb(v_changed_columns),'version',v_record.version+1),now()
  );

  return jsonb_build_object(
    'id',p_record_id,'changed',true,'version',v_record.version+1,
    'changed_columns',to_jsonb(v_changed_columns)
  );
end;
$function$;

create or replace function public.tfi_get_production_entry_catalog()
returns jsonb
language sql security invoker set search_path to ''
as $function$
  select c.catalog_data
  from public.tfi_production_entry_catalog c
  where c.catalog_key='source';
$function$;

create or replace function public.tfi_get_production_entry_summary()
returns jsonb
language sql security invoker set search_path to ''
as $function$
  select jsonb_build_object(
    'saved_rows',count(*),
    'days_saved',count(distinct production_date),
    'avg_attainment',avg(attainment),
    'last_saved',max(saved_on)
  )
  from public.tfi_production_entry_records
  where record_status='active';
$function$;

create or replace function public.tfi_get_production_entry_records(
  p_date_from date default null,
  p_date_to date default null,
  p_line text default null,
  p_product_name text default null,
  p_product_code text default null,
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 10,
  p_sort_key text default 'date',
  p_sort_direction text default 'desc'
) returns jsonb
language plpgsql security invoker set search_path to ''
as $function$
declare
  v_order_column text;
  v_direction text;
  v_offset integer;
  v_result jsonb;
begin
  if p_page is null or p_page < 1 or p_page_size is null or p_page_size < 1 or p_page_size > 100 then
    raise exception using errcode = '22023', message = 'production_entry_invalid_pagination';
  end if;
  if p_date_from is not null and p_date_to is not null and p_date_from > p_date_to then
    raise exception using errcode = '22023', message = 'production_entry_invalid_date_filter';
  end if;

  v_order_column := case p_sort_key
    when 'date' then 'production_date'
    when 'line' then 'line'
    when 'productName' then 'product_name'
    when 'productCode' then 'product_code'
    when 'batches' then 'batches'
    when 'target' then 'target'
    when 'produced' then 'produced'
    when 'uom' then 'uom'
    when 'attainment' then 'attainment'
    when 'planStart' then 'plan_start'
    when 'actualStart' then 'actual_start'
    when 'planEnd' then 'plan_end'
    when 'actualEndProd' then 'actual_end_prod'
    when 'actualEndCleaning' then 'actual_end_cleaning'
    when 'manReqmt' then 'manpower_required'
    when 'present' then 'present'
    when 'absent' then 'absent'
    when 'attendance' then 'attendance'
    when 'otHrs' then 'ot_hours'
    when 'remarks' then 'remarks'
    when 'savedOn' then 'saved_on'
    when 'check' then 'check_value'
    when 'hasData' then 'has_data'
    when 'dayHasData' then 'day_has_data'
    else 'production_date'
  end;
  v_direction := case when lower(coalesce(p_sort_direction,'desc'))='asc' then 'ASC' else 'DESC' end;
  v_offset := (p_page-1)*p_page_size;

  execute format(
    'with filtered as (
       select r.* from public.tfi_production_entry_records r
       where r.record_status=''active''
         and ($1 is null or r.production_date >= $1)
         and ($2 is null or r.production_date <= $2)
         and ($3 is null or r.line = $3)
         and ($4 is null or r.product_name ilike ''%%'' || $4 || ''%%'')
         and ($5 is null or r.product_code ilike ''%%'' || $5 || ''%%'')
         and ($6 is null or concat_ws('' '',r.production_date::text,r.line,r.product_name,r.product_code,r.remarks) ilike ''%%'' || $6 || ''%%'')
     ),
     page_rows as (
       select * from filtered
       order by %I %s nulls last, source_row_number asc, saved_on desc
       limit $7 offset $8
     )
     select jsonb_build_object(
       ''total'',(select count(*) from filtered),
       ''records'',coalesce((
         select jsonb_agg(to_jsonb(p) order by p.%I %s nulls last,p.source_row_number asc,p.saved_on desc)
         from page_rows p
       ),''[]''::jsonb)
     )',
    v_order_column,v_direction,v_order_column,v_direction
  ) into v_result using
    p_date_from,p_date_to,nullif(btrim(p_line),''),nullif(btrim(p_product_name),''),
    nullif(btrim(p_product_code),''),nullif(btrim(p_search),''),p_page_size,v_offset;

  return coalesce(v_result,jsonb_build_object('total',0,'records','[]'::jsonb));
end;
$function$;

create or replace function public.tfi_create_production_entry_records(p_records jsonb)
returns jsonb
language sql security definer set search_path to ''
as $function$
  select private.tfi_create_production_entry_records(p_records);
$function$;

create or replace function public.tfi_update_production_entry_record(
  p_record_id uuid,
  p_expected_version integer,
  p_changes jsonb,
  p_change_reason text default null
) returns jsonb
language sql security definer set search_path to ''
as $function$
  select private.tfi_update_production_entry_record(
    p_record_id,p_expected_version,p_changes,p_change_reason
  );
$function$;

revoke all on function public.tfi_get_production_entry_catalog() from public, anon;
revoke all on function public.tfi_get_production_entry_summary() from public, anon;
revoke all on function public.tfi_get_production_entry_records(date,date,text,text,text,text,integer,integer,text,text) from public, anon;
revoke all on function public.tfi_create_production_entry_records(jsonb) from public, anon;
revoke all on function public.tfi_update_production_entry_record(uuid,integer,jsonb,text) from public, anon;
grant execute on function public.tfi_get_production_entry_catalog() to authenticated;
grant execute on function public.tfi_get_production_entry_summary() to authenticated;
grant execute on function public.tfi_get_production_entry_records(date,date,text,text,text,text,integer,integer,text,text) to authenticated;
grant execute on function public.tfi_create_production_entry_records(jsonb) to authenticated;
grant execute on function public.tfi_update_production_entry_record(uuid,integer,jsonb,text) to authenticated;

revoke all on function private.tfi_create_production_entry_records(jsonb) from public, anon, authenticated;
revoke all on function private.tfi_update_production_entry_record(uuid,integer,jsonb,text) from public, anon, authenticated;

commit;
