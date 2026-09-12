"""通用依赖与响应封装。"""
from typing import Any

from fastapi import Depends, Header, Request
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .security import parse_token


class ApiError(Exception):
    """业务异常：被全局处理器转为 {code, message, data}。"""

    def __init__(self, message: str, code: int = 1, http_status: int = 200):
        self.message = message
        self.code = code
        self.http_status = http_status
        super().__init__(message)


def ok(data: Any = None) -> dict:
    return {"code": 0, "message": "ok", "data": data}


def fail(message: str, code: int = 1) -> dict:
    return {"code": code, "message": message, "data": None}


def get_event(request: Request) -> dict:
    """统一取出 JSON 事件体（无 body 时返回空 dict）。"""
    return getattr(request.state, "event", None) or {}


def current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User | None:
    """从 Authorization: Bearer <token> 解析当前用户，未登录返回 None。"""
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "", 1).strip()
    openid = parse_token(token)
    if not openid:
        return None
    return db.query(User).filter(User.openid == openid).first()


def require_user(user: User | None = Depends(current_user)) -> User:
    if user is None:
        raise ApiError("未登录或登录已失效，请重新选择测试账号登录", http_status=401)
    return user
