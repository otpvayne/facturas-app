"""add ocr_results table

Revision ID: c5d8f3a2b1e9
Revises: b4f9e2a1c837
Create Date: 2026-03-27 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c5d8f3a2b1e9"
down_revision: Union[str, None] = "b4f9e2a1c837"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ocr_results",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("factura_id", sa.UUID(), nullable=False),
        sa.Column("raw_text", sa.Text(), nullable=True),
        sa.Column("extracted_date", sa.String(length=50), nullable=True),
        sa.Column("extracted_total", sa.String(length=50), nullable=True),
        sa.Column("extracted_provider", sa.String(length=255), nullable=True),
        sa.Column("confidence_estimate", sa.Float(), nullable=True),
        sa.Column("processing_notes", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            server_default="processing",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["factura_id"],
            ["facturas.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_ocr_results_factura_id"), "ocr_results", ["factura_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_ocr_results_factura_id"), table_name="ocr_results")
    op.drop_table("ocr_results")
