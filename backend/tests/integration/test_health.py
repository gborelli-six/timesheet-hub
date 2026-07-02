from fastapi.testclient import TestClient


def test_health_returns_200(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200


def test_health_returns_ok_status(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.json() == {"status": "ok"}
