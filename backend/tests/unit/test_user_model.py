import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models.user import User, upsert_user


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    Base.metadata.drop_all(engine)


def test_upsert_user_creates_new(db):
    user = upsert_user(db, email="alice@sixfeetup.it", name="Alice")
    assert user.id is not None
    assert user.email == "alice@sixfeetup.it"
    assert user.name == "Alice"
    assert user.role == "employee"
    assert db.query(User).count() == 1


def test_upsert_user_updates_without_duplicate(db):
    upsert_user(db, email="alice@sixfeetup.it", name="Alice")
    updated = upsert_user(db, email="alice@sixfeetup.it", name="Alice Updated")
    assert updated.name == "Alice Updated"
    assert db.query(User).count() == 1
