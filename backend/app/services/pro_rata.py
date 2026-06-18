"""Pro-rata rights service — pre-emptive investment right tracking.

Every query is scoped by company_id for tenant isolation. State transitions are
one-way: an active right can be exercised or waived, but a right that is already
exercised or waived (or expired) cannot transition again.
"""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.instrument import Instrument
from app.models.pro_rata_right import ProRataRight, ProRataStatus
from app.models.stakeholder import Stakeholder
from app.schemas.pro_rata import ProRataRightCreate


async def list_pro_rata_rights(db: AsyncSession, company_id: uuid.UUID) -> list[ProRataRight]:
    result = await db.execute(
        select(ProRataRight)
        .where(ProRataRight.company_id == company_id)
        .order_by(ProRataRight.created_at.desc())
    )
    return list(result.scalars().all())


async def create_pro_rata_right(
    db: AsyncSession, company_id: uuid.UUID, body: ProRataRightCreate
) -> ProRataRight:
    stakeholder = await db.execute(
        select(Stakeholder.id).where(
            Stakeholder.id == body.stakeholder_id,
            Stakeholder.company_id == company_id,
        )
    )
    if stakeholder.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stakeholder not found")

    if body.instrument_id is not None:
        instrument = await db.execute(
            select(Instrument.id).where(
                Instrument.id == body.instrument_id,
                Instrument.company_id == company_id,
            )
        )
        if instrument.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")

    right = ProRataRight(company_id=company_id, **body.model_dump())
    db.add(right)
    await db.commit()
    await db.refresh(right)
    return right


async def _get_scoped(
    db: AsyncSession, company_id: uuid.UUID, right_id: uuid.UUID
) -> ProRataRight:
    result = await db.execute(
        select(ProRataRight).where(
            ProRataRight.id == right_id,
            ProRataRight.company_id == company_id,
        )
    )
    right = result.scalar_one_or_none()
    if right is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pro-rata right not found")
    return right


async def _reject_if_expired(db: AsyncSession, right: ProRataRight, verb: str) -> None:
    """Lapse a past-deadline right to EXPIRED and reject the transition."""
    if right.deadline is not None and date.today() > right.deadline:
        right.status = ProRataStatus.EXPIRED
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Pro-rata right expired on {right.deadline}, cannot {verb}",
        )


async def exercise_pro_rata_right(
    db: AsyncSession, company_id: uuid.UUID, right_id: uuid.UUID, amount: Decimal
) -> ProRataRight:
    right = await _get_scoped(db, company_id, right_id)
    if right.status != ProRataStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Pro-rata right is {right.status}, cannot exercise",
        )
    await _reject_if_expired(db, right, "exercise")
    if amount > right.max_investment_sar:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exercise amount exceeds the maximum investment for this right",
        )
    right.status = ProRataStatus.EXERCISED
    right.exercised_amount_sar = amount
    right.exercised_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(right)
    return right


async def waive_pro_rata_right(
    db: AsyncSession, company_id: uuid.UUID, right_id: uuid.UUID
) -> ProRataRight:
    right = await _get_scoped(db, company_id, right_id)
    if right.status != ProRataStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Pro-rata right is {right.status}, cannot waive",
        )
    await _reject_if_expired(db, right, "waive")
    right.status = ProRataStatus.WAIVED
    await db.commit()
    await db.refresh(right)
    return right
