"""Test unit per TimestampMixin — nessuna connessione DB richiesta."""

import pytest
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin


class _SampleModel(TimestampMixin, Base):
    __tablename__ = "sample_for_mixin_test"

    id: Mapped[int] = mapped_column(primary_key=True)


@pytest.fixture(scope="module")
def mapper():
    return sa_inspect(_SampleModel)


def test_has_created_at(mapper):
    assert "created_at" in mapper.columns


def test_has_updated_at(mapper):
    assert "updated_at" in mapper.columns


def test_created_at_is_datetime(mapper):
    col_type = type(mapper.columns["created_at"].type).__name__
    assert col_type == "DateTime"


def test_updated_at_is_datetime(mapper):
    col_type = type(mapper.columns["updated_at"].type).__name__
    assert col_type == "DateTime"


def test_created_at_has_server_default(mapper):
    assert mapper.columns["created_at"].server_default is not None


def test_updated_at_has_server_default(mapper):
    assert mapper.columns["updated_at"].server_default is not None


def test_updated_at_has_onupdate(mapper):
    assert mapper.columns["updated_at"].onupdate is not None


def test_columns_not_nullable(mapper):
    assert mapper.columns["created_at"].nullable is False
    assert mapper.columns["updated_at"].nullable is False
