"""create reputation and slashing tables

Revision ID: 001
Revises: 
Create Date: 2025-12-25 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Guard against orphaned sequences left from prior test runs.
    # If an id sequence exists for a missing table, drop it to avoid duplicate sequence errors.
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM pg_class WHERE relkind='S' AND relname='reputation_events_id_seq')
           AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='reputation_events') THEN
            DROP SEQUENCE reputation_events_id_seq;
        END IF;
    END$$;
    """)

    op.create_table(
        'reputation_events',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('wallet_address', sa.Text, nullable=False),
        sa.Column('node_id', sa.Text),
        sa.Column('event_type', sa.Text),
        sa.Column('delta', sa.Float),
        sa.Column('prev_reputation', sa.Float),
        sa.Column('new_reputation', sa.Float),
        sa.Column('evidence_hash', sa.Text),
        sa.Column('occurred_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )

    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM pg_class WHERE relkind='S' AND relname='slashing_events_id_seq')
           AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='slashing_events') THEN
            DROP SEQUENCE slashing_events_id_seq;
        END IF;
    END$$;
    """)

    op.create_table(
        'slashing_events',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('wallet_address', sa.Text, nullable=False),
        sa.Column('node_id', sa.Text),
        sa.Column('severity', sa.Float),
        sa.Column('slash_amount', sa.Float),
        sa.Column('recurrence_count', sa.Integer),
        sa.Column('evidence_hash', sa.Text),
        sa.Column('occurred_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column('appeal_status', sa.Text),
    )


def downgrade():
    op.drop_table('slashing_events')
    op.drop_table('reputation_events')
