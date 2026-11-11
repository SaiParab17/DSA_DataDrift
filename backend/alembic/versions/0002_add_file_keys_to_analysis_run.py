"""Add S3 file keys to analysis_runs table.

Revision ID: 0002_add_file_keys
Revises: 0001_initial_schema
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0002_add_file_keys"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "analysis_runs",
        sa.Column("reference_file_key", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "analysis_runs",
        sa.Column("current_file_key", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("analysis_runs", "current_file_key")
    op.drop_column("analysis_runs", "reference_file_key")
