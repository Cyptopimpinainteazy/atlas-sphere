"""Test migration without sequence-guard"""

revision = 'zzz_test_missing_guard'
down_revision = None
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.create_table(
        'test_missing_guard',
        sa.Column('id', sa.Integer, primary_key=True)
    )


def downgrade():
    op.drop_table('test_missing_guard')
