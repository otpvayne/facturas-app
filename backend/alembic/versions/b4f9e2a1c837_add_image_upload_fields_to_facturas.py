"""add image upload fields to facturas

Revision ID: b4f9e2a1c837
Revises: 3e072bcc8612
Create Date: 2026-03-27 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b4f9e2a1c837"
down_revision: Union[str, None] = "3e072bcc8612"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Hacer nullable los campos que OCR completara en fases posteriores
    op.alter_column("facturas", "numero", existing_type=sa.String(length=50), nullable=True)
    op.alter_column("facturas", "proveedor", existing_type=sa.String(length=255), nullable=True)
    op.alter_column(
        "facturas", "monto_total", existing_type=sa.Numeric(precision=12, scale=2), nullable=True
    )

    # Nuevos campos para el pipeline de imagenes
    op.add_column("facturas", sa.Column("image_url", sa.Text(), nullable=True))
    op.add_column(
        "facturas",
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            server_default="uploaded",
        ),
    )


def downgrade() -> None:
    op.drop_column("facturas", "status")
    op.drop_column("facturas", "image_url")

    op.alter_column("facturas", "monto_total", existing_type=sa.Numeric(precision=12, scale=2), nullable=False)
    op.alter_column("facturas", "proveedor", existing_type=sa.String(length=255), nullable=False)
    op.alter_column("facturas", "numero", existing_type=sa.String(length=50), nullable=False)
