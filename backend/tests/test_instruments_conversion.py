"""Tests for Sprint 5: convertible instrument conversion + anti-dilution math."""

from datetime import date
from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.services.antidilution import broad_based_weighted_average, full_ratchet
from app.services.conversion import compute_conversion


# ── Conversion math (pure) ────────────────────────────────────────────────────

def test_conversion_fixed_shares():
    r = compute_conversion(
        instrument_type="sukuk_convertible",
        face_value=Decimal("100000"),
        terms={"conversion_shares": "5000"},
    )
    assert r.shares == Decimal("5000")
    assert r.method == "fixed_shares"


def test_conversion_fixed_price():
    r = compute_conversion(
        instrument_type="sukuk_convertible",
        face_value=Decimal("100000"),
        terms={"conversion_price": "10"},
    )
    assert r.shares == Decimal("10000")
    assert r.method == "fixed_price"


def test_conversion_safe_discount_vs_cap_takes_lower_price():
    # Round price 10; 20% discount → 8. Cap 1,000,000 / 200,000 shares → 5. Cap wins.
    r = compute_conversion(
        instrument_type="safe",
        face_value=Decimal("500000"),
        terms={"discount": "0.20", "valuation_cap": "1000000"},
        round_price_per_share=Decimal("10"),
        pre_money_shares=Decimal("200000"),
    )
    assert r.method == "valuation_cap"
    assert r.conversion_price == Decimal("5")
    assert r.shares == Decimal("100000")  # 500,000 / 5


def test_conversion_safe_discount_wins_when_no_cap():
    r = compute_conversion(
        instrument_type="safe",
        face_value=Decimal("100000"),
        terms={"discount": "0.20"},
        round_price_per_share=Decimal("10"),
    )
    assert r.method == "discount"
    assert r.conversion_price == Decimal("8")
    assert r.shares == Decimal("12500")  # 100,000 / 8


def test_conversion_note_accrued_added_to_principal():
    r = compute_conversion(
        instrument_type="convertible_note",
        face_value=Decimal("100000"),
        terms={"conversion_price": "10"},
        accrued_amount=Decimal("5000"),
    )
    assert r.principal == Decimal("105000")
    assert r.shares == Decimal("10500")


def test_conversion_requires_round_price_for_safe():
    with pytest.raises(ValueError):
        compute_conversion(
            instrument_type="safe",
            face_value=Decimal("100000"),
            terms={"discount": "0.20"},
        )


# ── Anti-dilution math (pure) ─────────────────────────────────────────────────

def test_full_ratchet_resets_to_new_price():
    r = full_ratchet(
        old_conversion_price=Decimal("10"),
        new_issue_price=Decimal("5"),
        amount_invested=Decimal("1000000"),
    )
    assert r.new_conversion_price == Decimal("5")
    assert r.old_shares_on_conversion == Decimal("100000")
    assert r.new_shares_on_conversion == Decimal("200000")
    assert r.extra_shares == Decimal("100000")


def test_broad_based_weighted_average_softer_than_ratchet():
    bb = broad_based_weighted_average(
        old_conversion_price=Decimal("10"),
        new_issue_price=Decimal("5"),
        pre_round_fd_shares=Decimal("1000000"),
        new_shares_issued=Decimal("100000"),
        amount_invested=Decimal("1000000"),
    )
    fr = full_ratchet(
        old_conversion_price=Decimal("10"),
        new_issue_price=Decimal("5"),
        amount_invested=Decimal("1000000"),
    )
    # Weighted average gives a higher (less punitive) conversion price than ratchet.
    assert bb.new_conversion_price > fr.new_conversion_price
    assert bb.new_conversion_price < Decimal("10")  # but still adjusted down


def test_up_round_does_not_raise_conversion_price():
    r = broad_based_weighted_average(
        old_conversion_price=Decimal("10"),
        new_issue_price=Decimal("20"),
        pre_round_fd_shares=Decimal("1000000"),
        new_shares_issued=Decimal("100000"),
        amount_invested=Decimal("1000000"),
    )
    assert r.new_conversion_price <= Decimal("10")
    assert r.extra_shares == Decimal("0")


# ── Endpoints ─────────────────────────────────────────────────────────────────

async def _stakeholder(client: AsyncClient, headers: dict, company_id: str, name: str) -> str:
    return (await client.post(
        f"/api/companies/{company_id}/stakeholders",
        json={"stakeholder_type": "legal_entity", "name_en": name, "cr_number": "1010999999"},
        headers=headers,
    )).json()["id"]


async def _safe(client: AsyncClient, headers: dict, company_id: str, sh: str) -> str:
    return (await client.post(
        f"/api/companies/{company_id}/instruments",
        json={
            "stakeholder_id": sh, "instrument_type": "safe", "name": "Seed SAFE",
            "face_value": "500000", "quantity": "1", "issue_date": date.today().isoformat(),
            "terms": {"discount": "0.20", "valuation_cap": "1000000", "sharia_compliant": True},
        },
        headers=headers,
    )).json()["id"]


async def _founder_shares(client: AsyncClient, headers: dict, company_id: str, sh: str) -> None:
    # The convert endpoint derives pre-money fully-diluted shares from the cap
    # table to price a valuation cap — a company with zero issued shares cannot
    # convert a capped SAFE (422).
    res = await client.post(
        f"/api/companies/{company_id}/cap-table/issue",
        json={"stakeholder_id": sh, "quantity": 100000, "share_class": "common", "event_date": "2026-01-01"},
        headers=headers,
    )
    assert res.status_code == 201, res.text


@pytest.mark.asyncio
async def test_convert_preview_does_not_persist(db_client, mfa_headers):
    company_id = (await db_client.post(
        "/api/companies", json={"name_en": "Conv Co", "entity_type": "SJSC"}, headers=mfa_headers
    )).json()["id"]
    sh = await _stakeholder(db_client, mfa_headers, company_id, "Angel Fund")
    await _founder_shares(db_client, mfa_headers, company_id, sh)
    inst = await _safe(db_client, mfa_headers, company_id, sh)

    res = await db_client.post(
        f"/api/companies/{company_id}/instruments/{inst}/convert",
        json={"round_price_per_share": "10", "share_class": "preferred-a", "event_date": date.today().isoformat(), "preview": True},
        headers=mfa_headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["committed"] is False

    # Instrument still active; no shares issued.
    got = (await db_client.get(f"/api/companies/{company_id}/instruments/{inst}", headers=mfa_headers)).json()
    assert got["status"] == "active"


@pytest.mark.asyncio
async def test_convert_commits_and_issues_shares(db_client, mfa_headers):
    company_id = (await db_client.post(
        "/api/companies", json={"name_en": "Conv Co", "entity_type": "SJSC"}, headers=mfa_headers
    )).json()["id"]
    sh = await _stakeholder(db_client, mfa_headers, company_id, "Angel Fund")
    await _founder_shares(db_client, mfa_headers, company_id, sh)
    inst = await _safe(db_client, mfa_headers, company_id, sh)

    res = await db_client.post(
        f"/api/companies/{company_id}/instruments/{inst}/convert",
        json={"round_price_per_share": "10", "share_class": "preferred-a", "event_date": date.today().isoformat()},
        headers=mfa_headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["committed"] is True
    # Round 10 with 20% discount → 8; cap 1,000,000 / 100,000 pre-money → 10.
    # Discount is the lower price: 500,000 / 8 = 62,500 shares.
    assert body["method"] == "discount"
    assert Decimal(body["shares"]) == Decimal("62500")

    # Instrument marked converted.
    got = (await db_client.get(f"/api/companies/{company_id}/instruments/{inst}", headers=mfa_headers)).json()
    assert got["status"] == "converted"

    # Shares appear in the cap table under preferred-a.
    cap = (await db_client.get(f"/api/companies/{company_id}/cap-table", headers=mfa_headers)).json()
    assert any(h["share_class"] == "preferred-a" for h in cap["holdings"])


@pytest.mark.asyncio
async def test_double_convert_rejected(db_client, mfa_headers):
    company_id = (await db_client.post(
        "/api/companies", json={"name_en": "Conv Co", "entity_type": "SJSC"}, headers=mfa_headers
    )).json()["id"]
    sh = await _stakeholder(db_client, mfa_headers, company_id, "Angel Fund")
    await _founder_shares(db_client, mfa_headers, company_id, sh)
    inst = await _safe(db_client, mfa_headers, company_id, sh)
    payload = {"round_price_per_share": "10", "share_class": "preferred-a", "event_date": date.today().isoformat()}
    first = await db_client.post(f"/api/companies/{company_id}/instruments/{inst}/convert", json=payload, headers=mfa_headers)
    # The first convert must genuinely succeed — otherwise the 422 below would
    # pass for the wrong reason (e.g. a validation error, not double-convert).
    assert first.status_code == 200, first.text
    again = await db_client.post(f"/api/companies/{company_id}/instruments/{inst}/convert", json=payload, headers=mfa_headers)
    assert again.status_code == 422


@pytest.mark.asyncio
async def test_antidilution_preview_endpoint(db_client, mfa_headers, company_id):
    res = await db_client.post(
        f"/api/companies/{company_id}/instruments/antidilution-preview",
        json={
            "mechanism": "full_ratchet", "old_conversion_price": "10",
            "new_issue_price": "5", "amount_invested": "1000000",
        },
        headers=mfa_headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["new_conversion_price"] == "5.0000"
