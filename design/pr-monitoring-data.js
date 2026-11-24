/* TFI_NEW — PR Monitoring source contract. */
window.TFI_PR_MONITORING_DATA = {
  source: {
    workbook: "Copy of TFI - Production Monitoring Sheet 1",
    spreadsheetId: "1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k",
    sheet: "PR MONITORING",
    sheetId: 867256143,
    title: "TOSEN FOODS INC. 2025 -  PR MONITORING",
    gridRows: 1000,
    gridColumns: 27,
    sourceColumns: "A:G",
    summaryRow: 2,
    headerRow: 3,
    firstDataRow: 4,
    frozenRows: 3,
    frozenColumns: 0,
    readOnly: true
  },
  snapshotSummary: {
    totalTinsToProduce: { value: 16182629, formattedValue: "16,182,629", sourceCell: "B2", formula: "=sum(D4:D1002)" },
    totalTinsProduced: { value: 15648348, formattedValue: "15,648,348", sourceCell: "D2", formula: "=sum(E4:E1002)" },
    completion: { value: 0.967, formattedValue: "96.70%", sourceCell: "F2", formula: "=D2/B2" }
  },
  rowClassification: {
    populatedSourceRows: 78,
    prNumberRows: 64,
    productTotalRows: [6, 11, 15, 19, 25, 34, 41, 45, 57, 65, 71, 77],
    incompleteCandidateRows: [79],
    templateRows: [4],
    quantityColumnsAreStoredValues: true
  },
  columns: [
    { sourceColumn: "A", key: "column_a", label: "", type: "text", sourceHeaderBlank: true },
    { sourceColumn: "B", key: "pr_no", label: "PR No.", type: "text" },
    { sourceColumn: "C", key: "date_pr_received", label: "Date PR Recieved", type: "date" },
    { sourceColumn: "D", key: "pr_required_quantity_tins", label: "PR Required Quantity (tins)", type: "number" },
    { sourceColumn: "E", key: "production_produced_tins", label: "Production Produced (tins)", type: "number" },
    { sourceColumn: "F", key: "for_production_quantity_tins", label: "For Production Quantity (tins)", type: "number" },
    { sourceColumn: "G", key: "status", label: "Status", type: "status", formula: "=if(D4=\"\",\"\",if(F4>0,\"Pending for Production\",if(F4=0,\"Complete\",\"Over Produce\")))" }
  ],
  statusValues: ["Pending for Production", "Complete", "Over Produce"],
  statusFormula: "=if(D4=\"\",\"\",if(F4>0,\"Pending for Production\",if(F4=0,\"Complete\",\"Over Produce\")))",
  records: []
};