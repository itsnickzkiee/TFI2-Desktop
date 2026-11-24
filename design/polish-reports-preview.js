const fs = require("fs");
const path = require("path");
const file = "C:/Users/Rominick/Desktop/TFI_NEW/design/reports-reconciliation-preview.html";
const cssFile = "C:/Users/Rominick/Desktop/TFI_NEW/design/reports-reconciliation.css";
let html = fs.readFileSync(file, "utf8");
let css = fs.readFileSync(cssFile, "utf8");
const backup = file + ".pre-ui-polish-20261120.bak";
if (fs.existsSync(backup)) throw new Error("UI polish backup already exists; refusing to overwrite.");
function once(src, from, to, label) {
  const i = src.indexOf(from);
  if (i < 0) throw new Error(label + ": pattern missing");
  if (src.indexOf(from, i + from.length) >= 0) throw new Error(label + ": pattern occurs more than once");
  return src.slice(0, i) + to + src.slice(i + from.length);
}
html = once(
  html,
  "Exact source column order A:X · Source header row 6 · One row per saved product run",
  "Exact source column order A:X · Source header row 6 · One row per saved product run · Scroll horizontally to view all columns",
  "horizontal scroll helper"
);
html = once(
  html,
  '<th><button type="button" data-rr-sort="attainment">% Attainment <span>↕</span></button></th>',
  '<th class="rr-derived-head"><button type="button" data-rr-sort="attainment">% Attainment <span>↕</span></button></th>',
  "attainment calculated header"
);
html = once(
  html,
  '<th><button type="button" data-rr-sort="attendance">% Attendance <span>↕</span></button></th>',
  '<th class="rr-derived-head"><button type="button" data-rr-sort="attendance">% Attendance <span>↕</span></button></th>',
  "attendance calculated header"
);
html = once(
  html,
  "Source columns: A:X<br>Record type: saved production-run history",
  "Source columns: A:X<br>Record type: saved production-run history<br>Spreadsheet ID: 1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k",
  "spreadsheet ID in import dialog"
);
if (!css.includes(".rr-derived-head")) {
  css += "\n.rr-table thead tr.rr-column-row th.rr-derived-head{background:#dcefe5;color:#15533d}\n.rr-table tbody td.rr-derived{background:#f0f7f3;color:#426b58;font-weight:750}\n";
}
fs.copyFileSync(file, backup);
fs.writeFileSync(file, html, "utf8");
fs.writeFileSync(cssFile, css, "utf8");
console.log(JSON.stringify({updated:file, updatedStylesheet:cssFile, backup, additions:["horizontal scroll guidance","formula-derived attainment headers","verified source spreadsheet ID in import dialog"]},null,2));
