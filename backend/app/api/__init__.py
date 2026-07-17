from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.companies import router as companies_router
from app.api.documents import router as documents_router
from app.api.esop import router as esop_router
from app.api.filings import router as filings_router
from app.api.instruments import router as instruments_router
from app.api.integrations import router as integrations_router
from app.api.pro_rata import router as pro_rata_router
from app.api.qareen import router as qareen_router

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(companies_router)
api_router.include_router(esop_router)
api_router.include_router(documents_router)
api_router.include_router(filings_router)
api_router.include_router(instruments_router)
api_router.include_router(integrations_router)
api_router.include_router(pro_rata_router)
api_router.include_router(qareen_router)
