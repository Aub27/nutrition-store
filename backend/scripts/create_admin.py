"""Create the first administrator.

Usage (from backend/):
    python scripts/create_admin.py --email you@example.com --name "Your Name"

The password is read from ADMIN_PASSWORD, prompted interactively, or generated randomly and
printed once. There is deliberately NO default account or default password.
"""
import argparse
import getpass
import os
import secrets
import string
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from email_validator import EmailNotValidError, validate_email  # noqa: E402

from app.config import settings  # noqa: E402
from app.core.security import hash_password, validate_password_strength  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models import AdminUser  # noqa: E402


def generate_password() -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*-_=+"
    while True:
        candidate = "".join(secrets.choice(alphabet) for _ in range(20))
        if validate_password_strength(candidate) is None:
            return candidate


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--email", default=settings.admin_email or os.getenv("ADMIN_EMAIL", ""))
    parser.add_argument("--name", default="Administrateur")
    parser.add_argument("--prompt", action="store_true", help="Type the password interactively")
    args = parser.parse_args()

    email = args.email.strip().lower()
    try:
        email = validate_email(email, check_deliverability=False).normalized
    except EmailNotValidError as exc:
        print(f"Invalid --email: {exc}", file=sys.stderr)
        return 1

    password = settings.admin_password
    generated = False
    if args.prompt:
        password = getpass.getpass("Password: ")
    elif not password:
        password = generate_password()
        generated = True
    error = validate_password_strength(password)
    if error:
        print(error, file=sys.stderr)
        return 1

    if settings.database_url.startswith("sqlite"):
        Base.metadata.create_all(bind=engine)  # convenience for local SQLite only
    db = SessionLocal()
    try:
        existing = db.query(AdminUser).filter(AdminUser.email == email).first()
        if existing:
            existing.password_hash = hash_password(password)
            existing.token_version += 1
            existing.is_active = True
            action = "updated"
        else:
            db.add(AdminUser(full_name=args.name, email=email, password_hash=hash_password(password)))
            action = "created"
        db.commit()
    finally:
        db.close()

    print(f"Admin {action}: {email}")
    if generated:
        print(f"Generated password (shown once, store it in a password manager): {password}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
