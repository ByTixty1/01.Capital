"""Static demo data for Qareen, mirroring frontend/src/lib/qareen/demoSeed.ts.

Kept as a small duplicated literal rather than a shared file across
languages — the dataset is tiny and this avoids cross-language build
tooling for a 72-hour prototype.
"""

import json
from datetime import date, timedelta
from typing import Any

DEMO_DATE = date(2026, 7, 16)

DEMO_SEED: dict[str, Any] = {
    "user": {"name": "Ali", "company_count": 3},
    "company": {
        "id": "mustaqbal-tech",
        "name_en": "Mustaqbal Tech LLC",
        "cr_number": "4030-556677",
        "founded_year": 2024,
        "entity_type": "LLC",
    },
    "stakeholders": [
        {"id": "stakeholder_row_1", "name": "Ali", "role": "Founder, CDO", "percentage": 45},
        {"id": "stakeholder_row_2", "name": "Yosef", "role": "CEO", "percentage": 30},
        {"id": "stakeholder_row_3", "name": "Mohammed", "role": "CAIO", "percentage": 25},
    ],
    "obligations": [
        {
            "id": "vat-filing",
            "label": "VAT filing",
            "due_in_days": 12,
            "severity": "critical",
            "fine_exposure_sar": 40000,
        },
        {
            "id": "gosi-monthly",
            "label": "GOSI monthly",
            "due_in_days": 21,
            "severity": "warning",
            "fine_exposure_sar": None,
        },
        {
            "id": "cr-renewal",
            "label": "CR renewal",
            "due_in_days": 88,
            "severity": "info",
            "fine_exposure_sar": None,
        },
    ],
    "risk": {"score": 68, "label": "elevated"},
}


def obligation_due_date(due_in_days: int) -> date:
    return DEMO_DATE + timedelta(days=due_in_days)


def demo_seed_json() -> str:
    """The COMPANY_CONTEXT block injected into the system prompt."""
    seed_with_dates = {
        **DEMO_SEED,
        "obligations": [
            {**o, "due_date": obligation_due_date(o["due_in_days"]).isoformat()}
            for o in DEMO_SEED["obligations"]
        ],
    }
    return json.dumps(seed_with_dates, indent=2)
