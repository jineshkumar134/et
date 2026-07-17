"""
Async SQLAlchemy engine and session factory.
Supports SQLite (demo) and PostgreSQL (production) via settings.USE_SQLITE.
"""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from config.settings import settings


class Base(DeclarativeBase):
    pass


# ── Engine ────────────────────────────────────────────────────────────────────
if settings.USE_SQLITE:
    engine = create_async_engine(
        settings.SQLITE_URL,
        echo=settings.DEBUG,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
    )

# ── Session factory ───────────────────────────────────────────────────────────
AsyncSessionLocal: sessionmaker = sessionmaker(  # type: ignore[type-arg]
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


# ── Dependency ────────────────────────────────────────────────────────────────
async def get_db():
    """FastAPI dependency that yields an async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Create all tables (idempotent — safe to call on every startup)."""
    # Import here to ensure models are registered on Base.metadata
    import backend.database.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
