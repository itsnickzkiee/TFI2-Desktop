from __future__ import annotations

import time

from tfi_backend.app import create_app
from tfi_backend.config import Settings
from tfi_backend.dmp_production_contract import (
    DmpProductionValidationError,
    normalize_dmp_production_changes,
    normalize_dmp_production_records,
)
from tfi_backend.session_store import SessionVault


def test_contract_accepts_incomplete_rows_and_normalizes_values():
    rows = normalize_dmp_production_records([{
        'production_date': '2026-11-21',
        'product_code': '  MDP-100-155  ',
        'worker_count': 1,
        'start_time': '06:00',
        'total_time_hours': '0.6200',
    }])
    assert rows == [{
        'production_date': '2026-11-21',
        'product_code': 'MDP-100-155',
        'process': None,
        'worker_name': None,
        'worker_count': '1',
        'start_time': '06:00',
        'end_time': None,
        'total_time_hours': '0.6200',
    }]


def test_contract_allows_blank_form_rows_for_server_side_skip():
    rows = normalize_dmp_production_records([{} for _ in range(12)])
    assert len(rows) == 12
    assert all(value is None for row in rows for value in row.values())


def test_contract_rejects_derived_position_and_unknown_fields():
    try:
        normalize_dmp_production_records([{'worker_name': 'Abulog,Cristina', 'worker_position': 'Line Leader'}])
    except DmpProductionValidationError as error:
        assert 'Position is calculated' in str(error)
    else:
        raise AssertionError('A client must not submit the derived Position field.')


def test_contract_rejects_negative_numbers_and_invalid_dates():
    for row in ({'worker_count': '-1'}, {'total_time_hours': -0.1}, {'production_date': '11/21/2026'}):
        try:
            normalize_dmp_production_records([row])
        except DmpProductionValidationError:
            pass
        else:
            raise AssertionError(f'Invalid DMP input was accepted: {row}')


def test_update_contract_only_returns_requested_normalized_fields():
    assert normalize_dmp_production_changes({'worker_count': '2.5'}) == {'worker_count': '2.5'}


class FakeGateway:
    def __init__(self, permissions=None):
        self.permissions = permissions or ['dmp_production.view', 'dmp_production.create', 'dmp_production.edit']
        self.created = []
        self.updated = []
        self.filters = []
        self.records = []

    def sign_in_with_password(self, email, password):
        return {
            'user_id': 'user-1', 'email': email, 'access_token': 'access',
            'refresh_token': 'refresh', 'expires_at': time.time() + 3600,
        }

    def get_access_context(self, access_token):
        return {
            'profile': {'user_id': 'user-1', 'email': 'admin@example.test', 'display_name': 'Test Admin', 'account_status': 'active'},
            'roles': [{'role_key': 'system_admin'}],
            'permissions': list(self.permissions),
        }

    def sign_out(self, access_token):
        return None

    def get_dmp_production_options(self, access_token):
        return {'workers': [{'name': 'Abulog,Cristina', 'position': 'Line Leader'}], 'processes': ['RETORTING']}

    def get_dmp_production_summary(self, access_token, **kwargs):
        self.summary_filters = kwargs
        return {
            'total_records': 6240, 'complete_records': 6095,
            'incomplete_records': 145, 'unique_workers': 38,
            'total_time_hours': 116732.50,
        }
    def get_dmp_production_records(self, access_token, **kwargs):
        self.filters.append(kwargs)
        return list(self.records)

    def create_dmp_production_records(self, access_token, records):
        self.created = list(records)
        return {'inserted': 1, 'duplicates': 0, 'empty': 11, 'results': [{'row_index': 1, 'status': 'inserted'}]}

    def update_dmp_production_record(self, access_token, record_id, expected_version, changes, change_reason=None):
        self.updated.append((record_id, expected_version, changes, change_reason))
        return {'changed': True, 'id': record_id, 'version': expected_version + 1}

    def get_dmp_production_revisions(self, access_token, record_id):
        return [{'version': 2, 'changed_fields': ['worker_count']}]


def build_app(gateway=None):
    settings = Settings(
        supabase_url='https://slfjqrkxnsgdaturaguw.supabase.co',
        publishable_key='sb_publishable_test',
        host='127.0.0.1', port=5100, idle_timeout_seconds=0,
    )
    return create_app(settings, gateway or FakeGateway(), SessionVault())


def login(client):
    return client.post(
        '/api/auth/login', json={'email': 'admin@example.test', 'password': 'correct'},
        headers={'Origin': 'http://localhost'},
    )


def test_dmp_options_and_record_list_require_module_view_permission():
    gateway = FakeGateway(permissions=['dmp_production.view'])
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    assert client.get('/api/dmp-production/options').get_json()['options']['workers'][0]['name'] == 'Abulog,Cristina'
    response = client.get('/api/dmp-production/records?page=2&page_size=25&date_from=2026-11-01&date_to=2026-11-30')
    assert response.status_code == 200
    assert gateway.filters[-1] == {'limit': 25, 'offset': 25, 'date_from': '2026-11-01', 'date_to': '2026-11-30'}


def test_dmp_save_accepts_incomplete_rows_and_requires_create_permission():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    response = client.post(
        '/api/dmp-production/records',
        json={'records': [{'worker_name': 'Abulog,Cristina'}, *([{}] * 11)]},
        headers={'Origin': 'http://localhost'},
    )
    assert response.status_code == 201
    assert len(gateway.created) == 12
    assert gateway.created[0]['worker_name'] == 'Abulog,Cristina'
    assert gateway.created[0]['production_date'] is None


def test_dmp_save_is_denied_without_create_permission():
    gateway = FakeGateway(permissions=['dmp_production.view'])
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    response = client.post(
        '/api/dmp-production/records', json={'records': [{'product_code': 'MDP-100-155'}]},
        headers={'Origin': 'http://localhost'},
    )
    assert response.status_code == 403
    assert response.get_json()['code'] == 'operational_permission_denied'


def test_dmp_update_uses_expected_version_and_revision_route():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    record_id = '00000000-0000-0000-0000-000000000123'
    response = client.patch(
        f'/api/dmp-production/records/{record_id}',
        json={'expected_version': 1, 'changes': {'worker_count': '2'}, 'change_reason': 'Corrected count'},
        headers={'Origin': 'http://localhost'},
    )
    assert response.status_code == 200
    assert gateway.updated[0][1:] == (1, {'worker_count': '2'}, 'Corrected count')
    revisions = client.get(f'/api/dmp-production/records/{record_id}/revisions')
    assert revisions.status_code == 200
    assert revisions.get_json()['revisions'][0]['version'] == 2


def test_dmp_date_filter_rejects_invalid_or_reversed_dates():
    client = build_app().test_client()
    assert login(client).status_code == 200
    invalid = client.get('/api/dmp-production/records?date_from=2026-11-31')
    assert invalid.status_code == 400
    reversed_dates = client.get('/api/dmp-production/records?date_from=2026-11-22&date_to=2026-11-21')
    assert reversed_dates.status_code == 400
def test_dmp_live_summary_requires_view_permission_and_supports_date_filters():
    gateway = FakeGateway(permissions=['dmp_production.view'])
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    response = client.get('/api/dmp-production/summary?date_from=2026-01-01&date_to=2026-01-31')
    assert response.status_code == 200
    assert response.get_json()['summary']['total_records'] == 6240
    assert response.get_json()['summary']['incomplete_records'] == 145
    assert gateway.summary_filters == {'date_from': '2026-01-01', 'date_to': '2026-01-31'}
    invalid = client.get('/api/dmp-production/summary?date_from=2026-02-01&date_to=2026-01-01')
    assert invalid.status_code == 400


def test_dmp_live_summary_is_denied_without_view_permission():
    gateway = FakeGateway(permissions=['dmp_production.create'])
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    response = client.get('/api/dmp-production/summary')
    assert response.status_code == 403