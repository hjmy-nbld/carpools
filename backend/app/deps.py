"""通用依赖与响应封装。"""
from typing import Any

from fastapi import Depends, Header, Request
from sqlalchemy.orm import Session

from .database import get_db
from .credit import unfreeze_if_due
from .models import Admin, User
from .security import parse_admin_token, parse_token
from .serializers import gen_id, now_ms


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
    user = db.query(User).filter(User.openid == openid).first()
    # 冻结到期：任意鉴权请求触发自动解冻
    if user is not None and unfreeze_if_due(user, now_ms()):
        db.commit()
        db.refresh(user)
    return user


def require_user(user: User | None = Depends(current_user)) -> User:
    if user is None:
        raise ApiError("未登录或登录已失效，请重新选择测试账号登录", http_status=401)
    if user.status == "deleted":
        raise ApiError("账号因信用分低于 70 分已被注销，无法继续使用", http_status=401)
    return user


def current_admin(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Admin | None:
    """从 Authorization: Bearer <admin_token> 解析管理员，未登录返回 None。"""
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "", 1).strip()
    admin_id = parse_admin_token(token)
    if not admin_id:
        return None
    return db.query(Admin).filter(Admin.id == admin_id).first()


def require_admin(admin: Admin | None = Depends(current_admin)) -> Admin:
    if admin is None:
        raise ApiError("未登录或管理员登录已失效，请重新登录", http_status=401)
    return admin


def log_admin_action(
    db: Session, admin: Admin, action: str, target: str, detail: str = ""
) -> None:
    """写入管理员操作日志（敏感操作留痕），调用方负责 commit。"""
    from .models import AdminLog

    db.add(
        AdminLog(
            id=gen_id("alog"),
            admin_id=admin.id,
            admin_name=admin.name or admin.username,
            action=action,
            target=target[:256],
            detail=detail,
            created_at=now_ms(),
        )
    )
