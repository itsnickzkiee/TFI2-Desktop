import json
from pathlib import Path

path = Path(r"C:/Users/Rominick/Desktop/TFI_NEW/src/tfi_backend/product_entry_manifest.json")
data = json.loads(path.read_text(encoding="utf-8"))
changes = {
    "BLK_01": ["CR"], "BLK_02": ["CZ"], "BLK_03": ["DK"],
    "BLK_13": ["DE"], "BLK_09": ["DQ"], "BLK_10": ["DE"],
    "BLK_27": ["DH"], "BLK_26": ["DF"], "BLK_29": ["DF"],
}
for block in data["blocks"]:
    columns = changes.get(block["block_key"], [])
    if not columns:
        continue
    metadata = block.get("schema_metadata") or {}
    for column in columns:
        if column in block["formula_columns"]:
            block["formula_columns"].remove(column)
        if column not in block["editable_columns"]:
            block["editable_columns"].append(column)
        if column in (metadata.get("formula_columns") or []):
            metadata["formula_columns"].remove(column)
        (metadata.get("formulas") or {}).pop(column, None)
    block["editable_columns"].sort(key=lambda c: (len(c), c))
    block["formula_columns"].sort(key=lambda c: (len(c), c))
    metadata["formula_columns"] = block["formula_columns"]
    block["schema_metadata"] = metadata
data["manifest_version"] = "2026-11-22-v2"
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print({"manifest_version": data["manifest_version"], "updated_blocks": len(changes), "mixed_manual_fields": sum(map(len, changes.values()))})
