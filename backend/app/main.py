from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.domain import AccessDenied, NotFound, RuleError
from app.routers import assets, auth, catalog, dashboard, tasks
from app.seed import seed_if_empty


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Substation Asset & Maintenance Scheduler", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RuleError)
async def rule_error_handler(_, exc: RuleError):
    return JSONResponse(
        status_code=422,
        content={"detail": [{"field": field, "message": message} for field, message in exc.errors]},
    )


@app.exception_handler(AccessDenied)
async def access_handler(_, exc: AccessDenied):
    return JSONResponse(status_code=403, content={"detail": exc.message})


@app.exception_handler(NotFound)
async def not_found_handler(_, exc: NotFound):
    return JSONResponse(status_code=404, content={"detail": exc.message})


@app.get("/api/health")
def health():
    kind = "mysql" if settings.database_url.startswith("mysql") else "sqlite"
    return {"status": "ok", "database": kind}


app.include_router(auth.router, prefix="/api")
app.include_router(catalog.router, prefix="/api")
app.include_router(assets.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
