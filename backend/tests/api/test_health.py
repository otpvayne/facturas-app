"""Test health endpoint."""

import pytest
from fastapi.testclient import TestClient

from main import app


def test_health_endpoint():
    """Health endpoint should return 200 with simple message."""
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert "mensaje" in response.json() or "message" in response.json() or response.json() == {"status": "ok"}
