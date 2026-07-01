"""Unit test per il modello ConnectorRowMapping."""

from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import app.models  # noqa: F401 — registra tutti i modelli in Base.metadata
from app.db.base import Base
from app.models.connector_row_mapping import ConnectorRowMapping
from app.models.user import User


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def enable_fk(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    Base.metadata.drop_all(engine)


def _make_user(db: Session) -> User:
    user = User(email=f"{uuid4()}@example.com", name="Test User")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_create_connector_row_mapping(db):
    user = _make_user(db)
    mapping = ConnectorRowMapping(
        user_id=user.id,
        excel_project="Progetto Alpha",
        excel_task="Task Frontend",
        connector_label="odoo-work",
        remote_project_id="1",
        remote_project_name="Alpha Remote",
        remote_task_id="101",
        remote_task_name="Frontend Remote",
    )
    db.add(mapping)
    db.commit()
    db.refresh(mapping)

    assert mapping.id is not None
    assert mapping.user_id == user.id
    assert mapping.excel_project == "Progetto Alpha"
    assert mapping.connector_label == "odoo-work"
    assert mapping.remote_project_id == "1"
    assert mapping.last_used_at is None
    assert mapping.created_at is not None


def test_unique_constraint_violation(db):
    user = _make_user(db)
    kwargs = dict(
        user_id=user.id,
        excel_project="Progetto Alpha",
        excel_task="Task Frontend",
        connector_label="odoo-work",
    )
    db.add(ConnectorRowMapping(**kwargs))
    db.commit()

    db.add(ConnectorRowMapping(**kwargs))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_same_project_task_different_label_allowed(db):
    user = _make_user(db)
    db.add(
        ConnectorRowMapping(
            user_id=user.id,
            excel_project="Progetto Alpha",
            excel_task="Task Frontend",
            connector_label="odoo-work",
        )
    )
    db.add(
        ConnectorRowMapping(
            user_id=user.id,
            excel_project="Progetto Alpha",
            excel_task="Task Frontend",
            connector_label="jira-work",
        )
    )
    db.commit()
    assert db.query(ConnectorRowMapping).count() == 2


def test_cascade_delete_on_user(db):
    user = _make_user(db)
    db.add(
        ConnectorRowMapping(
            user_id=user.id,
            excel_project="Progetto Alpha",
            excel_task="Task Frontend",
            connector_label="odoo-work",
        )
    )
    db.commit()

    db.delete(user)
    db.commit()

    assert db.query(ConnectorRowMapping).count() == 0
