"""
Test unit dei modelli Import / ImportRow.

Verifica: creazione header + righe e rilettura; cascade su delete dell'header;
cascade su delete dell'utente. La fixture abilita PRAGMA foreign_keys=ON su SQLite
così che gli ON DELETE CASCADE a livello DB scattino come su PostgreSQL.
"""

from datetime import date
from uuid import UUID

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 — registra tutti i modelli in Base.metadata
from app.db.base import Base
from app.models.import_log import Import, ImportRow, ImportRowStatus, ImportStatus
from app.models.user import User
from app.models.user_token import UserTokenService

USER_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _fk_pragma(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    engine.dispose()


def _make_user(db) -> User:
    user = User(id=USER_ID, email="employee@sixfeetup.it", name="Employee")
    db.add(user)
    db.commit()
    return user


def _make_import(db, employee_id: UUID) -> Import:
    imp = Import(
        employee_id=employee_id,
        operator_id=None,
        status=ImportStatus.partial,
        period_start=date(2026, 6, 1),
        period_end=date(2026, 6, 30),
        total_rows=2,
        success_rows=1,
        failed_rows=1,
        rows=[
            ImportRow(
                row_number=1,
                connector_label="odoo-work",
                service=UserTokenService.odoo,
                excel_project="Progetto Alpha",
                excel_task="Task Frontend",
                remote_project_id="1",
                remote_project_name="Alpha Remote",
                remote_task_id="101",
                remote_task_name="Frontend Remote",
                hours=8.0,
                status=ImportRowStatus.success,
                error_message=None,
            ),
            ImportRow(
                row_number=2,
                connector_label="odoo-work",
                service=UserTokenService.odoo,
                excel_project="Progetto Beta",
                excel_task="Task Backend",
                hours=4.0,
                status=ImportRowStatus.failed,
                error_message="Errore applicativo",
            ),
        ],
    )
    db.add(imp)
    db.commit()
    db.refresh(imp)
    return imp


def test_create_header_and_rows(db_session):
    _make_user(db_session)
    imp = _make_import(db_session, USER_ID)

    assert imp.id is not None
    assert imp.created_at is not None
    rows = db_session.query(ImportRow).filter_by(import_id=imp.id).all()
    assert len(rows) == 2
    failed = [r for r in rows if r.status == ImportRowStatus.failed]
    assert len(failed) == 1
    assert failed[0].error_message == "Errore applicativo"


def test_cascade_on_delete_import(db_session):
    _make_user(db_session)
    imp = _make_import(db_session, USER_ID)
    import_id = imp.id

    db_session.delete(imp)
    db_session.commit()

    assert db_session.query(Import).count() == 0
    assert db_session.query(ImportRow).filter_by(import_id=import_id).count() == 0


def test_cascade_on_delete_user(db_session):
    user = _make_user(db_session)
    _make_import(db_session, USER_ID)

    db_session.delete(user)
    db_session.commit()

    assert db_session.query(Import).count() == 0
    assert db_session.query(ImportRow).count() == 0


def test_operator_id_defaults_none_for_self_import(db_session):
    _make_user(db_session)
    imp = _make_import(db_session, USER_ID)
    assert imp.operator_id is None
