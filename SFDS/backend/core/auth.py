"""
JWT authentication helpers.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from core.database import Employee, get_db

# ---------------------------------------------------------------------------
# Config — change SECRET_KEY in production via env var
# ---------------------------------------------------------------------------
SECRET_KEY    = "durian-secret-key-change-in-production-2024"
ALGORITHM     = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24   # 24 hours

security = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                           detail="Token đã hết hạn")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                           detail="Token không hợp lệ")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> Employee:
    """Dependency: extract & validate JWT, return the Employee model."""
    token = credentials.credentials
    payload = decode_token(token)
    username: str = payload.get("sub", "")
    if not username:
        raise HTTPException(status_code=401, detail="Token không hợp lệ")

    emp = db.query(Employee).filter(Employee.username == username, Employee.is_active == True).first()
    if not emp:
        raise HTTPException(status_code=401, detail="Tài khoản không tồn tại hoặc đã bị vô hiệu hoá")
    return emp


def require_admin(current_user: Employee = Depends(get_current_user)) -> Employee:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Yêu cầu quyền quản trị")
    return current_user
