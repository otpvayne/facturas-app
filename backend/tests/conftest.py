"""
Pytest configuration and fixtures for the Facturas API tests.
"""

import asyncio
import os

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.session import get_db
from app.models.base import Base
from main import app


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def test_db():
    """
    Create an in-memory SQLite DB for testing (or use PostgreSQL if preferred).

    For now, we use SQLite in-memory for speed. In production we use PostgreSQL.
    """
    # Use SQLite for testing to avoid DB setup overhead
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        connect_args={"timeout": 5},
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    AsyncSessionLocal = sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
        autocommit=False,
    )

    async def override_get_db():
        async with AsyncSessionLocal() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    app.dependency_overrides[get_db] = override_get_db

    yield AsyncSessionLocal

    await engine.dispose()


@pytest.fixture
async def client(test_db):
    """Provide a test HTTP client for the FastAPI app."""
    from fastapi.testclient import TestClient

    return TestClient(app)


@pytest.fixture
async def async_client(test_db):
    """Provide an async HTTP client for testing async endpoints."""
    from httpx import AsyncClient

    return AsyncClient(app=app, base_url="http://test")
