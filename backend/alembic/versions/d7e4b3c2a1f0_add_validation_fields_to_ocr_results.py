"""add validation fields to ocr_results

Revision ID: d7e4b3c2a1f0
Revises: c5d8f3a2b1e9
Create Date: 2026-03-27 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d7e4b3c2a1f0"
down_revision: Union[str, None] = "c5d8f3a2b1e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "ocr_results",
        sa.Column("validated_provider", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "ocr_results",
        sa.Column("validated_date", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "ocr_results",
        sa.Column("validated_total", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "ocr_results",
        sa.Column("validated_by", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "ocr_results",
        sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "ocr_results",
        sa.Column("validation_notes", sa.Text(), nullable=True),
    )
    op.add_column(
        "ocr_results",
        sa.Column(
            "was_manually_edited",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("ocr_results", "was_manually_edited")
    op.drop_column("ocr_results", "validation_notes")
    op.drop_column("ocr_results", "validated_at")
    op.drop_column("ocr_results", "validated_by")
    op.drop_column("ocr_results", "validated_total")
    op.drop_column("ocr_results", "validated_date")
    op.drop_column("ocr_results", "validated_provider")
