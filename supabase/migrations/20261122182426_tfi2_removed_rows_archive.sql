create table public.tfi_removed_rows_archive (
    workbook_id text not null,
    sheet_id bigint not null check (sheet_id >= 0),
    source_row integer not null check (source_row >= 4),
    cells text[] not null check (cardinality(cells) = 18 and array_ndims(cells) = 1),
    captured_at timestamptz not null default transaction_timestamp(),
    primary key (workbook_id, sheet_id, source_row)
);

comment on table public.tfi_removed_rows_archive is
    'Read-only source snapshots of Removed Rows, excluded from active production and report totals.';

alter table public.tfi_removed_rows_archive enable row level security;
revoke all on table public.tfi_removed_rows_archive from public, anon, authenticated;
grant select on table public.tfi_removed_rows_archive to authenticated;

create policy tfi_removed_rows_archive_authorized_read
on public.tfi_removed_rows_archive for select to authenticated
using (private.tfi_has_permission('production_entry', 'view'));
