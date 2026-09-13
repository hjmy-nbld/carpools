"""极简 Bearer Token：base64url(openid).hmac签名，仅依赖标准库。

本地演示足够使用；生产环境可替换为 JWT（python-jose）。
"""
import base64
import hashlib
import hmac
import secrets

from .config import TOKEN_SECRET


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64decode(text: str) -> bytes:
    padding = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + padding)


def _sign(payload: str) -> str:
    return hmac.new(TOKEN_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()


def create_token(openid: str) -> str:
    payload = _b64encode(openid.encode())
    return f"{payload}.{_sign(payload)}"


def parse_token(token: str) -> str | None:
    """校验通过返回 openid，否则 None。"""
    if not token or "." not in token:
        return None
    payload, sig = token.rsplit(".", 1)
    if not hmac.compare_digest(sig, _sign(payload)):
        return None
    try:
        return _b64decode(payload).decode()
    except Exception:
        return None


# ---------------- 管理员鉴权 ----------------

def create_admin_token(admin_id: str) -> str:
    """管理员 token 加前缀 admin: 与用户 token 区分，避免混用。"""
    payload = _b64encode(f"admin:{admin_id}".encode())
    return f"{payload}.{_sign(payload)}"


def parse_admin_token(token: str) -> str | None:
    """校验通过返回 admin_id，否则 None。"""
    raw = parse_token(token)
    if not raw or not raw.startswith("admin:"):
        return None
    return raw[len("admin:"):]


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    """返回 (哈希, 盐)。sha256(密码 + 盐)。"""
    if salt is None:
        salt = secrets.token_hex(16)
    h = hashlib.sha256(f"{password}{salt}".encode()).hexdigest()
    return h, salt


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    h, _ = hash_password(password, salt)
    return hmac.compare_digest(h, password_hash)
