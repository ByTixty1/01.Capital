"""Pro-rata rights API routes — track pre-emptive investment rights, exercise, waive."""

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_company_member, require_admin, require_mfa
from app.models.company_member import CompanyMember
from app.models.user import User
from app.schemas.pro_rata import (
    ProRataExercise,
    ProRataRightCreate,
    ProRataRightResponse,
)
from app.services.pro_rata import (
    create_pro_rata_right,
    exercise_pro_rata_right,
    list_pro_rata_rights,
    waive_pro_rata_right,
)

router = APIRouter(prefix="/companies", tags=["pro-rata"])


@router.get("/{company_id}/pro-rata-rights", response_model=list[ProRataRightResponse])
async def get_rights(
    member: CompanyMember = Depends(get_company_member),
    _mfa: User = Depends(require_mfa),
    db: AsyncSession = Depends(get_db),
) -> list[ProRataRightResponse]:
    rights = await list_pro_rata_rights(db, member.company_id)
    return [ProRataRightResponse.model_validate(r) for r in rights]


@router.post(
    "/{company_id}/pro-rata-rights",
    response_model=ProRataRightResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_right(
    body: ProRataRightCreate,
    member: CompanyMember = Depends(require_admin),
    _mfa: User = Depends(require_mfa),
    db: AsyncSession = Depends(get_db),
) -> ProRataRightResponse:
    right = await create_pro_rata_right(db, member.company_id, body)
    return ProRataRightResponse.model_validate(right)


@router.post(
    "/{company_id}/pro-rata-rights/{right_id}/exercise",
    response_model=ProRataRightResponse,
)
async def exercise_right(
    right_id: uuid.UUID,
    body: ProRataExercise,
    member: CompanyMember = Depends(require_admin),
    _mfa: User = Depends(require_mfa),
    db: AsyncSession = Depends(get_db),
) -> ProRataRightResponse:
    right = await exercise_pro_rata_right(db, member.company_id, right_id, body.exercised_amount_sar)
    return ProRataRightResponse.model_validate(right)


@router.post(
    "/{company_id}/pro-rata-rights/{right_id}/waive",
    response_model=ProRataRightResponse,
)
async def waive_right(
    right_id: uuid.UUID,
    member: CompanyMember = Depends(require_admin),
    _mfa: User = Depends(require_mfa),
    db: AsyncSession = Depends(get_db),
) -> ProRataRightResponse:
    right = await waive_pro_rata_right(db, member.company_id, right_id)
    return ProRataRightResponse.model_validate(right)
