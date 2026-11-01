from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from sqlalchemy.orm import Session

from app.dependencies import get_current_admin, get_db
from app.models.admin_user import AdminUser
from app.models.notification import AdminNotification, AuditLog, ContactMessage
from app.schemas.admin import (
    AuditLogRead,
    ContactRead,
    DashboardStats,
    MarkRead,
    NotificationRead,
    SiteSettingsPublic,
    SiteSettingsUpdate,
    UploadResult,
)
from app.schemas.order import OrderNoteUpdate, OrderRead, OrderStatusUpdate
from app.services import dashboard_service, order_service, upload_service
from app.services.audit_service import audit
from app.services.settings_service import get_settings

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"], dependencies=[Depends(get_current_admin)])


# ── Orders ────────────────────────────────────────────────────────────────


@router.get("/orders", response_model=list[OrderRead])
def list_orders(
    status: str | None = Query(None, pattern=r"^(NEW|CONFIRMED|WAITING_DELIVERY|DELIVERED|CANCELLED)$"),
    q: str | None = Query(None, max_length=100),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
):
    return order_service.get_orders(db, status=status, keyword=q, limit=limit)


@router.get("/orders/{order_id}", response_model=OrderRead)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = order_service.get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable.")
    return order


@router.patch("/orders/{order_id}/status", response_model=OrderRead)
def update_order_status(
    order_id: int,
    data: OrderStatusUpdate,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    order = order_service.get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable.")
    try:
        previous = order.status
        updated = order_service.update_order_status(db, order, data.status)
    except order_service.OrderError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    audit(db, "order_status", admin=admin, entity_type="order", entity_id=order.id, detail=f"{previous} → {data.status}", request=request)
    db.commit()
    return updated


@router.patch("/orders/{order_id}/note", response_model=OrderRead)
def update_order_note(
    order_id: int,
    data: OrderNoteUpdate,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    order = order_service.get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable.")
    order.admin_note = data.admin_note
    audit(db, "order_note", admin=admin, entity_type="order", entity_id=order.id, request=request)
    db.commit()
    db.refresh(order)
    return order


@router.post("/orders/{order_id}/anonymize", response_model=OrderRead)
def anonymize_order(
    order_id: int, request: Request, admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)
):
    order = order_service.get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable.")
    try:
        updated = order_service.anonymize_order(db, order)
    except order_service.OrderError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    audit(db, "order_anonymized", admin=admin, entity_type="order", entity_id=order.id, request=request)
    db.commit()
    return updated


@router.get("/dashboard/stats", response_model=DashboardStats)
def dashboard_stats(db: Session = Depends(get_db)):
    return dashboard_service.build_stats(db)


# ── Notifications ─────────────────────────────────────────────────────────


@router.get("/notifications", response_model=list[NotificationRead])
def list_notifications(is_read: bool | None = None, limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    query = db.query(AdminNotification)
    if is_read is not None:
        query = query.filter(AdminNotification.is_read.is_(is_read))
    return query.order_by(AdminNotification.created_at.desc(), AdminNotification.id.desc()).limit(limit).all()


@router.post("/notifications/read-all", status_code=204)
def mark_all_notifications_read(db: Session = Depends(get_db)):
    db.query(AdminNotification).filter(AdminNotification.is_read.is_(False)).update(
        {"is_read": True, "read_at": datetime.now(timezone.utc)}
    )
    db.commit()


@router.patch("/notifications/{notification_id}", response_model=NotificationRead)
def mark_notification(notification_id: int, data: MarkRead, db: Session = Depends(get_db)):
    notif = db.get(AdminNotification, notification_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification introuvable.")
    notif.is_read = data.is_read
    notif.read_at = datetime.now(timezone.utc) if data.is_read else None
    db.commit()
    db.refresh(notif)
    return notif


# ── Contact messages ──────────────────────────────────────────────────────


@router.get("/messages", response_model=list[ContactRead])
def list_messages(is_read: bool | None = None, limit: int = Query(100, ge=1, le=300), db: Session = Depends(get_db)):
    query = db.query(ContactMessage)
    if is_read is not None:
        query = query.filter(ContactMessage.is_read.is_(is_read))
    return query.order_by(ContactMessage.created_at.desc(), ContactMessage.id.desc()).limit(limit).all()


@router.patch("/messages/{message_id}", response_model=ContactRead)
def mark_message(message_id: int, data: MarkRead, db: Session = Depends(get_db)):
    msg = db.get(ContactMessage, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message introuvable.")
    msg.is_read = data.is_read
    db.commit()
    db.refresh(msg)
    return msg


@router.delete("/messages/{message_id}", status_code=204)
def delete_message(
    message_id: int, request: Request, admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)
):
    msg = db.get(ContactMessage, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message introuvable.")
    audit(db, "message_deleted", admin=admin, entity_type="message", entity_id=msg.id, request=request)
    db.delete(msg)
    db.commit()


# ── Uploads / settings / audit ────────────────────────────────────────────


@router.post("/uploads", response_model=UploadResult, status_code=201)
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    url = await upload_service.save_image(file)
    audit(db, "image_uploaded", admin=admin, entity_type="upload", detail=url, request=request)
    db.commit()
    return UploadResult(url=url)


@router.get("/settings", response_model=SiteSettingsPublic)
def read_settings(db: Session = Depends(get_db)):
    return get_settings(db)


@router.put("/settings", response_model=SiteSettingsPublic)
def update_settings(
    data: SiteSettingsUpdate,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    row = get_settings(db)
    changes = data.model_dump(exclude_unset=True)
    for field in ("site_title", "contact_phone", "contact_email", "delivery_fee", "default_language"):
        if field in changes and changes[field] is None:
            raise HTTPException(status_code=422, detail=f"Le champ {field} est obligatoire.")
    for field, value in changes.items():
        setattr(row, field, value)
    audit(db, "settings_updated", admin=admin, entity_type="settings", request=request)
    db.commit()
    db.refresh(row)
    return row


@router.get("/audit-logs", response_model=list[AuditLogRead])
def audit_logs(limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    return db.query(AuditLog).order_by(AuditLog.id.desc()).limit(limit).all()
