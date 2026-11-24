"""Source-aligned validation for the NON-PROD operational register."""
from __future__ import annotations
from datetime import date, time
from typing import Any

INPUT_FIELDS=("work_date","employee_name","employee_position","time_start","time_end","total_minutes","activity","location","remarks")
LIMITS={"employee_name":200,"employee_position":100,"activity":300,"location":200,"remarks":2000}
class NonProdValidationError(ValueError):
    pass

def _text(value: Any, field: str) -> str | None:
    if value in (None,""): return None
    if not isinstance(value,str): raise NonProdValidationError(f"{field.replace('_',' ').title()} must be text.")
    value=value.strip()
    if len(value)>LIMITS[field]: raise NonProdValidationError(f"{field.replace('_',' ').title()} exceeds its allowed length.")
    return value or None

def _date(value: Any) -> str | None:
    if value in (None,""): return None
    if not isinstance(value,str): raise NonProdValidationError("Date must use YYYY-MM-DD format.")
    try: parsed=date.fromisoformat(value.strip())
    except ValueError as exc: raise NonProdValidationError("Date must use YYYY-MM-DD format.") from exc
    if parsed<=date(2000,1,1): raise NonProdValidationError("Date must be later than 01 January 2000.")
    return parsed.isoformat()

def _time(value: Any, label: str) -> str | None:
    if value in (None,""): return None
    if not isinstance(value,str): raise NonProdValidationError(f"{label} must use HH:MM format.")
    try: parsed=time.fromisoformat(value.strip())
    except ValueError as exc: raise NonProdValidationError(f"{label} must use HH:MM format.") from exc
    if parsed.second or parsed.microsecond: raise NonProdValidationError(f"{label} must use HH:MM format.")
    return parsed.strftime("%H:%M")

def _minutes(value: Any) -> int | None:
    if value in (None,""): return None
    if isinstance(value,bool): raise NonProdValidationError("Total of minutes must be a whole non-negative number.")
    try: number=int(str(value).strip())
    except (TypeError,ValueError) as exc: raise NonProdValidationError("Total of minutes must be a whole non-negative number.") from exc
    if str(value).strip() not in (str(number),f"{number}.0") or not 0<=number<=100000:
        raise NonProdValidationError("Total of minutes must be a whole non-negative number.")
    return number

def _normalize(data: Any) -> dict:
    if not isinstance(data,dict): raise NonProdValidationError("Each NON-PROD row must contain a record_data object.")
    unknown=set(data)-set(INPUT_FIELDS)
    if unknown: raise NonProdValidationError("Working Hours is calculated and cannot be entered or edited.")
    result={}
    for field,value in data.items():
        if field=="work_date": result[field]=_date(value)
        elif field=="time_start": result[field]=_time(value,"Time Start")
        elif field=="time_end": result[field]=_time(value,"Time End")
        elif field=="total_minutes": result[field]=_minutes(value)
        else: result[field]=_text(value,field)
    return result

def normalize_nonprod_records(records: Any) -> list[dict]:
    if not isinstance(records,list) or not 1<=len(records)<=100:
        raise NonProdValidationError("Submit between 1 and 100 NON-PROD rows.")
    output=[]
    for index,item in enumerate(records,1):
        if not isinstance(item,dict) or set(item)-{"row_index","record_data"}:
            raise NonProdValidationError(f"NON-PROD row {index} has an invalid structure.")
        row_index=item.get("row_index",index)
        if isinstance(row_index,bool) or not isinstance(row_index,int) or not 1<=row_index<=1000:
            raise NonProdValidationError(f"NON-PROD row {index} has an invalid row number.")
        data=item.get("record_data",{})
        if not isinstance(data,dict): raise NonProdValidationError(f"NON-PROD row {row_index} must contain record_data.")
        if not any(v not in (None,"") and (not isinstance(v,str) or v.strip()) for v in data.values()): continue
        output.append({"row_index":row_index,"record_data":_normalize(data)})
    if not output: raise NonProdValidationError("Enter at least one NON-PROD field before saving.")
    return output

def normalize_nonprod_changes(current: dict, changes: Any) -> dict:
    if not isinstance(changes,dict) or not changes: raise NonProdValidationError("Provide at least one NON-PROD field change.")
    if set(changes)-set(INPUT_FIELDS): raise NonProdValidationError("Working Hours is calculated and cannot be edited.")
    existing=_normalize({k:current.get(k) for k in INPUT_FIELDS})
    normalized=_normalize({**existing,**changes})
    return {k:normalized.get(k) for k in changes if normalized.get(k)!=existing.get(k)}
