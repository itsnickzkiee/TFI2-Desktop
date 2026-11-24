/*
 * TFI_NEW — Yield Monitoring source contract.
 * Product names are the 39 reference families read from the official Yield Map.
 * Yield Log is derived from Product Entry + Yield Map; it is not a transaction source.
 * No sample or fabricated production rows are included.
 */
window.TFI_YIELD_MONITORING_DATA = {
  source: {
    workbook: "Copy of TFI - Production Monitoring Sheet 1",
    spreadsheetId: "1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k",
    sheet: "Yield Log", sheetId: 743111542, range: "A1:L39043", grid: "39043x12",
    headerRow: 4, firstDataRow: 5, frozenRows: 4, frozenColumns: 3,
    readOnly: true, derived: true
  },
  records: [],
  reference: {
    sheet: "Yield Map", sheetId: 854969610, range: "A5:A43",
    products: ["DPGP","Mayon GB","Seniorita BLML G.","Mayon Sweet GB","Mayon Sweet Beans","Mayon Red Monggo Beans","Seniorita BLML R.","Seniorita P.CB","American CB","Landers CB","PL Aguila CB","Seniorita VS","Philips ML","Philips VS","Philips FT","Philips LS","Philips LM","Oceans Best Tuna","Seniorita LM","Seniorita LS","Seniorita Chicken LS","American BB","Mang Rene LS","Central - CBB","P&B","Seniorita CBR","Seniorita CB G  LC","Seniorita-Philips BB","Seniorita CN","Seniorita TP","Mayon CnC","Mayon CSC","Mayon WKC","Mayon WPT","Nata de Coco","Mayon Kaong","Maharlika RB","Maharlika LM","Mayon Laing"], productCount: 39
  },
  upstream: { sheet: "Product Entry", sheetId: 545274882 },
  columns: ["date","product_name","product_code","total_fg_tins","main_yield_pct","stage2_yield_pct","stage3_yield_pct","bloom_rate","lid_reject_pct","can_reject_pct","box_reject_pct","label_reject_pct"]
};
