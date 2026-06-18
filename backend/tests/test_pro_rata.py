"""Tests for Sprint 5: pro-rata rights tracking — CRUD + exercise + waive."""

import pytest
from httpx import AsyncClient


async def _create_right(
    client: AsyncClient, headers: dict, company_id: str, stakeholder_id: str, **overrides
):
    payload = {
        "stakeholder_id": stakeholder_id,
        "round_name": "Series A",
        "max_investment_sar": "1000000.00",
        "deadline": "2026-12-31",
    }
    payload.update(overrides)
    return await client.post(
        f"/api/companies/{company_id}/pro-rata-rights", json=payload, headers=headers
    )


@pytest.mark.asyncio
async def test_create(db_client, mfa_headers, company_id, stakeholder_id):
    res = await _create_right(db_client, mfa_headers, company_id, stakeholder_id)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["round_name"] == "Series A"
    assert body["status"] == "active"
    assert body["max_investment_sar"] == "1000000.00"
    assert body["exercised_amount_sar"] is None


@pytest.mark.asyncio
async def test_list(db_client, mfa_headers, company_id, stakeholder_id):
    await _create_right(db_client, mfa_headers, company_id, stakeholder_id)
    await _create_right(db_client, mfa_headers, company_id, stakeholder_id, round_name="Series B")
    res = await db_client.get(
        f"/api/companies/{company_id}/pro-rata-rights", headers=mfa_headers
    )
    assert res.status_code == 200, res.text
    assert len(res.json()) == 2


@pytest.mark.asyncio
async def test_exercise_valid(db_client, mfa_headers, company_id, stakeholder_id):
    right = (await _create_right(db_client, mfa_headers, company_id, stakeholder_id)).json()
    res = await db_client.post(
        f"/api/companies/{company_id}/pro-rata-rights/{right['id']}/exercise",
        json={"exercised_amount_sar": "500000.00"},
        headers=mfa_headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "exercised"
    assert body["exercised_amount_sar"] == "500000.00"
    assert body["exercised_at"] is not None


@pytest.mark.asyncio
async def test_exercise_over_max(db_client, mfa_headers, company_id, stakeholder_id):
    right = (await _create_right(db_client, mfa_headers, company_id, stakeholder_id)).json()
    res = await db_client.post(
        f"/api/companies/{company_id}/pro-rata-rights/{right['id']}/exercise",
        json={"exercised_amount_sar": "2000000.00"},
        headers=mfa_headers,
    )
    assert res.status_code == 400, res.text


@pytest.mark.asyncio
async def test_exercise_twice(db_client, mfa_headers, company_id, stakeholder_id):
    right = (await _create_right(db_client, mfa_headers, company_id, stakeholder_id)).json()
    url = f"/api/companies/{company_id}/pro-rata-rights/{right['id']}/exercise"
    first = await db_client.post(url, json={"exercised_amount_sar": "500000.00"}, headers=mfa_headers)
    assert first.status_code == 200, first.text
    again = await db_client.post(url, json={"exercised_amount_sar": "100000.00"}, headers=mfa_headers)
    assert again.status_code == 400, again.text


@pytest.mark.asyncio
async def test_waive(db_client, mfa_headers, company_id, stakeholder_id):
    right = (await _create_right(db_client, mfa_headers, company_id, stakeholder_id)).json()
    res = await db_client.post(
        f"/api/companies/{company_id}/pro-rata-rights/{right['id']}/waive",
        headers=mfa_headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "waived"


@pytest.mark.asyncio
async def test_waive_after_exercise(db_client, mfa_headers, company_id, stakeholder_id):
    right = (await _create_right(db_client, mfa_headers, company_id, stakeholder_id)).json()
    exercised = await db_client.post(
        f"/api/companies/{company_id}/pro-rata-rights/{right['id']}/exercise",
        json={"exercised_amount_sar": "500000.00"},
        headers=mfa_headers,
    )
    assert exercised.status_code == 200, exercised.text
    res = await db_client.post(
        f"/api/companies/{company_id}/pro-rata-rights/{right['id']}/waive",
        headers=mfa_headers,
    )
    assert res.status_code == 400, res.text


@pytest.mark.asyncio
async def test_create_rejects_foreign_stakeholder(db_client, mfa_headers, company_id, stakeholder_id):
    # A stakeholder that lives in a different company must not be referenceable.
    other = (await db_client.post(
        "/api/companies", json={"name_en": "Other Co", "entity_type": "LLC"}, headers=mfa_headers
    )).json()["id"]
    foreign_sh = (await db_client.post(
        f"/api/companies/{other}/stakeholders",
        json={"stakeholder_type": "natural_person", "name_en": "Outsider"},
        headers=mfa_headers,
    )).json()["id"]
    res = await _create_right(db_client, mfa_headers, company_id, foreign_sh)
    assert res.status_code == 404, res.text


@pytest.mark.asyncio
async def test_exercise_after_deadline_expires(db_client, mfa_headers, company_id, stakeholder_id):
    right = (await _create_right(
        db_client, mfa_headers, company_id, stakeholder_id, deadline="2020-01-01"
    )).json()
    res = await db_client.post(
        f"/api/companies/{company_id}/pro-rata-rights/{right['id']}/exercise",
        json={"exercised_amount_sar": "500000.00"},
        headers=mfa_headers,
    )
    assert res.status_code == 400, res.text
    listed = (await db_client.get(
        f"/api/companies/{company_id}/pro-rata-rights", headers=mfa_headers
    )).json()
    assert listed[0]["status"] == "expired"


@pytest.mark.asyncio
async def test_wrong_company_isolation(db_client, mfa_headers, company_id, stakeholder_id):
    right = (await _create_right(db_client, mfa_headers, company_id, stakeholder_id)).json()
    # A second company owned by the same user — the right belongs to the first one.
    other = (await db_client.post(
        "/api/companies", json={"name_en": "Other Co", "entity_type": "LLC"}, headers=mfa_headers
    )).json()["id"]
    res = await db_client.post(
        f"/api/companies/{other}/pro-rata-rights/{right['id']}/exercise",
        json={"exercised_amount_sar": "100000.00"},
        headers=mfa_headers,
    )
    assert res.status_code == 404, res.text
