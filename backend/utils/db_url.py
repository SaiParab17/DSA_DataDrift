"""
DataWatch Backend — Database URL normalization utilities for SQLAlchemy AsyncIO.
"""
from __future__ import annotations

from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit

DEFAULT_DATABASE_URL = "sqlite+aiosqlite:///./datawatch.db"
_POSTGRES_SCHEMES = {"postgres", "postgresql", "postgresql+asyncpg"}


def normalize_database_url(database_url: str) -> str:
    """
    Normalize a database connection URL for SQLAlchemy AsyncIO.

    - Leaves SQLite URLs unchanged.
    - Converts ``postgres://`` and ``postgresql://`` schemes to
      ``postgresql+asyncpg://``.
    - Converts libpq-style ``sslmode=...`` query parameters into ``asyncpg``'s
      ``ssl=...`` parameter without disabling SSL.
    - Strips libpq-only parameters rejected by ``asyncpg.connect`` (such as
      ``channel_binding``).
    - Preserves username, password, hostname, port, database name, and all
      other valid query parameters.
    """
    if not isinstance(database_url, str) or not database_url.strip():
        raise ValueError("Database URL must be a non-empty string.")

    raw_url = database_url.strip()
    parts = urlsplit(raw_url)
    scheme = parts.scheme.lower()

    if scheme.startswith("sqlite") or scheme not in _POSTGRES_SCHEMES:
        return raw_url

    normalized_scheme = "postgresql+asyncpg"

    if not parts.query:
        return urlunsplit(
            (normalized_scheme, parts.netloc, parts.path, "", parts.fragment)
        )

    query_pairs = parse_qsl(parts.query, keep_blank_values=True)
    has_explicit_ssl = any(
        key.lower() == "ssl" and value.strip() for key, value in query_pairs
    )

    normalized_pairs: list[tuple[str, str]] = []
    ssl_emitted = False

    for key, value in query_pairs:
        key_lower = key.lower()
        if key_lower == "sslmode":
            clean_val = value.strip().lower()
            if clean_val and not has_explicit_ssl and not ssl_emitted:
                normalized_pairs.append(("ssl", clean_val))
                ssl_emitted = True
            continue
        if key_lower == "channel_binding":
            continue
        if key_lower == "ssl":
            clean_val = value.strip()
            if clean_val and not ssl_emitted:
                normalized_pairs.append(("ssl", clean_val))
                ssl_emitted = True
            continue
        normalized_pairs.append((key, value))

    normalized_query = urlencode(normalized_pairs, quote_via=quote)
    return urlunsplit(
        (normalized_scheme, parts.netloc, parts.path, normalized_query, parts.fragment)
    )
