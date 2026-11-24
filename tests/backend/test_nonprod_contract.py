import unittest
from src.tfi_backend.nonprod_contract import (
    NonProdValidationError, normalize_nonprod_changes, normalize_nonprod_records,
)

class NonProdContractTests(unittest.TestCase):
    def test_manual_minutes_and_derived_hours_protection(self):
        rows=normalize_nonprod_records([{"row_index":1,"record_data":{"total_minutes":"600","time_start":"06:00","time_end":"17:00"}}])
        self.assertEqual(rows[0]["record_data"]["total_minutes"],600)
        self.assertEqual(rows[0]["record_data"]["time_start"],"06:00")
        with self.assertRaises(NonProdValidationError):
            normalize_nonprod_records([{"record_data":{"working_hours":10}}])

    def test_blank_rows_are_rejected(self):
        with self.assertRaises(NonProdValidationError):
            normalize_nonprod_records([{"row_index":1,"record_data":{}}])

    def test_negative_minutes_are_rejected(self):
        with self.assertRaises(NonProdValidationError):
            normalize_nonprod_records([{"record_data":{"total_minutes":-1}}])

    def test_optimistic_update_normalizes_changed_fields(self):
        current={"work_date":"2026-11-22","employee_name":"Sample","employee_position":"Crew",
            "time_start":"06:00:00","time_end":"16:00:00","total_minutes":600,
            "activity":"Cleaning","location":"Building 5","remarks":None}
        self.assertEqual(normalize_nonprod_changes(current,{"total_minutes":"660"}),{"total_minutes":660})

if __name__=="__main__":
    unittest.main()
