insert into public.tfi_master_data_rows (category_key,source_row_number,row_kind,source_values,current_values,source_notes,source_fingerprint,row_editable)
values
('code_map',71,'data','["MRB-24-380","Maharlika RB"]'::jsonb,'["MRB-24-380","Maharlika RB"]'::jsonb,'[]'::jsonb,'9959ad0301138cbd5e7a0bfc730b04efea6e25e7ab828b6a47a3b10b985b9a56',true),
('code_map',72,'data','["MLCM-48-155","Mayon Laing"]'::jsonb,'["MLCM-48-155","Mayon Laing"]'::jsonb,'[]'::jsonb,'a6d5cb71f868970f951d713d003ea1402372618afd61b66bbf8a4c1e28ef5224',true)
on conflict (category_key,source_row_number) do nothing;
