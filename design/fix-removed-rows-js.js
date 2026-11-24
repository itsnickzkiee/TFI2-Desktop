const fs=require("fs");
const p="C:/Users/Rominick/Desktop/TFI_NEW/design/removed-rows-ui.js";
let s=fs.readFileSync(p,"utf8");
const lines=s.split(/\r?\n/);
for(let i=0;i<lines.length;i++){
  if(lines[i].includes("const match = url.pathname.match")){
    lines.splice(i,2,
      '      const pathParts = url.pathname.split("/").filter(Boolean);',
      '      const dIndex = pathParts.indexOf("d");',
      '      const id = dIndex >= 0 ? pathParts[dIndex + 1] : "";',
      '      return id && /^[A-Za-z0-9_-]+$/.test(id) ? id : "";'
    );
    break;
  }
}
s=lines.join("\n");
const dateFn = [
'  function parseSourceDate(value) {',
'    const raw = clean(value);',
'    if (!raw) return "";',
'    const parts = raw.split("-");',
'    if (parts.length !== 3) return "";',
'    if (parts[0].length === 4 && parts[1].length === 2 && parts[2].length === 2 && parts.every(part => Number.isInteger(Number(part)))) return raw;',
'    const day = Number(parts[0]), monthText = parts[1].toLowerCase(), yearText = parts[2];',
'    const months = {jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12"};',
'    const month = months[monthText];',
'    if (!month || !Number.isInteger(day) || day < 1 || day > 31 || !Number.isInteger(Number(yearText)) || (yearText.length !== 2 && yearText.length !== 4)) return "";',
'    let year = Number(yearText);',
'    if (yearText.length === 2) year += year < 50 ? 2000 : 1900;',
'    return String(year).padStart(4,"0")+"-"+month+"-"+String(day).padStart(2,"0");',
'  }'
].join("\n");
s=s.replace(/  function parseSourceDate\(value\) \{[\s\S]*?\n  \}/,dateFn);
s=s.replace(/    const blob = new Blob\(\[.*?\],\{type:"text\/csv;charset=utf-8"\}\);/,
  '    const blob = new Blob([String.fromCharCode(65279)+lines.join(String.fromCharCode(13,10))],{type:"text/csv;charset=utf-8"});');
fs.writeFileSync(p,s,"utf8");
console.log("Fixed URL parsing, date parsing, and CSV encoding.");
