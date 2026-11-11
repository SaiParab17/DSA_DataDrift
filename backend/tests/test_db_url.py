"""
DataWatch — Tests for async PostgreSQL/Neon database URL normalization.
"""
import inspect
import os
import ssl
import sys

import asyncpg
import asyncpg.connect_utils as connect_utils
import pytest
from alembic.config import Config as AlembicConfig
from sqlalchemy.dialects.postgresql.asyncpg import PGDialect_asyncpg
from sqlalchemy.engine import make_url

# Ensure backend directory is in sys.path
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from utils.db_url import DEFAULT_DATABASE_URL, normalize_database_url


def test_neon_postgresql_url_with_sslmode_require():
    """Neon postgresql:// URL converts scheme and replaces sslmode=require with ssl=require."""
    raw = (
        "postgresql://neon_user:Secret%40Pass@ep-cool-rain-123-pooler.us-east-1.aws.neon.tech:5432"
        "/neondb?sslmode=require"
    )
    normalized = normalize_database_url(raw)

    assert normalized == (
        "postgresql+asyncpg://neon_user:Secret%40Pass@ep-cool-rain-123-pooler.us-east-1.aws.neon.tech:5432"
        "/neondb?ssl=require"
    )


def test_neon_postgres_scheme_and_channel_binding_and_valid_params():
    """postgres:// converts to postgresql+asyncpg://, drops channel_binding, keeps valid query params."""
    raw = (
        "postgres://neon_user:SecretPass@ep-cool-rain-123.us-east-1.aws.neon.tech/neondb"
        "?sslmode=require&channel_binding=require&timeout=15&target_session_attrs=read-write"
    )
    normalized = normalize_database_url(raw)

    assert normalized == (
        "postgresql+asyncpg://neon_user:SecretPass@ep-cool-rain-123.us-east-1.aws.neon.tech/neondb"
        "?ssl=require&timeout=15&target_session_attrs=read-write"
    )


def test_already_normalized_asyncpg_url():
    """An already-normalized postgresql+asyncpg:// URL with ssl=require is idempotent."""
    raw = (
        "postgresql+asyncpg://neon_user:SecretPass@ep-cool-rain-123.us-east-1.aws.neon.tech/neondb"
        "?ssl=require"
    )
    assert normalize_database_url(raw) == raw


def test_asyncpg_url_still_normalizes_sslmode_if_present():
    """Even if postgresql+asyncpg:// is already set, sslmode=require must still convert to ssl=require."""
    raw = (
        "postgresql+asyncpg://neon_user:SecretPass@ep-cool-rain-123.us-east-1.aws.neon.tech/neondb"
        "?sslmode=require"
    )
    expected = (
        "postgresql+asyncpg://neon_user:SecretPass@ep-cool-rain-123.us-east-1.aws.neon.tech/neondb"
        "?ssl=require"
    )
    assert normalize_database_url(raw) == expected


def test_local_sqlite_urls_unchanged():
    """Local SQLite URLs are preserved without modification."""
    assert normalize_database_url(DEFAULT_DATABASE_URL) == DEFAULT_DATABASE_URL
    assert normalize_database_url("sqlite:///./datawatch.db") == "sqlite:///./datawatch.db"
    assert normalize_database_url("sqlite+aiosqlite:///:memory:") == "sqlite+aiosqlite:///:memory:"


def test_postgres_url_without_ssl_query_parameter():
    """URLs without SSL parameters keep empty query string and valid scheme."""
    assert (
        normalize_database_url("postgresql://local_user:local_pw@localhost:5432/datawatch")
        == "postgresql+asyncpg://local_user:local_pw@localhost:5432/datawatch"
    )
    assert (
        normalize_database_url("postgres://local_user:local_pw@localhost/datawatch?timeout=10")
        == "postgresql+asyncpg://local_user:local_pw@localhost/datawatch?timeout=10"
    )


def test_empty_database_url_raises_value_error():
    """Empty or whitespace-only database URLs raise ValueError."""
    with pytest.raises(ValueError):
        normalize_database_url("")
    with pytest.raises(ValueError):
        normalize_database_url("   ")


def test_sqlalchemy_and_asyncpg_accept_normalized_neon_url_with_ssl():
    """Normalized Neon URL builds a TLS SSLContext in asyncpg without unexpected sslmode kwargs."""
    raw = (
        "postgresql://neon_user:Secret%40Pass@ep-cool-rain-123-pooler.us-east-1.aws.neon.tech"
        "/neondb?sslmode=require&channel_binding=require"
    )
    normalized = normalize_database_url(raw)

    sa_url = make_url(normalized)
    assert sa_url.drivername == "postgresql+asyncpg"
    assert sa_url.username == "neon_user"
    assert sa_url.password == "Secret@Pass"
    assert sa_url.host == "ep-cool-rain-123-pooler.us-east-1.aws.neon.tech"
    assert sa_url.database == "neondb"
    assert dict(sa_url.query) == {"ssl": "require"}

    _, connect_kwargs = PGDialect_asyncpg().create_connect_args(sa_url)
    assert "sslmode" not in connect_kwargs
    assert "channel_binding" not in connect_kwargs
    assert connect_kwargs["ssl"] == "require"

    # Pass kwargs through asyncpg's argument parser to guarantee asyncpg accepts them
    connect_defaults = {
        k: v.default
        for k, v in inspect.signature(asyncpg.connect).parameters.items()
        if v.default is not inspect.Parameter.empty
    }
    parser_params = {
        k: connect_defaults.get(k)
        for k in inspect.signature(connect_utils._parse_connect_arguments).parameters
    }
    parser_params.update(connect_kwargs)

    addrs, conn_params, _ = connect_utils._parse_connect_arguments(**parser_params)
    assert addrs == [("ep-cool-rain-123-pooler.us-east-1.aws.neon.tech", 5432)]
    assert isinstance(conn_params.ssl, ssl.SSLContext)
    assert conn_params.sslmode == connect_utils.SSLMode.require


def test_alembic_config_preserves_encoded_normalized_url():
    """Alembic Config interpolation safely round-trips normalized URLs with percent-encoded credentials."""
    raw = (
        "postgresql://neon_user:Secret%40Pass@ep-cool-rain-123.us-east-1.aws.neon.tech"
        "/neondb?sslmode=require"
    )
    normalized = normalize_database_url(raw)

    cfg = AlembicConfig(os.path.join(BACKEND_DIR, "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", normalized.replace("%", "%%"))

    resolved = cfg.get_main_option("sqlalchemy.url")
    assert resolved == normalized


def test_database_and_alembic_env_share_normalizer(monkeypatch):
    """database.py resolves and normalizes Neon URLs via utils.db_url with asyncpg dialect."""
    import asyncio
    from database import create_configured_async_engine

    neon_raw = (
        "postgresql://neon_user:Secret%40Pass@ep-test.us-east-1.aws.neon.tech"
        "/neondb?sslmode=require&channel_binding=require"
    )
    expected = normalize_database_url(neon_raw)

    monkeypatch.setenv("DATABASE_URL", neon_raw)
    resolved_url, test_engine = create_configured_async_engine()
    try:
        assert resolved_url == expected
        assert test_engine.url.drivername == "postgresql+asyncpg"
        assert dict(test_engine.url.query) == {"ssl": "require"}
    finally:
        asyncio.run(test_engine.dispose())


def test_alembic_env_normalizes_neon_database_url(monkeypatch, capsys, caplog):
    """Executing alembic/env.py passes normalized postgresql+asyncpg URL with ssl=require to Alembic."""
    import runpy
    from unittest.mock import AsyncMock, MagicMock
    import alembic.context

    neon_raw = (
        "postgresql://neon_user:Secret%40Pass@ep-test.us-east-1.aws.neon.tech"
        "/neondb?sslmode=require&channel_binding=require"
    )
    expected = normalize_database_url(neon_raw)

    cfg = AlembicConfig(os.path.join(BACKEND_DIR, "alembic.ini"))
    # Avoid reconfiguring root logging handlers under pytest
    cfg.config_file_name = None

    captured_configs = []

    def fake_async_engine_from_config(configuration, **kwargs):
        captured_configs.append(dict(configuration))
        mock_conn = MagicMock()
        mock_conn.run_sync = AsyncMock(side_effect=lambda fn: fn(MagicMock()))

        mock_conn_ctx = MagicMock()
        mock_conn_ctx.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_conn_ctx.__aexit__ = AsyncMock(return_value=False)

        mock_engine = MagicMock()
        mock_engine.connect.return_value = mock_conn_ctx
        mock_engine.dispose = AsyncMock()
        return mock_engine

    configure_mock = MagicMock()
    tx_ctx = MagicMock()
    tx_ctx.__enter__ = MagicMock(return_value=None)
    tx_ctx.__exit__ = MagicMock(return_value=False)

    monkeypatch.setenv("DATABASE_URL", neon_raw)
    monkeypatch.setattr(alembic.context, "config", cfg, raising=False)
    monkeypatch.setattr(alembic.context, "is_offline_mode", lambda: False, raising=False)
    monkeypatch.setattr(alembic.context, "configure", configure_mock, raising=False)
    monkeypatch.setattr(alembic.context, "begin_transaction", lambda: tx_ctx, raising=False)
    monkeypatch.setattr(alembic.context, "run_migrations", MagicMock(), raising=False)
    monkeypatch.setattr(
        "sqlalchemy.ext.asyncio.async_engine_from_config",
        fake_async_engine_from_config,
    )

    env_path = os.path.join(BACKEND_DIR, "alembic", "env.py")
    runpy.run_path(env_path)

    assert len(captured_configs) == 1
    passed_url = captured_configs[0]["sqlalchemy.url"]
    assert passed_url == expected
    parsed = make_url(passed_url)
    assert parsed.drivername == "postgresql+asyncpg"
    assert dict(parsed.query) == {"ssl": "require"}
    assert "sslmode" not in parsed.query
    configure_mock.assert_called_once()
    assert configure_mock.call_args.kwargs["render_as_batch"] is False

    captured_io = capsys.readouterr()
    assert "Secret" not in captured_io.out
    assert "Secret" not in captured_io.err
    assert "Secret" not in caplog.text
