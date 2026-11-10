"""Initial database schema for DataWatch

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-11-10 20:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create analysis_runs table
    op.create_table(
        'analysis_runs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('reference_file', sa.String(length=255), nullable=False),
        sa.Column('current_file', sa.String(length=255), nullable=False),
        sa.Column('reference_rows', sa.Integer(), nullable=False),
        sa.Column('current_rows', sa.Integer(), nullable=False),
        sa.Column('features_analyzed', sa.Integer(), nullable=False),
        sa.Column('features_drifted', sa.Integer(), nullable=False),
        sa.Column('max_psi', sa.Float(), nullable=True),
        sa.Column('overall_status', sa.String(length=50), nullable=False),
        sa.Column('elapsed_ms', sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # 2. Create feature_drifts table
    op.create_table(
        'feature_drifts',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('run_id', sa.String(length=36), nullable=False),
        sa.Column('feature_name', sa.String(length=255), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('psi', sa.Float(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('severity', sa.String(length=50), nullable=False),
        sa.Column('ks_statistic', sa.Float(), nullable=True),
        sa.Column('ks_p_value', sa.Float(), nullable=True),
        sa.Column('wasserstein_distance', sa.Float(), nullable=True),
        sa.Column('mean_change_percent', sa.Float(), nullable=True),
        sa.Column('metrics_json', sa.JSON(), nullable=True),
        sa.Column('distribution_json', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['run_id'], ['analysis_runs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_feature_drifts_run_id'), 'feature_drifts', ['run_id'], unique=False)

    # 3. Create quality_summaries table
    op.create_table(
        'quality_summaries',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('run_id', sa.String(length=36), nullable=False),
        sa.Column('total_expectations', sa.Integer(), nullable=False),
        sa.Column('passed', sa.Integer(), nullable=False),
        sa.Column('failed', sa.Integer(), nullable=False),
        sa.Column('success_percent', sa.Float(), nullable=False),
        sa.Column('overall_status', sa.String(length=50), nullable=False),
        sa.Column('expectations_json', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['run_id'], ['analysis_runs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_quality_summaries_run_id'), 'quality_summaries', ['run_id'], unique=True)

    # 4. Create model_impact_results table
    op.create_table(
        'model_impact_results',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('run_id', sa.String(length=36), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('model_name', sa.String(length=255), nullable=True),
        sa.Column('target_column', sa.String(length=255), nullable=True),
        sa.Column('reference_metrics_json', sa.JSON(), nullable=True),
        sa.Column('current_metrics_json', sa.JSON(), nullable=True),
        sa.Column('metric_changes_json', sa.JSON(), nullable=True),
        sa.Column('verdict', sa.String(length=100), nullable=True),
        sa.ForeignKeyConstraint(['run_id'], ['analysis_runs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_model_impact_results_run_id'), 'model_impact_results', ['run_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_model_impact_results_run_id'), table_name='model_impact_results')
    op.drop_table('model_impact_results')
    op.drop_index(op.f('ix_quality_summaries_run_id'), table_name='quality_summaries')
    op.drop_table('quality_summaries')
    op.drop_index(op.f('ix_feature_drifts_run_id'), table_name='feature_drifts')
    op.drop_table('feature_drifts')
    op.drop_table('analysis_runs')

