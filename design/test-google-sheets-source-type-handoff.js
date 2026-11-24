const fs=require("fs");
const path=require("path");
const dir=__dirname;
const read=name=>fs.readFileSync(path.join(dir,name),"utf8");
const scan=read("tfi-scan-progress-live.js");
const inbox=read("tfi-import-inbox-live.js");
const duplicate=read("tfi-duplicate-review-live.js");
const approval=read("tfi-final-import-live.js");
const checks={
 scanUsesBatchSourceType:scan.includes('sourceType: currentBatch.source_type || params.get("sourceType") || "xlsx"'),
 inboxUsesBatchSourceType:inbox.includes('sourceType: currentBatch.source_type || params.get("sourceType") || "xlsx"'),
 inboxLabelsGoogleSheets:inbox.includes('batch.source_type === "google_sheets" ? "GOOGLE SHEETS" : "XLSX"'),
 duplicateReviewPreservesSourceType:(duplicate.match(/sourceType: params.get\("sourceType"\) \|\| "xlsx"/g)||[]).length===2,
 finalApprovalReturnsWithSourceType:approval.includes('sourceType: state.batch?.source_type || params.get("sourceType") || "xlsx"')
};
console.log(JSON.stringify({checks,pass:Object.values(checks).every(Boolean)},null,2));
if(!Object.values(checks).every(Boolean))process.exitCode=1;
