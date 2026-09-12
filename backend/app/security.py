"""极简 Bearer Token：base64url(openid).hmac签名，仅依赖标准库。

本地演示足够使用；生产环境可替换为 JWT（python-jose）。
"""
import base64
import hashlib
import hmac

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
