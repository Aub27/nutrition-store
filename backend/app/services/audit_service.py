from fastapi import Request
from sqlalchemy.orm import Session

from app.core.net import client_ip
from app.models.admin_user import AdminUser
from app.models.notification import AuditLog


def audit(
    db: Session,
    action: str,
    *,
    admin: AdminUser | None = None,
    admin_email: str | None = None,
    entity_type: str | None = None,
    entity_id: int | str | None = None,
    detail: str | None = None,
    request: Request | None = None,
) -> None:
    """Add an audit row to the current transaction (committed by the caller)."""
    db.add(
        AuditLog(
            admin_id=admin.id if admin else None,
            admin_email=(admin.email if admin else admin_email),
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            detail=(detail or "")[:500] or None,
            ip_address=client_ip(request) if request else None,
        )
    )
