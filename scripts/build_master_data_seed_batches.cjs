const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "design", "master-data-source-data.js");
const outDir = path.join(root, "supabase", "drafts", "master_data_seed_batches");
const raw = fs.readFileSync(sourcePath, "utf8");
const marker = "window.TFI_MASTER_DATA = ";
const start = raw.indexOf(marker);
if (start < 0) throw new Error("Official Master Data snapshot assignment not found.");
const jsonStart = start + marker.length;
const jsonEnd = raw.lastIndexOf("};");
if (jsonEnd < jsonStart) throw new Error("Official Master Data snapshot terminator not found.");
const snapshot = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));

const specs = [
  { key:"product_standard", sheet:"productStandard", width:21, count:110, editable:true },
  { key:"code_map", sheet:"codeMap", width:2, count:72, editable:true },
  { key:"yield_map", sheet:"yieldMap", width:23, count:43, editable:true },
  { key:"entry_map", sheet:"entryMap", width:5, count:43, editable:false },
  { key:"kpi_setup", sheet:"kpiSetup", width:20, count:129, editable:false },
  { key:"dpr_legend", sheet:"dprLegend", width:40, count:119, editable:false },
  { key:"dmp_legend", sheet:"dmpLegend", width:4, count:70, editable:true, locked:[5,9,14,17,20,23,31,33,36,39] },
  { key:"manpower", sheet:"manpower", width:5, count:448, editable:true },
  { key:"schedule_lists", sheet:"scheduleLists", width:12, count:101, editable:false }
];

function hasValue(row) {
  return row.some(v => v !== null && v !== undefined && String(v) !== "");
}
function kind(spec, row, n) {
  if (spec.sheet === "productStandard") {
    if (n === 1) return "header";
    if (row[0] === "▶") return "group_header";
    if (String(row[1] || "").includes("+ new variant code")) return "reserved_slot";
    if (row[0] !== null && row[0] !== undefined && String(row[0]) !== "") return "data";
    return hasValue(row) ? "helper" : "blank";
  }
  if (spec.sheet === "codeMap") {
    if (n === 1) return "title";
    if (n === 2) return "instruction";
    if (n === 3) return "blank";
    if (n === 4) return "header";
  }
  if (spec.sheet === "yieldMap") {
    if (n === 1) return "title";
    if (n === 2) return "instruction";
    if (n === 3) return "blank";
    if (n === 4) return "header";
  }
  if (spec.sheet === "entryMap") {
    if (n === 1) return "header";
    if (n === 43) return "instruction";
  }
  if (spec.sheet === "kpiSetup") {
    if (n === 1) return "header";
  }
  if (spec.sheet === "dprLegend") {
    if (n === 1) return "title";
    if (n === 2) return "header";
  }
  if (spec.sheet === "dmpLegend") {
    if (n === 1) return "header";
  }
  if (spec.sheet === "manpower") {
    if (n === 1) return "title";
    if (n === 2) return "blank";
    if (n === 3) return "header";
  }
  if (spec.sheet === "scheduleLists") {
    if (n === 1) return "header";
  }
  return hasValue(row) ? "data" : "blank";
}
function sqlQuote(value) {
  return "'" + value.replace(/'/g, "''") + "'";
}
function jsonSql(value) {
  return sqlQuote(JSON.stringify(value)) + "::jsonb";
}

fs.rmSync(outDir, { recursive:true, force:true });
fs.mkdirSync(outDir, { recursive:true });

const batchSize = 35;
const report = [];
let batchIndex = 0;
for (const spec of specs) {
  const sheet = snapshot.sheets[spec.sheet];
  if (!sheet) throw new Error("Missing source sheet: " + spec.sheet);
  if (sheet.values.length !== spec.count) {
    throw new Error(spec.key + " row count mismatch: expected " + spec.count + ", got " + sheet.values.length);
  }
  const noteRows = spec.sheet === "dmpLegend" ? (sheet.notes || []) : [];
  const rows = sheet.values.map((rawRow, index) => {
    const sourceRow = index + 1;
    const values = Array.from({length:spec.width}, (_, i) => rawRow?.[i] ?? null);
    const notes = noteRows.filter(n => n.sourceRow === sourceRow).map(n => ({
      column: String(n.column || ""),
      status: String(n.status || "")
    }));
    const rowKind = kind(spec, values, sourceRow);
    const rowEditable = !!spec.editable && rowKind === "data" &&
      !(spec.locked || []).includes(sourceRow);
    const fingerprint = crypto.createHash("sha256")
      .update(JSON.stringify([values, notes]), "utf8").digest("hex");
    return {
      category_key: spec.key,
      source_row_number: sourceRow,
      row_kind: rowKind,
      source_values: values,
      current_values: values,
      source_notes: notes,
      source_fingerprint: fingerprint,
      row_editable: rowEditable
    };
  });

  const counts = rows.reduce((a, r) => (a[r.row_kind] = (a[r.row_kind] || 0) + 1, a), {});
  for (let offset=0; offset<rows.length; offset+=batchSize) {
    const batch = rows.slice(offset, offset+batchSize);
    const tuples = batch.map(r => "(" + [
      sqlQuote(r.category_key),
      String(r.source_row_number),
      sqlQuote(r.row_kind),
      jsonSql(r.source_values),
      jsonSql(r.current_values),
      jsonSql(r.source_notes),
      sqlQuote(r.source_fingerprint),
      r.row_editable ? "true" : "false"
    ].join(",") + ")").join(",\n");
    const sql = [
      "insert into public.tfi_master_data_rows (category_key,source_row_number,row_kind,source_values,current_values,source_notes,source_fingerprint,row_editable)",
      "values\n" + tuples,
      "on conflict (category_key,source_row_number) do nothing;"
    ].join("\n") + "\n";
    const name = String(++batchIndex).padStart(3,"0") + "_" + spec.key + ".sql";
    fs.writeFileSync(path.join(outDir,name), sql, "utf8");
  }
  report.push({category:spec.key, rows:rows.length, rowKinds:counts, editableRows:rows.filter(r=>r.row_editable).length, notes:rows.reduce((n,r)=>n+r.source_notes.length,0)});
}
fs.writeFileSync(path.join(outDir,"manifest.json"), JSON.stringify({
  sourceWorkbook:snapshot.meta.workbookTitle,
  spreadsheetId:snapshot.meta.spreadsheetId,
  auditDate:snapshot.meta.auditDate,
  batchSize,
  batches:batchIndex,
  categories:report
},null,2), "utf8");
console.log(JSON.stringify({outDir,batches:batchIndex,categories:report},null,2));
